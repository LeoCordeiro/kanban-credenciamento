'use client'

import { useState } from 'react'
import { ChecklistModeloItem, Prioridade, PRIORIDADES } from '@/types/kanban'
import { formatHoras } from '@/lib/tarefas'
import { Modal } from '@/components/ui/Modal'
import { CAMPO_LABEL, INPUT } from '@/components/ui/Painel'
import { Timer, Flag, Trash2, Info } from 'lucide-react'

export interface PatchTipo {
  titulo?: string
  instrucoes?: string | null
  prioridade?: Prioridade
  sla_horas?: number | null
}

/**
 * Editor do TIPO de tarefa. O que se escreve aqui vale para todas as empresas —
 * é o motivo de existir esta tela: instrução escrita uma vez, não empresa a empresa.
 */
export function TipoTarefaModal({ tipo, onSalvar, onRemover, onClose }: {
  tipo: ChecklistModeloItem
  onSalvar: (patch: PatchTipo) => Promise<void>
  onRemover: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    titulo: tipo.titulo,
    instrucoes: tipo.instrucoes ?? '',
    prioridade: tipo.prioridade,
    sla_horas: tipo.sla_horas != null ? String(tipo.sla_horas) : '',
  })
  const [salvando, setSalvando] = useState(false)

  const horas = parseInt(form.sla_horas, 10)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)
    await onSalvar({
      titulo: form.titulo.trim(),
      instrucoes: form.instrucoes.trim() || null,
      prioridade: form.prioridade,
      sla_horas: horas > 0 ? horas : null,
    })
    setSalvando(false)
    onClose()
  }

  return (
    <Modal titulo="Tipo de tarefa" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={salvar} className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <label className={CAMPO_LABEL}>Nome da tarefa *</label>
          <input
            required
            autoFocus
            value={form.titulo}
            onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
            className={`${INPUT} text-base font-medium`}
          />
        </div>

        <div>
          <label className={CAMPO_LABEL}>Instruções — o que fazer nesta tarefa</label>
          <textarea
            value={form.instrucoes}
            onChange={e => setForm(p => ({ ...p, instrucoes: e.target.value }))}
            rows={9}
            placeholder={'Passo a passo, links, onde acessar, o que entregar...\n\nEx:\n1. Entrar no Registro.br com a conta da empresa\n2. Conferir se o domínio .com.br está livre\n3. Registrar em nome do CNPJ do cliente'}
            className={`${INPUT} resize-y leading-relaxed`}
          />
          <p className="mt-1 flex items-start gap-1.5 text-xs text-text-secondary">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Aparece em todas as empresas que têm esta tarefa. Escreve aqui uma vez e vale para todas —
            inclusive as que já existem.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={CAMPO_LABEL}><Timer className="inline w-3 h-3 mb-0.5" /> SLA em horas</label>
            <input
              type="number"
              min={1}
              value={form.sla_horas}
              onChange={e => setForm(p => ({ ...p, sla_horas: e.target.value }))}
              placeholder="sem prazo"
              className={`${INPUT} font-mono`}
            />
            <p className="mt-0.5 text-xs text-text-muted">
              {horas > 0
                ? `A tarefa nasce com prazo de ${formatHoras(horas)} depois do cadastro da empresa.`
                : 'Sem SLA: a tarefa nasce sem prazo.'}
            </p>
          </div>
          <div>
            <label className={CAMPO_LABEL}><Flag className="inline w-3 h-3 mb-0.5" /> Prioridade padrão</label>
            <select
              value={form.prioridade}
              onChange={e => setForm(p => ({ ...p, prioridade: e.target.value as Prioridade }))}
              className={INPUT}
            >
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
      </form>

      <div className="flex items-center gap-2 p-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => { onRemover(); onClose() }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-text-secondary hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remover do modelo
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando || !form.titulo.trim()}
            className="px-4 py-1.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors disabled:opacity-40"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
