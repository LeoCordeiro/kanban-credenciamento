'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { ChecklistItem } from '@/types/kanban'
import { Check, Plus, Trash2, ListChecks } from 'lucide-react'

export function Checklist({ empresaId }: { empresaId: string }) {
  const { usuario } = useAuth()
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [novo, setNovo] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('checklist_itens')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('ordem')
      .order('created_at')
    if (data) setItens(data)
  }, [empresaId])

  useEffect(() => {
    carregar()

    const ch = supabase.channel(`checklist-${empresaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens', filter: `empresa_id=eq.${empresaId}` }, () => carregar())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [empresaId, carregar])

  async function alternar(item: ChecklistItem) {
    const concluido = !item.concluido
    const patch = {
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
      concluido_por: concluido ? usuario?.nome ?? null : null,
    }
    setItens(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))
    await supabase.from('checklist_itens').update(patch).eq('id', item.id)
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const titulo = novo.trim()
    if (!titulo) return
    setNovo('')
    await supabase.from('checklist_itens').insert({
      empresa_id: empresaId,
      titulo,
      ordem: itens.length,
    })
    carregar()
  }

  async function remover(id: string) {
    setItens(prev => prev.filter(i => i.id !== id))
    await supabase.from('checklist_itens').delete().eq('id', id)
  }

  /** Marca tudo que falta; com tudo já feito, o mesmo botão desmarca. */
  async function alternarTodos() {
    const marcar = itens.some(i => !i.concluido)
    const alvos = itens.filter(i => i.concluido !== marcar).map(i => i.id)
    if (alvos.length === 0) return

    const patch = {
      concluido: marcar,
      concluido_em: marcar ? new Date().toISOString() : null,
      concluido_por: marcar ? usuario?.nome ?? null : null,
    }
    setItens(prev => prev.map(i => alvos.includes(i.id) ? { ...i, ...patch } : i))
    await supabase.from('checklist_itens').update(patch).in('id', alvos)
  }

  const feitos = itens.filter(i => i.concluido).length
  const total = itens.length
  const pct = total ? Math.round((feitos / total) * 100) : 0

  const completo = feitos === total && total > 0

  return (
    <section className="bg-white border border-border rounded-xl shadow-sm overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-transparent">
        <ListChecks className="w-3.5 h-3.5 text-text-muted" />
        <h2 className="text-base font-semibold text-text-primary">Checklist</h2>
        <div className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={alternarTodos}
              className="text-xs font-medium text-btn-primary hover:underline shrink-0"
              title={completo ? 'Desmarcar todos os itens' : 'Marcar todos os itens como feitos'}
            >
              {completo ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          )}
          {/* Barra de progresso na própria linha do título: informa o mesmo
              sem gastar uma faixa de altura só para ela. */}
          <div className="w-24 h-1 bg-[#f4f5f7] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${completo ? 'bg-green-500' : 'bg-btn-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-sm font-mono font-semibold ${completo ? 'text-green-600' : 'text-text-secondary'}`}>
            {feitos}/{total}
          </span>
        </div>
      </div>

      {/* Teto para o checklist não empurrar a coluna inteira quando a empresa
          acumula muitos itens — a lista rola em si mesma. */}
      <div className="scroll-fino max-h-[40vh] overflow-y-auto divide-y divide-border">
        {itens.map(item => (
          <div key={item.id} className="group flex items-center gap-2 px-4 py-2 hover:bg-card-hover transition-colors">
            <button
              onClick={() => alternar(item)}
              title={item.concluido ? 'Desmarcar' : 'Marcar como feito'}
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                item.concluido
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-text-muted/50 hover:border-btn-primary hover:bg-btn-primary/5'
              }`}
            >
              {item.concluido && <Check className="w-3 h-3" strokeWidth={3} />}
            </button>

            <span className={`flex-1 min-w-0 truncate text-sm ${item.concluido ? 'text-text-muted line-through' : 'text-text-primary'}`}>
              {item.titulo}
            </span>

            {item.concluido && item.concluido_por && (
              <span className="text-xs text-text-secondary capitalize shrink-0">{item.concluido_por}</span>
            )}

            <button
              onClick={() => remover(item.id)}
              title="Remover item"
              className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {total === 0 && <p className="text-sm text-text-secondary px-4 py-3">Nenhum item no checklist.</p>}
      </div>

      <form onSubmit={adicionar} className="flex gap-2 border-t border-border p-3">
        <input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          placeholder="Adicionar item..."
          className="flex-1 min-w-0 px-2 py-1 bg-[#f4f5f7] border border-border rounded text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary focus:ring-2 focus:ring-btn-primary/20 transition-colors"
        />
        <button
          type="submit"
          disabled={!novo.trim()}
          className="shrink-0 px-2 bg-btn-primary text-white rounded hover:bg-btn-primary-hover transition-colors disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </section>
  )
}
