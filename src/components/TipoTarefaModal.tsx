'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChecklistModeloItem, Prioridade, PRIORIDADES, Documento, Plataforma } from '@/types/kanban'
import { formatHoras } from '@/lib/tarefas'
import { Modal } from '@/components/ui/Modal'
import { CAMPO_LABEL, INPUT } from '@/components/ui/Painel'
import { Timer, Flag, Trash2, Info, BookOpen, LayoutGrid, Check, ExternalLink, CornerDownRight } from 'lucide-react'

export interface PatchTipo {
  titulo?: string
  instrucoes?: string | null
  prioridade?: Prioridade
  sla_horas?: number | null
}

/**
 * Editor do TIPO de tarefa. O que se define aqui vale para todas as empresas —
 * instruções, documentação de consulta e em quais quadros a tarefa existe.
 */
export function TipoTarefaModal({ tipo, pai, documentos, plataformas, onSalvar, onRemover, onClose }: {
  tipo: ChecklistModeloItem
  /** Preenchido quando este tipo é uma subtarefa. */
  pai?: ChecklistModeloItem
  documentos: Documento[]
  plataformas: Plataforma[]
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
  const [docsSel, setDocsSel] = useState<Set<string>>(new Set())
  const [platsSel, setPlatsSel] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('checklist_modelo_documento').select('documento_id').eq('modelo_id', tipo.id),
      supabase.from('checklist_modelo_plataforma').select('plataforma_id').eq('modelo_id', tipo.id),
    ]).then(([{ data: d }, { data: p }]) => {
      setDocsSel(new Set((d ?? []).map((x: { documento_id: string }) => x.documento_id)))
      setPlatsSel(new Set((p ?? []).map((x: { plataforma_id: string }) => x.plataforma_id)))
    })
  }, [tipo.id])

  const horas = parseInt(form.sla_horas, 10)
  const restrito = platsSel.size > 0

  function alternar(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

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

    // Apaga e regrava os vínculos: são poucas linhas e evita diff manual.
    await supabase.from('checklist_modelo_documento').delete().eq('modelo_id', tipo.id)
    if (docsSel.size > 0) {
      await supabase.from('checklist_modelo_documento')
        .insert([...docsSel].map(documento_id => ({ modelo_id: tipo.id, documento_id })))
    }
    // Subtarefa não tem escopo próprio: herda o da tarefa-mãe.
    if (!pai) {
      await supabase.from('checklist_modelo_plataforma').delete().eq('modelo_id', tipo.id)
      if (platsSel.size > 0) {
        await supabase.from('checklist_modelo_plataforma')
          .insert([...platsSel].map(plataforma_id => ({ modelo_id: tipo.id, plataforma_id })))
      }
    }

    setSalvando(false)
    onClose()
  }

  return (
    <Modal titulo={pai ? 'Subtarefa' : 'Tipo de tarefa'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={salvar} className="flex-1 overflow-y-auto p-5 space-y-4">
        {pai && (
          <p className="flex items-center gap-1.5 text-xs text-text-secondary -mt-1">
            <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
            Subtarefa de <span className="font-semibold text-text-primary">{pai.titulo}</span>
          </p>
        )}

        <div>
          <label className={CAMPO_LABEL}>{pai ? 'Nome da subtarefa *' : 'Nome da tarefa *'}</label>
          <input
            required
            autoFocus
            value={form.titulo}
            onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
            className={`${INPUT} text-base font-medium`}
          />
        </div>

        <div>
          <label className={CAMPO_LABEL}>Instruções — o que fazer nesta {pai ? 'subtarefa' : 'tarefa'}</label>
          <textarea
            value={form.instrucoes}
            onChange={e => setForm(p => ({ ...p, instrucoes: e.target.value }))}
            rows={7}
            placeholder={'Passo a passo, links, onde acessar, o que entregar...\n\nEx:\n1. Entrar no Registro.br com a conta da empresa\n2. Conferir se o domínio .com.br está livre\n3. Registrar em nome do CNPJ do cliente'}
            className={`${INPUT} resize-y leading-relaxed`}
          />
          <p className="mt-1 flex items-start gap-1.5 text-xs text-text-secondary">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Aparece em todas as empresas que têm esta {pai ? 'subtarefa' : 'tarefa'}. Escreve aqui uma vez e vale para todas —
            inclusive as que já existem.
          </p>
        </div>

        {/* Documentação de consulta: abre junto com a tarefa na ficha da empresa. */}
        <div>
          <label className={CAMPO_LABEL}>
            <BookOpen className="inline w-3 h-3 mb-0.5" /> Documentação vinculada
            {docsSel.size > 0 && <span className="ml-1 text-btn-primary font-semibold">{docsSel.size} selecionada{docsSel.size > 1 ? 's' : ''}</span>}
          </label>
          {documentos.length === 0 ? (
            <p className="text-xs text-text-secondary bg-surface-sunken border border-border rounded-lg px-3 py-2">
              Nenhuma documentação cadastrada ainda. Crie em <a href="/documentacoes" className="text-btn-primary hover:underline">Documentações</a>.
            </p>
          ) : (
            <div className="scroll-fino max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {documentos.map(d => {
                const on = docsSel.has(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => alternar(docsSel, setDocsSel, d.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${on ? 'bg-btn-primary/5' : 'hover:bg-card-hover'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-btn-primary border-btn-primary text-white' : 'border-text-muted/50'}`}>
                      {on && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm text-text-primary">{d.titulo}</span>
                    {d.categoria && <span className="shrink-0 px-1.5 py-0.5 rounded bg-surface-sunken text-[10px] font-medium text-text-secondary">{d.categoria}</span>}
                    {d.url && <ExternalLink className="w-3 h-3 text-text-muted shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-text-secondary">
            Quem abrir esta tarefa numa empresa vê a documentação junto, sem precisar procurar.
          </p>
        </div>

        {/* Restrição por quadro: a tarefa só existe para empresa naquelas plataformas.
            Subtarefa não escolhe — ela acompanha a tarefa a que pertence, senão
            existiriam subtarefas órfãs em quadros onde a mãe nem aparece. */}
        {pai ? (
          <p className="flex items-start gap-1.5 text-xs text-text-secondary rounded-lg border border-border bg-surface-sunken px-3 py-2">
            <LayoutGrid className="w-3.5 h-3.5 shrink-0 mt-px" />
            Esta subtarefa acompanha os quadros de <span className="font-semibold text-text-primary">{pai.titulo}</span>.
          </p>
        ) : (
        <div>
          <label className={CAMPO_LABEL}>
            <LayoutGrid className="inline w-3 h-3 mb-0.5" /> Onde esta tarefa vale
          </label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            <button
              type="button"
              onClick={() => setPlatsSel(new Set())}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                !restrito ? 'bg-btn-primary text-white border-transparent' : 'bg-white text-text-secondary border-border hover:text-text-primary'
              }`}
            >
              Todas as plataformas
            </button>
            {plataformas.map(p => {
              const on = platsSel.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternar(platsSel, setPlatsSel, p.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    on ? 'text-white border-transparent' : 'bg-white text-text-secondary border-border hover:text-text-primary'
                  }`}
                  style={on ? { backgroundColor: p.cor } : undefined}
                >
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                  {p.nome}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-text-secondary">
            {restrito
              ? 'Só as empresas vinculadas a esses quadros recebem esta tarefa — e ela é criada quando a empresa entra no quadro.'
              : 'Toda empresa recebe esta tarefa, em qualquer quadro.'}
          </p>
        </div>
        )}

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
                ? `A tarefa nasce com prazo de ${formatHoras(horas)}.`
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
