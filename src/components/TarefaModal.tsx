'use client'

import { useState } from 'react'
import { Tarefa, Prioridade, StatusTarefa, PRIORIDADES, STATUS_TAREFA, Documento } from '@/types/kanban'
import { prazoVencido, formatPrazoCompleto, paraInputDateTime, formatHoras } from '@/lib/tarefas'
import { Modal } from '@/components/ui/Modal'
import { CAMPO_LABEL, INPUT } from '@/components/ui/Painel'
import { CalendarDays, UserRound, Flag, Trash2, CornerDownRight, BookOpen, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

/** Documentação vinculada: título sempre visível, conteúdo sob demanda. */
function DocumentoAcordeao({ doc }: { doc: Documento }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-sunken">
        {doc.conteudo ? (
          <button type="button" onClick={() => setAberto(v => !v)} className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
            {aberto ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />}
            <span className="truncate text-sm font-medium text-text-primary">{doc.titulo}</span>
          </button>
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary pl-5">{doc.titulo}</span>
        )}
        {doc.categoria && <span className="shrink-0 px-1.5 py-0.5 rounded bg-white text-[10px] font-medium text-text-secondary border border-border">{doc.categoria}</span>}
        {doc.url && (
          <a
            href={doc.url.startsWith('http') ? doc.url : `https://${doc.url}`}
            target="_blank"
            rel="noopener noreferrer"
            title={doc.url}
            className="shrink-0 text-btn-primary hover:text-btn-primary-hover"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      {aberto && doc.conteudo && (
        <p className="px-3 py-2 text-sm text-text-primary leading-relaxed whitespace-pre-wrap border-t border-border">{doc.conteudo}</p>
      )}
    </div>
  )
}

export interface PatchTarefa {
  titulo?: string
  descricao?: string | null
  prioridade?: Prioridade
  status?: StatusTarefa
  prazo?: string | null
  responsavel?: string | null
}

/** Painel de detalhe da tarefa — onde todos os campos são editados de uma vez. */
export function TarefaModal({ tarefa, caminho, ehPai, usuarios, onSalvar, onRemover, onClose }: {
  tarefa: Tarefa
  /** Trilha até a tarefa: ["Criar Site", "Contratar hospedagem"]. */
  caminho: string[]
  ehPai: boolean
  usuarios: string[]
  onSalvar: (patch: PatchTarefa) => Promise<void>
  onRemover: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? '',
    prioridade: tarefa.prioridade,
    status: tarefa.status,
    prazo: paraInputDateTime(tarefa.prazo),
    responsavel: tarefa.responsavel ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  // O input datetime-local devolve hora local sem fuso; new Date() a interpreta
  // como local, que é o que o usuário quis dizer ao digitar.
  const prazoISO = form.prazo ? new Date(form.prazo).toISOString() : null
  const vencido = prazoVencido(prazoISO, form.status === 'concluido')
  const instrucoes = tarefa.modelo?.instrucoes
  const docs = (tarefa.modelo?.docs ?? []).map(d => d.documento).filter(Boolean) as Documento[]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)
    await onSalvar({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      prioridade: form.prioridade,
      status: form.status,
      prazo: prazoISO,
      responsavel: form.responsavel || null,
    })
    setSalvando(false)
    onClose()
  }

  return (
    <Modal titulo="Tarefa" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={salvar} className="flex-1 overflow-y-auto p-5 space-y-4">
        {caminho.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-text-muted -mt-1">
            <CornerDownRight className="w-3 h-3 shrink-0" />
            {caminho.join(' › ')}
          </p>
        )}

        <div>
          <label className={CAMPO_LABEL}>Título *</label>
          <input
            required
            autoFocus
            value={form.titulo}
            onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
            className={`${INPUT} text-base font-medium`}
          />
        </div>

        {/* Instruções vêm do tipo de tarefa e valem para todas as empresas —
            editar aqui empresa por empresa era exatamente o que atrapalhava. */}
        {instrucoes && (
          <div className="rounded-lg border border-border bg-surface-sunken p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Instruções desta tarefa
            </p>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{instrucoes}</p>
            <p className="mt-2 text-xs text-text-muted">
              Escritas em <a href="/tarefas" className="text-btn-primary hover:underline">Tarefas</a> e válidas para todas as empresas.
            </p>
          </div>
        )}

        {/* Documentação de consulta do tipo — aberta aqui para não obrigar a
            sair da tarefa para procurar como se faz. */}
        {docs.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <BookOpen className="w-3.5 h-3.5" /> Documentação
            </p>
            {docs.map(d => <DocumentoAcordeao key={d.id} doc={d} />)}
          </div>
        )}

        <div>
          <label className={CAMPO_LABEL}>Observações desta empresa</label>
          <textarea
            value={form.descricao}
            onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
            rows={3}
            placeholder="O que muda nesta empresa: número do protocolo, quem atendeu, pendência específica..."
            className={`${INPUT} resize-y leading-relaxed`}
          />
        </div>

        <div>
          <label className={CAMPO_LABEL}>Status</label>
          {ehPai ? (
            <p className="text-xs text-text-secondary bg-surface-sunken border border-border rounded-lg px-3 py-2">
              Esta tarefa tem subtarefas — o status dela vem do andamento das filhas.
            </p>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_TAREFA.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, status: s.id }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    form.status === s.id
                      ? `${s.chip} border-transparent ring-2 ring-offset-1 ring-btn-primary/40`
                      : 'bg-white text-text-secondary border-border hover:text-text-primary'
                  }`}
                >
                  {s.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={CAMPO_LABEL}><Flag className="inline w-3 h-3 mb-0.5" /> Prioridade</label>
            <select
              value={form.prioridade}
              onChange={e => setForm(p => ({ ...p, prioridade: e.target.value as Prioridade }))}
              className={INPUT}
            >
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={CAMPO_LABEL}><CalendarDays className="inline w-3 h-3 mb-0.5" /> Prazo</label>
            <input
              type="datetime-local"
              value={form.prazo}
              onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))}
              className={`${INPUT} font-mono ${vencido ? 'border-red-400 text-red-700' : ''}`}
            />
            {vencido && prazoISO && <p className="mt-0.5 text-xs text-red-600">Venceu em {formatPrazoCompleto(prazoISO)}</p>}
            {tarefa.sla_horas != null && (
              <p className="mt-0.5 text-xs text-text-muted">SLA do tipo: {formatHoras(tarefa.sla_horas)}</p>
            )}
          </div>
          <div>
            <label className={CAMPO_LABEL}><UserRound className="inline w-3 h-3 mb-0.5" /> Responsável</label>
            <select
              value={form.responsavel}
              onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))}
              className={`${INPUT} capitalize`}
            >
              <option value="">ninguém</option>
              {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {tarefa.concluido && tarefa.concluido_por && (
          <p className="text-xs text-text-secondary">
            Concluída por <span className="capitalize font-medium">{tarefa.concluido_por}</span>
            {tarefa.concluido_em && ` em ${formatPrazoCompleto(tarefa.concluido_em)}`}
          </p>
        )}
      </form>

      <div className="flex items-center gap-2 p-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => { onRemover(); onClose() }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-text-secondary hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Excluir
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
