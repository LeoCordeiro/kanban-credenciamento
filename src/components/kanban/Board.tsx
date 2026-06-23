'use client'

import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { supabase } from '@/lib/supabase'
import { Empresa, Plataforma, BoardItem, COLUNAS, ColunaId } from '@/types/kanban'
import { Column } from './Column'
import { Card } from './Card'
import { CardForm } from './CardForm'
import { Search, Plus, X, Pencil, Trash2, Palette } from 'lucide-react'

const BG_COLORS = [
  { id: 'blue', value: '#0079bf', label: 'Azul' },
  { id: 'green', value: '#519839', label: 'Verde' },
  { id: 'purple', value: '#89609e', label: 'Roxo' },
  { id: 'red', value: '#b04632', label: 'Vermelho' },
  { id: 'orange', value: '#d29034', label: 'Laranja' },
  { id: 'teal', value: '#00aecc', label: 'Ciano' },
  { id: 'pink', value: '#cd5a91', label: 'Rosa' },
  { id: 'navy', value: '#344563', label: 'Marinho' },
  { id: 'gray', value: '#838c91', label: 'Cinza' },
]

export function Board() {
  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null)
  const [formColuna, setFormColuna] = useState<ColunaId>('a_analisar')
  const [busca, setBusca] = useState('')
  const [showPlatForm, setShowPlatForm] = useState(false)
  const [editingPlat, setEditingPlat] = useState<Plataforma | null>(null)
  const [platNome, setPlatNome] = useState('')
  const [bgColor, setBgColor] = useState('#0079bf')
  const [showBgPicker, setShowBgPicker] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const saved = localStorage.getItem('kanban-bg-color')
    if (saved) setBgColor(saved)
  }, [])

  function changeBgColor(color: string) {
    setBgColor(color)
    localStorage.setItem('kanban-bg-color', color)
    setShowBgPicker(false)
  }

  useEffect(() => {
    supabase.from('plataformas').select('*').order('created_at').then(({ data }) => {
      if (data && data.length > 0) {
        setPlataformas(data)
        setSelectedId(data[0].id)
      }
      setLoading(false)
    })

    const ch = supabase.channel('plataformas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plataformas' }, (p) => {
        if (p.eventType === 'INSERT') setPlataformas(prev => [...prev, p.new as Plataforma])
        if (p.eventType === 'UPDATE') setPlataformas(prev => prev.map(pl => pl.id === (p.new as Plataforma).id ? p.new as Plataforma : pl))
        if (p.eventType === 'DELETE') {
          setPlataformas(prev => prev.filter(pl => pl.id !== (p.old as { id: string }).id))
          setSelectedId(prev => prev === (p.old as { id: string }).id ? null : prev)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!selectedId) { setItems([]); return }

    supabase
      .from('empresa_plataforma')
      .select('id, coluna, posicao, empresa_id, empresas(*)')
      .eq('plataforma_id', selectedId)
      .order('posicao')
      .then(({ data }) => {
        if (data) {
          setItems(data.map((d: any) => ({ epId: d.id, empresa: d.empresas as Empresa, coluna: d.coluna as ColunaId })))
        }
      })

    const ch = supabase.channel(`ep-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresa_plataforma', filter: `plataforma_id=eq.${selectedId}` }, async (p) => {
        if (p.eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.epId !== (p.old as { id: string }).id))
        } else {
          const rec = p.new as any
          const { data: emp } = await supabase.from('empresas').select('*').eq('id', rec.empresa_id).single()
          if (!emp) return
          const item: BoardItem = { epId: rec.id, empresa: emp, coluna: rec.coluna as ColunaId }
          if (p.eventType === 'INSERT') {
            setItems(prev => prev.some(i => i.epId === rec.id) ? prev : [...prev, item])
          } else {
            setItems(prev => prev.map(i => i.epId === rec.id ? item : i))
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empresas' }, (p) => {
        const updated = p.new as Empresa
        setItems(prev => prev.map(i => i.empresa.id === updated.id ? { ...i, empresa: updated } : i))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [selectedId])

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const epId = active.id as string
    const newColuna = over.id as ColunaId

    const item = items.find(i => i.epId === epId)
    if (!item || item.coluna === newColuna) return

    setItems(prev => prev.map(i => i.epId === epId ? { ...i, coluna: newColuna } : i))
    await supabase.from('empresa_plataforma').update({ coluna: newColuna }).eq('id', epId)
  }, [items])

  const handleAddCard = useCallback((colunaId: ColunaId) => {
    setFormColuna(colunaId)
    setEditingEmpresa(null)
    setShowForm(true)
  }, [])

  const handleEditCard = useCallback(async (empresaId: string) => {
    const { data } = await supabase.from('empresas').select('*').eq('id', empresaId).single()
    if (data) { setEditingEmpresa(data); setShowForm(true) }
  }, [])

  const handleRemoveCard = useCallback(async (epId: string) => {
    setItems(prev => prev.filter(i => i.epId !== epId))
    await supabase.from('empresa_plataforma').delete().eq('id', epId)
  }, [])

  const handleSave = useCallback(async (data: Partial<Empresa>) => {
    if (editingEmpresa) {
      await supabase.from('empresas').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingEmpresa.id)
    } else if (selectedId) {
      let empresaId: string
      const { data: existing } = await supabase.from('empresas').select('id').eq('cnpj', data.cnpj!).single()
      if (existing) {
        empresaId = existing.id
        await supabase.from('empresas').update({ ...data, updated_at: new Date().toISOString() }).eq('id', empresaId)
      } else {
        const { data: created } = await supabase.from('empresas').insert(data).select('id').single()
        if (!created) return
        empresaId = created.id
      }
      const { data: existingLink } = await supabase
        .from('empresa_plataforma').select('id').eq('empresa_id', empresaId).eq('plataforma_id', selectedId).single()
      if (!existingLink) {
        await supabase.from('empresa_plataforma').insert({
          empresa_id: empresaId, plataforma_id: selectedId, coluna: formColuna,
          posicao: items.filter(i => i.coluna === formColuna).length,
        })
      }
    }
    setShowForm(false)
    setEditingEmpresa(null)
  }, [editingEmpresa, selectedId, formColuna, items])

  async function handleSavePlat(e: React.FormEvent) {
    e.preventDefault()
    if (!platNome.trim()) return
    if (editingPlat) {
      await supabase.from('plataformas').update({ nome: platNome.trim() }).eq('id', editingPlat.id)
    } else {
      const { data } = await supabase.from('plataformas').insert({ nome: platNome.trim() }).select().single()
      if (data && !selectedId) setSelectedId(data.id)
    }
    setShowPlatForm(false)
    setEditingPlat(null)
    setPlatNome('')
  }

  async function handleDeletePlat(id: string) {
    await supabase.from('plataformas').delete().eq('id', id)
    if (selectedId === id) {
      const remaining = plataformas.filter(p => p.id !== id)
      setSelectedId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const activeItem = items.find(i => i.epId === activeId)

  const filtradas = busca
    ? items.filter(i =>
        i.empresa.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
        i.empresa.cnpj.includes(busca.replace(/\D/g, '')) ||
        (i.empresa.nome_fantasia && i.empresa.nome_fantasia.toLowerCase().includes(busca.toLowerCase()))
      )
    : items

  const darken = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, (n >> 16) - 30)
    const g = Math.max(0, ((n >> 8) & 0xff) - 30)
    const b = Math.max(0, (n & 0xff) - 30)
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-white/70" style={{ backgroundColor: bgColor }}>Carregando...</div>

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Platform bar */}
      <div className="px-6 py-4" style={{ backgroundColor: darken(bgColor) + '99' }}>
        {/* Plataformas */}
        <div className="flex items-start gap-2 mb-3 overflow-x-auto">
          {plataformas.map(p => {
            const count = selectedId === p.id ? items.length : 0
            const isActive = selectedId === p.id
            return (
              <div key={p.id} className="group/tab flex flex-col items-center">
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-text-primary shadow-md'
                      : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white'
                  }`}
                >
                  {p.nome}
                  {isActive && count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-accent text-white rounded-full font-bold">{count}</span>
                  )}
                </button>
                <div className={`flex gap-1 mt-1 h-5 transition-opacity ${isActive ? 'opacity-0 group-hover/tab:opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={() => { setEditingPlat(p); setPlatNome(p.nome); setShowPlatForm(true) }} className="p-1 text-white/50 hover:text-white">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDeletePlat(p.id)} className="p-1 text-white/50 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
          <button
            onClick={() => { setEditingPlat(null); setPlatNome(''); setShowPlatForm(true) }}
            className="px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium"
          >
            <Plus className="w-4 h-4" /> Plataforma
          </button>

          <div className="flex-1" />

          <button onClick={() => setShowBgPicker(true)} className="p-2 text-white/50 hover:text-white hover:bg-white/15 rounded-lg transition-colors" title="Cor de fundo">
            <Palette className="w-5 h-5" />
          </button>
        </div>

        {/* Busca centralizada */}
        {selectedId && (
          <div className="flex justify-center">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Buscar empresa por nome ou CNPJ..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white/15 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:bg-white/25 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {showPlatForm && (
        <div className="px-6 py-3" style={{ backgroundColor: darken(bgColor) + '66' }}>
          <form onSubmit={handleSavePlat} className="flex items-center gap-3 max-w-md mx-auto">
            <input
              autoFocus
              value={platNome}
              onChange={e => setPlatNome(e.target.value)}
              placeholder="Nome da plataforma..."
              className="flex-1 px-4 py-2 bg-white rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" className="px-4 py-2 bg-btn-primary text-white rounded-lg text-sm font-medium hover:bg-btn-primary-hover transition-colors">
              {editingPlat ? 'Salvar' : 'Criar'}
            </button>
            <button type="button" onClick={() => { setShowPlatForm(false); setEditingPlat(null) }} className="p-1.5 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {!selectedId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/80 gap-4">
          <p className="text-xl font-medium">Crie uma plataforma para começar</p>
          <button
            onClick={() => { setEditingPlat(null); setPlatNome(''); setShowPlatForm(true) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Plataforma
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex gap-3 px-4 py-3 overflow-x-auto items-stretch">
            {COLUNAS.map(col => (
              <Column
                key={col.id}
                coluna={col}
                items={filtradas.filter(i => i.coluna === col.id)}
                onAddCard={() => handleAddCard(col.id)}
                onEditCard={handleEditCard}
                onRemoveCard={handleRemoveCard}
              />
            ))}
          </div>
          <DragOverlay>
            {activeItem ? <Card empresa={activeItem.empresa} dragId={activeItem.epId} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {showForm && (
        <CardForm
          empresa={editingEmpresa}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingEmpresa(null) }}
        />
      )}

      {showBgPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBgPicker(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary">Cor de fundo do board</h2>
              <button onClick={() => setShowBgPicker(false)} className="p-1 text-text-muted hover:text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {BG_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => changeBgColor(c.value)}
                  className={`h-20 rounded-lg transition-all hover:scale-[1.03] hover:shadow-lg flex items-end p-2 ${bgColor === c.value ? 'ring-3 ring-offset-2 ring-gray-900' : ''}`}
                  style={{ backgroundColor: c.value }}
                >
                  <span className="text-xs font-medium text-white/90">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
