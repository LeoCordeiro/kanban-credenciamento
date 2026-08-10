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

  const feitos = itens.filter(i => i.concluido).length
  const total = itens.length
  const pct = total ? Math.round((feitos / total) * 100) : 0

  return (
    <section className="bg-white border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-text-muted" /> Checklist
        </h2>
        <span className={`text-sm font-semibold ${feitos === total && total > 0 ? 'text-green-600' : 'text-text-secondary'}`}>
          {feitos}/{total}
        </span>
      </div>

      <div className="h-1.5 bg-[#f4f5f7] rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all ${feitos === total && total > 0 ? 'bg-green-500' : 'bg-btn-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1 mb-4">
        {itens.map(item => (
          <div key={item.id} className="group flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#f4f5f7] transition-colors">
            <button
              onClick={() => alternar(item)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                item.concluido
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-border hover:border-btn-primary'
              }`}
            >
              {item.concluido && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </button>

            <span className={`flex-1 text-base ${item.concluido ? 'text-text-muted line-through' : 'text-text-primary'}`}>
              {item.titulo}
            </span>

            {item.concluido && item.concluido_por && (
              <span className="text-xs text-text-muted capitalize shrink-0">{item.concluido_por}</span>
            )}

            <button
              onClick={() => remover(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {total === 0 && <p className="text-base text-text-muted">Nenhum item no checklist.</p>}
      </div>

      <form onSubmit={adicionar} className="flex gap-2">
        <input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          placeholder="Adicionar item..."
          className="flex-1 px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
        />
        <button
          type="submit"
          disabled={!novo.trim()}
          className="p-2 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>
    </section>
  )
}
