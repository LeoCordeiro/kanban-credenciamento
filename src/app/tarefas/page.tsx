'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { ChecklistModeloItem, PRIORIDADES, Documento, Plataforma } from '@/types/kanban'
import { formatHoras } from '@/lib/tarefas'
import { TipoTarefaModal, PatchTipo } from '@/components/TipoTarefaModal'
import { ArrowLeft, GripVertical, Plus, ListChecks, Loader2, Check, X, Timer, AlignLeft, BookOpen, LayoutGrid } from 'lucide-react'

export const dynamic = 'force-dynamic'

function Linha({ item, plataformas, onAbrir }: { item: ChecklistModeloItem; plataformas: Plataforma[]; onAbrir: (t: ChecklistModeloItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const prio = PRIORIDADES.find(p => p.id === item.prioridade)
  const nDocs = item.docs?.length ?? 0
  const restritas = (item.plataformas ?? []).map(p => plataformas.find(x => x.id === p.plataforma_id)).filter(Boolean) as Plataforma[]

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

      <button onClick={() => onAbrir(item)} className="flex-1 min-w-0 text-left" title="Abrir para escrever as instruções">
        <span className="block truncate text-sm text-text-primary group-hover:underline">{item.titulo}</span>
        {item.instrucoes && (
          <span className="block truncate text-xs text-text-secondary mt-0.5">
            {item.instrucoes.replace(/\s+/g, ' ')}
          </span>
        )}
      </button>

      {restritas.length > 0 ? (
        <span className="shrink-0 inline-flex items-center gap-1" title={`Só nas plataformas: ${restritas.map(p => p.nome).join(', ')}`}>
          <LayoutGrid className="w-3 h-3 text-text-muted" />
          {restritas.slice(0, 3).map(p => (
            <span key={p.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ backgroundColor: p.cor }}>
              {p.nome}
            </span>
          ))}
          {restritas.length > 3 && <span className="text-[10px] text-text-secondary">+{restritas.length - 3}</span>}
        </span>
      ) : null}

      {nDocs > 0 && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-btn-primary/10 text-[10px] font-semibold text-btn-primary" title={`${nDocs} documentação(ões) vinculada(s)`}>
          <BookOpen className="w-3 h-3" /> {nDocs}
        </span>
      )}

      {item.instrucoes
        ? <AlignLeft className="w-3.5 h-3.5 text-btn-primary shrink-0" aria-label="Tem instruções" />
        : <span className="shrink-0 text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">sem instruções</span>}

      {item.sla_horas != null && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-sunken text-[11px] font-semibold text-text-secondary" title={`SLA de ${item.sla_horas} horas`}>
          <Timer className="w-3 h-3" /> {formatHoras(item.sla_horas)}
        </span>
      )}

      {prio && prio.id !== 'media' && (
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${prio.chip}`}>{prio.nome}</span>
      )}
    </div>
  )
}

export default function TarefasModeloPage() {
  const [itens, setItens] = useState<ChecklistModeloItem[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#0079bf')
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const salvo = localStorage.getItem('kanban-bg-color')
    if (salvo) setBgColor(salvo)
  }, [])

  const carregar = useCallback(async () => {
    // Traz os vínculos junto: a lista mostra quantas documentações e em quais
    // quadros cada tarefa vale, sem uma consulta por linha.
    let { data, error } = await supabase
      .from('checklist_modelo')
      .select('*, docs:checklist_modelo_documento(documento:documentos(id, titulo, categoria, url)), plataformas:checklist_modelo_plataforma(plataforma_id)')
      .order('ordem')

    // Sem a migração 008 o join não existe; cai para a consulta simples.
    if (error) ({ data, error } = await supabase.from('checklist_modelo').select('*').order('ordem'))

    if (error) {
      // Erro cru do PostgREST aqui não ajuda ninguém: o caso real é uma migração
      // que ainda não foi rodada no SQL Editor.
      setErro(
        /schema cache|does not exist/i.test(error.message)
          ? 'Esta tela precisa da migração supabase/007_sla_horas_instrucoes_do_tipo.sql, que ainda não foi rodada no SQL Editor do Supabase.'
          : 'Não consegui carregar as tarefas: ' + error.message
      )
    } else {
      setItens(data || [])
      setErro(null)
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
    supabase.from('documentos').select('*').order('categoria').order('titulo').then(({ data }) => { if (data) setDocumentos(data) })
    supabase.from('plataformas').select('*').order('ordem').order('created_at').then(({ data }) => { if (data) setPlataformas(data) })
  }, [carregar])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const titulo = novo.trim()
    if (!titulo) return
    setNovo('')
    const { data, error } = await supabase.from('checklist_modelo').insert({ titulo, ordem: itens.length }).select().single()
    if (error) setErro(error.message.includes('duplicate') ? `"${titulo}" já está na lista.` : error.message)
    await carregar()
    // Já abre para escrever as instruções — que é o motivo de criar a tarefa.
    if (data) setAbertoId(data.id)
  }

  async function atualizar(id: string, patch: PatchTipo) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, ...patch } as ChecklistModeloItem : i))
    const { error } = await supabase.from('checklist_modelo').update(patch).eq('id', id)
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
          ? 'Todas as empresas já estavam com estas tarefas. Ordem e prazos foram alinhados.'
          : `${itensIns} ${itensIns === 1 ? 'tarefa adicionada' : 'tarefas adicionadas'} em ${emp} ${emp === 1 ? 'empresa' : 'empresas'}.`
      )
    }
    setAplicando(false)
  }

  const aberto = abertoId ? itens.find(i => i.id === abertoId) : undefined
  const comInstrucoes = itens.filter(i => i.instrucoes).length

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
            <ListChecks className="w-6 h-6" /> Tarefas
          </h1>
          <p className="text-sm text-white/70 mt-1">
            As tarefas que toda empresa recebe. Clique numa delas para escrever as instruções e definir
            o SLA em horas — o que você escreve aqui vale para todas as empresas, não precisa repetir
            em cada uma. Arraste para reordenar.
          </p>
        </div>

        <section className="bg-card-bg border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-text-primary">Lista de tarefas</h2>
            <span className="text-xs text-text-muted bg-black/5 px-1.5 py-0.5 rounded-full">{itens.length}</span>
            {itens.length > 0 && (
              <span className="ml-auto text-xs text-text-secondary">
                {comInstrucoes} de {itens.length} com instruções
              </span>
            )}
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
                    <Linha key={item.id} item={item} plataformas={plataformas} onAbrir={t => setAbertoId(t.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {!carregando && itens.length === 0 && (
            <p className="text-sm text-text-secondary px-4 py-4">
              A lista está vazia — empresa nova vai nascer sem tarefa nenhuma.
            </p>
          )}

          <form onSubmit={adicionar} className="flex gap-2 border-t border-border p-3">
            <input
              value={novo}
              onChange={e => setNovo(e.target.value)}
              placeholder="Nova tarefa..."
              className="flex-1 min-w-0 px-3 py-2 bg-surface-sunken border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors"
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
            Adiciona nas empresas as tarefas que estiverem faltando, alinha a ordem e preenche o prazo
            de quem ainda não tem, usando o SLA em horas. Nada é apagado nem sobrescrito: tarefa já
            concluída continua como está, prazo definido à mão é respeitado, e tarefa que você tirou
            daqui permanece nas empresas até ser removida na ficha de cada uma.
            <br />
            <strong className="font-semibold text-text-primary">As instruções não precisam disto:</strong> elas
            são lidas do tipo, então editar aqui já reflete em todas as empresas na hora.
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

      {aberto && (
        <TipoTarefaModal
          tipo={aberto}
          documentos={documentos}
          plataformas={plataformas}
          onSalvar={patch => atualizar(aberto.id, patch)}
          onRemover={() => remover(aberto.id)}
          onClose={() => { setAbertoId(null); carregar() }}
        />
      )}
    </div>
  )
}
