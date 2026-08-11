'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { ChecklistModeloItem } from '@/types/kanban'
import { ArrowLeft, GripVertical, Trash2, Plus, ListChecks, Loader2, Check, Pencil, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

function Linha({ item, onRenomear, onRemover }: { item: ChecklistModeloItem; onRenomear: (id: string, titulo: string) => void; onRemover: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(item.titulo)

  function salvar() {
    const t = texto.trim()
    if (t && t !== item.titulo) onRenomear(item.id, t)
    else setTexto(item.titulo)
    setEditando(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-card-hover transition-colors ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        {...listeners}
        {...attributes}
        className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing shrink-0 touch-none"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {editando ? (
        <input
          autoFocus
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={e => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') { setTexto(item.titulo); setEditando(false) }
          }}
          className="flex-1 min-w-0 px-2 py-1 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-btn-primary"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-sm text-text-primary">{item.titulo}</span>
      )}

      {!editando && (
        <button
          onClick={() => setEditando(true)}
          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary transition-all shrink-0"
          title="Renomear"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={() => onRemover(item.id)}
        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all shrink-0"
        title="Remover do modelo"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function ChecklistModeloPage() {
  const [itens, setItens] = useState<ChecklistModeloItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#0079bf')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const salvo = localStorage.getItem('kanban-bg-color')
    if (salvo) setBgColor(salvo)
  }, [])

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('checklist_modelo').select('*').order('ordem')
    if (error) {
      // Erro cru do PostgREST aqui não ajuda ninguém: o caso real é a migração
      // 003 não ter sido rodada ainda no SQL Editor.
      setErro(
        /schema cache|does not exist/i.test(error.message)
          ? 'Esta tela precisa da migração supabase/003_checklist_modelo.sql, que ainda não foi rodada no SQL Editor do Supabase.'
          : 'Não consegui carregar o modelo: ' + error.message
      )
    } else {
      setItens(data || [])
      setErro(null)
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const titulo = novo.trim()
    if (!titulo) return
    setNovo('')
    const { error } = await supabase.from('checklist_modelo').insert({ titulo, ordem: itens.length })
    if (error) setErro(error.message.includes('duplicate') ? `"${titulo}" já está no modelo.` : error.message)
    carregar()
  }

  async function renomear(id: string, titulo: string) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, titulo } : i))
    const { error } = await supabase.from('checklist_modelo').update({ titulo }).eq('id', id)
    if (error) { setErro(error.message); carregar() }
  }

  async function remover(id: string) {
    setItens(prev => prev.filter(i => i.id !== id))
    await supabase.from('checklist_modelo').delete().eq('id', id)
  }

  async function reordenar(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const de = itens.findIndex(i => i.id === active.id)
    const para = itens.findIndex(i => i.id === over.id)
    if (de < 0 || para < 0) return

    const nova = arrayMove(itens, de, para)
    setItens(nova)
    await Promise.all(nova.map((i, idx) => supabase.from('checklist_modelo').update({ ordem: idx }).eq('id', i.id)))
  }

  async function aplicarEmTodas() {
    setAplicando(true)
    setResultado(null)
    const { data, error } = await supabase.rpc('aplicar_checklist_modelo')
    if (error) {
      setErro('Não consegui aplicar: ' + error.message)
    } else {
      const r = Array.isArray(data) ? data[0] : data
      const emp = r?.empresas_afetadas ?? 0
      const itensIns = r?.itens_inseridos ?? 0
      setResultado(
        itensIns === 0
          ? 'Todas as empresas já estavam com esse checklist. A ordem foi alinhada.'
          : `${itensIns} ${itensIns === 1 ? 'item adicionado' : 'itens adicionados'} em ${emp} ${emp === 1 ? 'empresa' : 'empresas'}.`
      )
    }
    setAplicando(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao board
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-12">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListChecks className="w-6 h-6" /> Checklist padrão
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Toda empresa nova nasce com estes itens. Arraste para reordenar.
          </p>
        </div>

        <section className="bg-card-bg border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-text-primary">Itens</h2>
            <span className="text-xs text-text-muted bg-black/5 px-1.5 py-0.5 rounded-full">{itens.length}</span>
          </div>

          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reordenar}>
              <SortableContext items={itens.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-border">
                  {itens.map(item => (
                    <Linha key={item.id} item={item} onRenomear={renomear} onRemover={remover} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {!carregando && itens.length === 0 && (
            <p className="text-sm text-text-secondary px-4 py-4">
              O modelo está vazio — empresa nova vai nascer sem checklist.
            </p>
          )}

          <form onSubmit={adicionar} className="flex gap-2 border-t border-border p-3">
            <input
              value={novo}
              onChange={e => setNovo(e.target.value)}
              placeholder="Adicionar item ao modelo..."
              className="flex-1 min-w-0 px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors"
            />
            <button
              type="submit"
              disabled={!novo.trim()}
              className="shrink-0 px-3 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </section>

        {erro && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
        )}

        <section className="mt-4 bg-card-bg border border-border rounded-xl shadow-sm p-4">
          <h2 className="text-base font-semibold text-text-primary">Aplicar às empresas que já existem</h2>
          <p className="text-sm text-text-secondary mt-1 mb-3">
            Adiciona nas empresas os itens do modelo que estiverem faltando e alinha a ordem.
            Nada é apagado: item já marcado como feito continua como está, e item que você tirou
            do modelo permanece nas empresas até ser removido na ficha de cada uma.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={aplicarEmTodas}
              disabled={aplicando || itens.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-btn-primary text-white rounded-lg text-sm font-medium hover:bg-btn-primary-hover transition-colors disabled:opacity-40"
            >
              {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aplicar a todas as empresas
            </button>

            {resultado && (
              <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                {resultado}
                <button onClick={() => setResultado(null)} className="text-green-700/60 hover:text-green-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
