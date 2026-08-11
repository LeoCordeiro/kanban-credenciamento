'use client'

import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, CollisionDetection, pointerWithin, rectIntersection, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import { Empresa, Plataforma, BoardItem, ChecklistResumo, COLUNAS, ColunaId } from '@/types/kanban'
import { Column } from './Column'
import { Card } from './Card'
import { CardForm } from './CardForm'
import { PlataformaTabs } from './PlataformaTabs'
import { UserMenu } from '../UserMenu'
import { ZapPanel, useZapPanel } from '../ZapPanel'
import { Search, Plus, X, Palette, Link2 } from 'lucide-react'

const BG_COLORS = [
  { id: 'blue', value: '#0052CC', label: 'Azul' },
  { id: 'green', value: '#00875A', label: 'Verde' },
  { id: 'purple', value: '#6554C0', label: 'Roxo' },
  { id: 'red', value: '#DE350B', label: 'Vermelho' },
  { id: 'orange', value: '#FF8B00', label: 'Laranja' },
  { id: 'teal', value: '#00897B', label: 'Ciano' },
  { id: 'pink', value: '#E91E63', label: 'Rosa' },
  { id: 'navy', value: '#0D1B3E', label: 'Marinho' },
  { id: 'indigo', value: '#4338CA', label: 'Índigo' },
  { id: 'emerald', value: '#059669', label: 'Esmeralda' },
  { id: 'crimson', value: '#B91C1C', label: 'Carmesim' },
  { id: 'slate', value: '#334155', label: 'Ardósia' },
  { id: 'amber', value: '#D97706', label: 'Âmbar' },
  { id: 'lime', value: '#65A30D', label: 'Lima' },
  { id: 'fuchsia', value: '#A21CAF', label: 'Fúcsia' },
]

// Onde o ponteiro está manda mais que a sobreposição de retângulos: com
// closestCorners, arrastar para a última coluna erra quando as raias têm
// alturas muito diferentes.
const detectarColisao: CollisionDetection = args => {
  const noPonteiro = pointerWithin(args)
  return noPonteiro.length > 0 ? noPonteiro : rectIntersection(args)
}

const ordenar = (lista: Plataforma[]) =>
  [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.created_at.localeCompare(b.created_at))

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
  const [showAddExisting, setShowAddExisting] = useState(false)
  const [existingEmpresas, setExistingEmpresas] = useState<Empresa[]>([])
  const [existingSearch, setExistingSearch] = useState('')

  const zap = useZapPanel()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const saved = localStorage.getItem('kanban-bg-color')
    if (saved) setBgColor(saved)
  }, [])

  useEffect(() => {
    if (selectedId) {
      const plat = plataformas.find(p => p.id === selectedId)
      if (plat?.cor) {
        setBgColor(plat.cor)
        localStorage.setItem('kanban-bg-color', plat.cor)
      }
    }
  }, [selectedId, plataformas])

  async function changeBgColor(color: string) {
    setBgColor(color)
    localStorage.setItem('kanban-bg-color', color)
    setShowBgPicker(false)
    if (selectedId) {
      setPlataformas(prev => prev.map(p => p.id === selectedId ? { ...p, cor: color } : p))
      await supabase.from('plataformas').update({ cor: color }).eq('id', selectedId)
    }
  }

  useEffect(() => {
    async function carregar() {
      // A coluna `ordem` vem da migração 002; se ela ainda não existe, cai na
      // ordem de criação em vez de quebrar o board.
      let { data, error } = await supabase.from('plataformas').select('*').order('ordem').order('created_at')
      if (error) ({ data } = await supabase.from('plataformas').select('*').order('created_at'))
      if (data && data.length > 0) {
        setPlataformas(data)
        setSelectedId(data[0].id)
      }
      setLoading(false)
    }
    carregar()

    const ch = supabase.channel('plataformas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plataformas' }, (p) => {
        if (p.eventType === 'INSERT') setPlataformas(prev => ordenar([...prev, p.new as Plataforma]))
        if (p.eventType === 'UPDATE') setPlataformas(prev => ordenar(prev.map(pl => pl.id === (p.new as Plataforma).id ? p.new as Plataforma : pl)))
        if (p.eventType === 'DELETE') {
          setPlataformas(prev => prev.filter(pl => pl.id !== (p.old as { id: string }).id))
          setSelectedId(prev => prev === (p.old as { id: string }).id ? null : prev)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const handleReorderPlataformas = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const de = plataformas.findIndex(p => p.id === active.id)
    const para = plataformas.findIndex(p => p.id === over.id)
    if (de < 0 || para < 0) return

    const nova = arrayMove(plataformas, de, para)
    setPlataformas(nova)
    await Promise.all(nova.map((p, i) => supabase.from('plataformas').update({ ordem: i }).eq('id', p.id)))
  }, [plataformas])

  const fetchRedFlagComments = useCallback(async (plataformaId: string) => {
    const { data } = await supabase.from('comentarios').select('empresa_id, texto').eq('plataforma_id', plataformaId).eq('red_flag', true)
    const map = new Map<string, string[]>()
    ;(data || []).forEach((c: any) => {
      map.set(c.empresa_id, [...(map.get(c.empresa_id) || []), c.texto])
    })
    return map
  }, [])

  // O checklist é da empresa, não da plataforma: os pendentes que aparecem no
  // card são os mesmos em qualquer quadro onde ela esteja.
  const fetchChecklists = useCallback(async () => {
    const { data } = await supabase.from('checklist_itens').select('empresa_id, titulo, concluido').order('ordem')
    const map = new Map<string, ChecklistResumo>()
    ;(data || []).forEach((c: any) => {
      const atual = map.get(c.empresa_id) || { feitos: 0, total: 0, pendentes: [] }
      atual.total++
      if (c.concluido) atual.feitos++
      else atual.pendentes.push(c.titulo)
      map.set(c.empresa_id, atual)
    })
    return map
  }, [])

  useEffect(() => {
    if (!selectedId) { setItems([]); return }

    Promise.all([
      supabase
        .from('empresa_plataforma')
        .select('id, coluna, posicao, has_red_flag, empresa_id, empresas(*)')
        .eq('plataforma_id', selectedId)
        .order('posicao'),
      fetchRedFlagComments(selectedId),
      fetchChecklists(),
    ]).then(([{ data }, flagMap, checkMap]) => {
      if (data) {
        setItems(data.map((d: any) => ({ epId: d.id, empresa: d.empresas as Empresa, coluna: d.coluna as ColunaId, plataformaId: selectedId, hasRedFlag: d.has_red_flag, redFlagComments: flagMap.get(d.empresa_id) || [], checklist: checkMap.get(d.empresa_id) })))
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
          const [flagMap, checkMap] = await Promise.all([fetchRedFlagComments(selectedId), fetchChecklists()])
          const item: BoardItem = { epId: rec.id, empresa: emp, coluna: rec.coluna as ColunaId, plataformaId: selectedId, hasRedFlag: rec.has_red_flag, redFlagComments: flagMap.get(rec.empresa_id) || [], checklist: checkMap.get(rec.empresa_id) }
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

    const chComments = supabase.channel(`comentarios-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios', filter: `plataforma_id=eq.${selectedId}` }, async () => {
        const flagMap = await fetchRedFlagComments(selectedId)
        setItems(prev => prev.map(i => ({ ...i, redFlagComments: flagMap.get(i.empresa.id) || [] })))
      })
      .subscribe()

    const chChecklist = supabase.channel(`checklist-board-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens' }, async () => {
        const checkMap = await fetchChecklists()
        setItems(prev => prev.map(i => ({ ...i, checklist: checkMap.get(i.empresa.id) })))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
      supabase.removeChannel(chComments)
      supabase.removeChannel(chChecklist)
    }
  }, [selectedId, fetchRedFlagComments, fetchChecklists])

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
    try {
      if (editingEmpresa) {
        const { error } = await supabase.from('empresas').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingEmpresa.id)
        if (error) throw error
      } else if (selectedId) {
        let empresaId: string
        const { data: existing } = await supabase.from('empresas').select('id').eq('cnpj', data.cnpj!).single()
        if (existing) {
          empresaId = existing.id
          const { error: updateError } = await supabase.from('empresas').update({ ...data, updated_at: new Date().toISOString() }).eq('id', empresaId)
          if (updateError) throw updateError
        } else {
          const { data: created, error: insertError } = await supabase.from('empresas').insert(data).select('id').single()
          if (insertError) throw insertError
          if (!created) throw new Error('Não foi possível obter o ID da empresa criada')
          empresaId = created.id
        }
        const { data: existingLink } = await supabase
          .from('empresa_plataforma').select('id').eq('empresa_id', empresaId).eq('plataforma_id', selectedId).single()
        if (!existingLink) {
          const { error: linkError } = await supabase.from('empresa_plataforma').insert({
            empresa_id: empresaId, plataforma_id: selectedId, coluna: formColuna,
            posicao: items.filter(i => i.coluna === formColuna).length,
          })
          if (linkError) throw linkError
        }
      }
      setShowForm(false)
      setEditingEmpresa(null)
    } catch (err: any) {
      console.error('Erro ao salvar empresa:', err)
      alert('Erro ao salvar empresa: ' + (err.message || JSON.stringify(err)))
    }
  }, [editingEmpresa, selectedId, formColuna, items])

  async function handleSavePlat(e: React.FormEvent) {
    e.preventDefault()
    if (!platNome.trim()) return
    if (editingPlat) {
      await supabase.from('plataformas').update({ nome: platNome.trim() }).eq('id', editingPlat.id)
    } else {
      const defaultCor = BG_COLORS[plataformas.length % BG_COLORS.length].value
      const { data } = await supabase.from('plataformas').insert({ nome: platNome.trim(), cor: defaultCor, ordem: plataformas.length }).select().single()
      if (data && !selectedId) setSelectedId(data.id)
    }
    setShowPlatForm(false)
    setEditingPlat(null)
    setPlatNome('')
  }

  async function openAddExisting() {
    if (!selectedId) return
    const { data: linked } = await supabase.from('empresa_plataforma').select('empresa_id').eq('plataforma_id', selectedId)
    const linkedIds = (linked || []).map((l: any) => l.empresa_id)
    let query = supabase.from('empresas').select('*').order('razao_social')
    if (linkedIds.length > 0) {
      query = query.not('id', 'in', `(${linkedIds.join(',')})`)
    }
    const { data } = await query
    setExistingEmpresas(data || [])
    setExistingSearch('')
    setShowAddExisting(true)
  }

  async function handleAddExisting(empresa: Empresa) {
    if (!selectedId) return
    await supabase.from('empresa_plataforma').insert({
      empresa_id: empresa.id,
      plataforma_id: selectedId,
      coluna: 'a_analisar' as ColunaId,
      posicao: items.filter(i => i.coluna === 'a_analisar').length,
    })
    setExistingEmpresas(prev => prev.filter(e => e.id !== empresa.id))
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
        {/* Plataformas.
            Só a faixa de abas rola: `overflow-x-auto` também clipa na vertical,
            e com os controles dentro dele o menu do usuário abria cortado. */}
        <div className="flex items-start gap-2 mb-3">
          <div className="flex items-start gap-2 min-w-0 flex-1 overflow-x-auto">
            <PlataformaTabs
              plataformas={plataformas}
              selectedId={selectedId}
              count={items.length}
              onSelect={setSelectedId}
              onEdit={p => { setEditingPlat(p); setPlatNome(p.nome); setShowPlatForm(true) }}
              onDelete={handleDeletePlat}
              onReorder={handleReorderPlataformas}
            />
            <button
              onClick={() => { setEditingPlat(null); setPlatNome(''); setShowPlatForm(true) }}
              className="px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium"
            >
              <Plus className="w-4 h-4" /> Plataforma
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedId && (
              <button onClick={openAddExisting} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/15 rounded-lg transition-colors font-medium" title="Vincular empresa existente">
                <Link2 className="w-4 h-4" /> Vincular
              </button>
            )}

            <button onClick={() => setShowBgPicker(true)} className="p-2 text-white/50 hover:text-white hover:bg-white/15 rounded-lg transition-colors" title="Cor de fundo">
              <Palette className="w-5 h-5" />
            </button>

            <UserMenu />
          </div>
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
        <DndContext sensors={sensors} collisionDetection={detectarColisao} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex gap-3 px-4 py-3 overflow-x-auto items-stretch">
            {COLUNAS.map(col => (
              <Column
                key={col.id}
                coluna={col}
                items={filtradas.filter(i => i.coluna === col.id)}
                plataformaId={selectedId}
                onAddCard={() => handleAddCard(col.id)}
                onEditCard={handleEditCard}
                onRemoveCard={handleRemoveCard}
                onAbrirZap={zap.abrir}
              />
            ))}
          </div>
          <DragOverlay>
            {activeItem ? <Card empresa={activeItem.empresa} dragId={activeItem.epId} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {zap.alvo && (
        <ZapPanel empresa={zap.alvo.empresa} whatsapp={zap.alvo.whatsapp} onClose={zap.fechar} />
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
            <div className="grid grid-cols-5 gap-3">
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

      {showAddExisting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddExisting(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Vincular Empresa Existente</h2>
              <button onClick={() => setShowAddExisting(false)} className="p-1 text-text-muted hover:text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={existingSearch}
                onChange={e => setExistingSearch(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                className="w-full px-4 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {existingEmpresas
                .filter(e =>
                  !existingSearch ||
                  e.razao_social.toLowerCase().includes(existingSearch.toLowerCase()) ||
                  e.cnpj.includes(existingSearch.replace(/\D/g, '')) ||
                  (e.nome_fantasia && e.nome_fantasia.toLowerCase().includes(existingSearch.toLowerCase()))
                )
                .map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleAddExisting(e)}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#f4f5f7] transition-colors border border-border"
                  >
                    <p className="text-sm font-medium text-text-primary">{e.razao_social}</p>
                    {e.nome_fantasia && <p className="text-xs text-text-secondary">{e.nome_fantasia}</p>}
                    <p className="text-xs text-text-muted font-mono mt-1">{e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                  </button>
                ))
              }
              {existingEmpresas.length === 0 && (
                <p className="text-sm text-text-muted text-center py-8">Todas as empresas já estão vinculadas a esta plataforma.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
