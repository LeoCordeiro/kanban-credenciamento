'use client'

import { useState } from 'react'
import { Tarefa, PRIORIDADES, STATUS_TAREFA } from '@/types/kanban'
import { folhasDe, estadoEfetivo, statusEfetivo, prazoVencido, formatPrazo, formatPrazoCompleto } from '@/lib/tarefas'
import { Check, Plus, ChevronRight, ChevronDown, CalendarDays, AlignLeft, BookOpen } from 'lucide-react'

/** Profundidade máxima abaixo da empresa: etapa (0) → subtarefa (1) → sub-subtarefa (2). */
const NIVEL_MAX = 2

/** Caixa do chevron. O espacador do item sem subtarefa usa a MESMA medida: sem
 *  ele, o `else` vazio puxava checkbox e titulo 22px para a esquerda e a lista
 *  alternava entre duas colunas. */
const CAIXA_CHEVRON = 'shrink-0 -ml-1 w-[18px] flex items-center justify-center'

export interface TarefaHandlers {
  filhos: Map<string, Tarefa[]>
  onAlternar: (item: Tarefa) => void
  onAddSub: (parentId: string, titulo: string) => Promise<void>
  onAbrir: (item: Tarefa) => void
}

export function TarefaLinha({ item, nivel, h }: { item: Tarefa; nivel: number; h: TarefaHandlers }) {
  const [recolhido, setRecolhido] = useState(false)
  const [addindo, setAddindo] = useState(false)
  const [subTitulo, setSubTitulo] = useState('')

  const filhosDiretos = h.filhos.get(item.id) ?? []
  const ehPai = filhosDiretos.length > 0
  const concluido = ehPai ? estadoEfetivo(item, h.filhos) : item.concluido
  const status = statusEfetivo(item, h.filhos)
  const folhas = ehPai ? folhasDe(item, h.filhos) : null
  const feitas = folhas ? folhas.filter(f => f.concluido).length : 0
  const vencido = prazoVencido(item.prazo, concluido)

  const prio = PRIORIDADES.find(p => p.id === item.prioridade)
  const st = STATUS_TAREFA.find(s => s.id === status)
  // "A fazer" e "Concluído" já se leem no checkbox — só os estados do meio viram chip.
  const mostraStatus = status === 'fazendo' || status === 'bloqueado'
  const mostraPrio = !concluido && (item.prioridade === 'alta' || item.prioridade === 'urgente')

  async function submitSub(e: React.FormEvent) {
    e.preventDefault()
    const t = subTitulo.trim()
    if (!t) return
    setSubTitulo('')
    setAddindo(false)
    setRecolhido(false)
    await h.onAddSub(item.id, t)
  }

  return (
    <div>
      <div className="group flex items-center gap-2 px-4 py-2 hover:bg-card-hover transition-colors" style={{ paddingLeft: `${16 + nivel * 20}px` }}>
        {ehPai ? (
          <button onClick={() => setRecolhido(v => !v)} className={`${CAIXA_CHEVRON} text-text-muted hover:text-text-primary transition-colors`} title={recolhido ? 'Expandir' : 'Recolher'}>
            {recolhido ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className={CAIXA_CHEVRON} aria-hidden="true" />
        )}

        <button
          onClick={() => h.onAlternar(item)}
          title={concluido ? 'Desmarcar' : 'Marcar como feito'}
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            concluido
              ? 'bg-green-500 border-green-500 text-white'
              : status === 'bloqueado'
                ? 'border-red-400 hover:bg-red-50'
                : status === 'fazendo'
                  ? 'border-btn-primary hover:bg-btn-primary/5'
                  : 'border-text-muted/50 hover:border-btn-primary hover:bg-btn-primary/5'
          }`}
        >
          {concluido && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        <button
          onClick={() => h.onAbrir(item)}
          title="Abrir tarefa"
          className={`flex-1 min-w-0 truncate text-left text-sm hover:underline ${concluido ? 'text-text-muted line-through' : 'text-text-primary'}`}
        >
          {item.titulo}
        </button>

        {(item.descricao || item.modelo?.instrucoes) && (
          <AlignLeft
            className="w-3 h-3 text-text-muted shrink-0"
            aria-label={item.modelo?.instrucoes ? 'Tem instruções' : 'Tem observação'}
          />
        )}

        {(item.modelo?.docs?.length ?? 0) > 0 && (
          <BookOpen className="w-3 h-3 text-btn-primary shrink-0" aria-label="Tem documentação vinculada" />
        )}

        {ehPai && (
          <span className={`shrink-0 text-xs font-mono ${concluido ? 'text-green-600' : 'text-text-secondary'}`}>
            {feitas}/{folhas!.length}
          </span>
        )}

        {mostraStatus && st && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.chip}`}>{st.nome}</span>
        )}

        {mostraPrio && prio && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${prio.chip}`} title={`Prioridade ${prio.nome}`}>
            {prio.nome}
          </span>
        )}

        {item.prazo && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              vencido ? 'bg-red-100 text-red-700' : concluido ? 'text-text-muted' : 'bg-surface-sunken text-text-secondary'
            }`}
            title={`${vencido ? 'Venceu' : 'Prazo'}: ${formatPrazoCompleto(item.prazo)}`}
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

        {nivel < NIVEL_MAX && (
          <button
            onClick={() => { setAddindo(v => !v); setRecolhido(false) }}
            title="Adicionar subtarefa"
            className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-btn-primary transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

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
