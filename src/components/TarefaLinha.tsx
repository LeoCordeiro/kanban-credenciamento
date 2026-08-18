'use client'

import { useState } from 'react'
import { Tarefa } from '@/types/kanban'
import { folhasDe, estadoEfetivo, prazoVencido, formatPrazo } from '@/lib/tarefas'
import { Check, Plus, Trash2, ChevronRight, ChevronDown, CalendarDays, UserRound, Pencil } from 'lucide-react'

/** Profundidade máxima abaixo da empresa: etapa (0) → subtarefa (1) → sub-subtarefa (2). */
const NIVEL_MAX = 2

export interface TarefaHandlers {
  filhos: Map<string, Tarefa[]>
  usuarios: string[]
  onAlternar: (item: Tarefa) => void
  onAddSub: (parentId: string, titulo: string) => Promise<void>
  onSalvarMeta: (item: Tarefa, prazo: string | null, responsavel: string | null) => Promise<void>
  onRenomear: (item: Tarefa, titulo: string) => Promise<void>
  onRemover: (item: Tarefa) => void
}

export function TarefaLinha({ item, nivel, h }: { item: Tarefa; nivel: number; h: TarefaHandlers }) {
  const [recolhido, setRecolhido] = useState(false)
  const [addindo, setAddindo] = useState(false)
  const [subTitulo, setSubTitulo] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaPrazo, setMetaPrazo] = useState('')
  const [metaResp, setMetaResp] = useState('')
  const [renomeando, setRenomeando] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')

  const filhosDiretos = h.filhos.get(item.id) ?? []
  const ehPai = filhosDiretos.length > 0
  const concluido = ehPai ? estadoEfetivo(item, h.filhos) : item.concluido
  const folhas = ehPai ? folhasDe(item, h.filhos) : null
  const feitas = folhas ? folhas.filter(f => f.concluido).length : 0
  const vencido = prazoVencido(item.prazo, concluido)

  async function submitSub(e: React.FormEvent) {
    e.preventDefault()
    const t = subTitulo.trim()
    if (!t) return
    setSubTitulo('')
    setAddindo(false)
    setRecolhido(false)
    await h.onAddSub(item.id, t)
  }

  async function submitMeta(e: React.FormEvent) {
    e.preventDefault()
    setEditandoMeta(false)
    await h.onSalvarMeta(item, metaPrazo || null, metaResp || null)
  }

  async function submitRenome(e: React.FormEvent) {
    e.preventDefault()
    const t = novoTitulo.trim()
    setRenomeando(false)
    if (t && t !== item.titulo) await h.onRenomear(item, t)
  }

  return (
    <div>
      <div className="group flex items-center gap-2 px-4 py-2 hover:bg-card-hover transition-colors" style={{ paddingLeft: `${16 + nivel * 20}px` }}>
        {ehPai ? (
          <button onClick={() => setRecolhido(v => !v)} className="shrink-0 -ml-1 p-0.5 text-text-muted hover:text-text-primary transition-colors" title={recolhido ? 'Expandir' : 'Recolher'}>
            {recolhido ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        ) : null}

        <button
          onClick={() => h.onAlternar(item)}
          title={concluido ? 'Desmarcar' : 'Marcar como feito'}
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            concluido
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-text-muted/50 hover:border-btn-primary hover:bg-btn-primary/5'
          }`}
        >
          {concluido && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        {renomeando ? (
          <form onSubmit={submitRenome} className="flex-1 min-w-0 flex gap-1">
            <input
              autoFocus
              value={novoTitulo}
              onChange={e => setNovoTitulo(e.target.value)}
              onBlur={submitRenome}
              onKeyDown={e => { if (e.key === 'Escape') setRenomeando(false) }}
              className="flex-1 min-w-0 px-1.5 py-0.5 bg-surface-sunken border border-border rounded text-sm text-text-primary focus:outline-none focus:border-btn-primary"
            />
          </form>
        ) : (
          <span className={`flex-1 min-w-0 truncate text-sm ${concluido ? 'text-text-muted line-through' : 'text-text-primary'}`}>
            {item.titulo}
          </span>
        )}

        {ehPai && (
          <span className={`shrink-0 text-xs font-mono ${concluido ? 'text-green-600' : 'text-text-secondary'}`}>
            {feitas}/{folhas!.length}
          </span>
        )}

        {item.prazo && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              vencido ? 'bg-red-100 text-red-700' : concluido ? 'text-text-muted' : 'bg-surface-sunken text-text-secondary'
            }`}
            title={vencido ? 'Prazo vencido' : 'Prazo'}
          >
            <CalendarDays className="w-3 h-3" /> {formatPrazo(item.prazo)}
          </span>
        )}

        {item.responsavel && (
          <span
            className="shrink-0 w-5 h-5 rounded-full bg-btn-primary/15 text-btn-primary text-[10px] font-bold uppercase flex items-center justify-center"
            title={`Responsável: ${item.responsavel}`}
          >
            {item.responsavel.slice(0, 2)}
          </span>
        )}

        {!ehPai && item.concluido && item.concluido_por && (
          <span className="text-xs text-text-secondary capitalize shrink-0">{item.concluido_por}</span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {nivel < NIVEL_MAX && (
            <button onClick={() => { setAddindo(v => !v); setRecolhido(false) }} title="Adicionar subtarefa" className="p-0.5 text-text-secondary hover:text-btn-primary transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { setMetaPrazo(item.prazo?.slice(0, 10) ?? ''); setMetaResp(item.responsavel ?? ''); setEditandoMeta(v => !v) }}
            title="Prazo e responsável"
            className="p-0.5 text-text-secondary hover:text-btn-primary transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setNovoTitulo(item.titulo); setRenomeando(true) }} title="Renomear" className="p-0.5 text-text-secondary hover:text-text-primary transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (ehPai && !confirm(`Excluir "${item.titulo}" e suas ${filhosDiretos.length}+ subtarefas?`)) return
              h.onRemover(item)
            }}
            title="Remover"
            className="p-0.5 text-text-secondary hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editandoMeta && (
        <form onSubmit={submitMeta} className="flex items-center gap-2 py-1.5 pr-4 bg-surface-sunken/60" style={{ paddingLeft: `${16 + nivel * 20 + 24}px` }}>
          <CalendarDays className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            type="date"
            value={metaPrazo}
            onChange={e => setMetaPrazo(e.target.value)}
            className="px-1.5 py-0.5 bg-white border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-btn-primary"
          />
          <UserRound className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <select
            value={metaResp}
            onChange={e => setMetaResp(e.target.value)}
            className="px-1.5 py-0.5 bg-white border border-border rounded text-xs text-text-primary capitalize focus:outline-none focus:border-btn-primary"
          >
            <option value="">sem responsável</option>
            {h.usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button type="submit" className="px-2 py-0.5 bg-btn-primary text-white rounded text-xs font-semibold hover:bg-btn-primary-hover transition-colors">OK</button>
          <button type="button" onClick={() => setEditandoMeta(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancelar</button>
        </form>
      )}

      {addindo && (
        <form onSubmit={submitSub} className="flex items-center gap-2 py-1.5 pr-4" style={{ paddingLeft: `${16 + (nivel + 1) * 20}px` }}>
          <input
            autoFocus
            value={subTitulo}
            onChange={e => setSubTitulo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAddindo(false); setSubTitulo('') } }}
            placeholder="Nova subtarefa..."
            className="flex-1 min-w-0 px-2 py-1 bg-surface-sunken border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
          />
          <button type="submit" disabled={!subTitulo.trim()} className="shrink-0 px-2 py-1 bg-btn-primary text-white rounded hover:bg-btn-primary-hover transition-colors disabled:opacity-30">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {!recolhido && filhosDiretos.map(f => (
        <TarefaLinha key={f.id} item={f} nivel={nivel + 1} h={h} />
      ))}
    </div>
  )
}
