'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SlaColuna, COLUNAS } from '@/types/kanban'
import { Modal } from '@/components/ui/Modal'

/** Edita as regras globais (plataforma_id null). O schema já aceita regra por
 *  plataforma; a UI só expõe a global por enquanto. */
export function SlaConfigModal({ slas, onClose }: { slas: SlaColuna[]; onClose: () => void }) {
  const globais = slas.filter(s => s.plataforma_id === null)
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(COLUNAS.map(c => [c.id, String(globais.find(s => s.coluna === c.id)?.max_dias ?? '')]))
  )
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    for (const c of COLUNAS) {
      const dias = parseInt(valores[c.id], 10)
      const existente = globais.find(s => s.coluna === c.id)
      if (dias > 0) {
        if (existente) {
          if (existente.max_dias !== dias) await supabase.from('sla_colunas').update({ max_dias: dias }).eq('id', existente.id)
        } else {
          await supabase.from('sla_colunas').insert({ plataforma_id: null, coluna: c.id, max_dias: dias })
        }
      } else if (existente) {
        await supabase.from('sla_colunas').delete().eq('id', existente.id)
      }
    }
    setSalvando(false)
    onClose()
  }

  return (
    <Modal titulo="SLA por coluna" onClose={onClose} maxWidth="max-w-sm">
      <div className="p-5 space-y-3">
        <p className="text-xs text-text-secondary">
          Dias máximos que um card pode ficar parado em cada coluna. Estourou, o card ganha destaque no board e entra em Atrasos. Vazio = sem SLA.
        </p>
        {COLUNAS.map(c => (
          <div key={c.id} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
            <span className="flex-1 text-sm text-text-primary">{c.nome}</span>
            <input
              type="number"
              min={1}
              value={valores[c.id]}
              onChange={e => setValores(p => ({ ...p, [c.id]: e.target.value }))}
              placeholder="—"
              className="w-16 px-2 py-1 bg-surface-sunken border border-border rounded-lg text-sm font-mono text-text-primary text-center placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
            />
            <span className="text-xs text-text-muted w-8">dias</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-border">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-4 py-1.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors disabled:opacity-40"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}
