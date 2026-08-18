'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Tarefa, Usuario } from '@/types/kanban'
import { montarArvore, folhasDe, estadoEfetivo, idsComDescendentes, caminhoAte } from '@/lib/tarefas'
import { TarefaLinha, TarefaHandlers } from '@/components/TarefaLinha'
import { TarefaModal, PatchTarefa } from '@/components/TarefaModal'
import { Plus, ListChecks } from 'lucide-react'

export function Checklist({ empresaId }: { empresaId: string }) {
  const { usuario } = useAuth()
  const [itens, setItens] = useState<Tarefa[]>([])
  const [usuarios, setUsuarios] = useState<string[]>([])
  const [novo, setNovo] = useState('')
  const [abertaId, setAbertaId] = useState<string | null>(null)

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
    supabase.rpc('listar_usuarios').then(({ data }) => {
      if (data) setUsuarios((data as Usuario[]).filter(u => u.ativo !== false).map(u => u.nome))
    })

    const ch = supabase.channel(`checklist-${empresaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens', filter: `empresa_id=eq.${empresaId}` }, () => carregar())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [empresaId, carregar])

  const filhos = montarArvore(itens)
  const raizes = filhos.get('raiz') ?? []

  async function alternar(item: Tarefa) {
    const ehPai = (filhos.get(item.id) ?? []).length > 0
    const concluido = ehPai ? !estadoEfetivo(item, filhos) : !item.concluido
    const patch = {
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
      concluido_por: concluido ? usuario?.nome ?? null : null,
    }
    // Pai cascateia para todos os descendentes num único update.
    const ids = ehPai
      ? idsComDescendentes(item, filhos).filter(id => {
          const t = itens.find(i => i.id === id)
          return t && t.concluido !== concluido
        })
      : [item.id]
    if (ids.length === 0) return
    // O status quem alinha é a trigger no banco; aqui espelhamos a mesma regra
    // para a linha não piscar com o chip velho até o realtime chegar.
    setItens(prev => prev.map(i => ids.includes(i.id)
      ? { ...i, ...patch, status: concluido ? 'concluido' : (i.status === 'concluido' ? 'a_fazer' : i.status) }
      : i))
    await supabase.from('checklist_itens').update(patch).in('id', ids)
  }

  async function addSub(parentId: string, titulo: string) {
    await supabase.from('checklist_itens').insert({
      empresa_id: empresaId,
      titulo,
      parent_id: parentId,
      ordem: (filhos.get(parentId) ?? []).length,
    })
    carregar()
  }

  async function salvarTarefa(item: Tarefa, patch: PatchTarefa) {
    // Status vindo do modal também mexe na autoria da conclusão; o banco cuida
    // de manter `concluido` alinhado (trigger sync_status_concluido).
    const completo: Record<string, unknown> = { ...patch }
    if (patch.status && patch.status !== item.status) {
      const virouFeito = patch.status === 'concluido'
      completo.concluido_em = virouFeito ? new Date().toISOString() : null
      completo.concluido_por = virouFeito ? usuario?.nome ?? null : null
    }
    setItens(prev => prev.map(i => i.id === item.id
      ? { ...i, ...patch, concluido: patch.status ? patch.status === 'concluido' : i.concluido } as Tarefa
      : i))
    await supabase.from('checklist_itens').update(completo).eq('id', item.id)
  }

  async function remover(item: Tarefa) {
    const ids = idsComDescendentes(item, filhos)
    setItens(prev => prev.filter(i => !ids.includes(i.id)))
    // on delete cascade do banco remove os filhos junto.
    await supabase.from('checklist_itens').delete().eq('id', item.id)
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const titulo = novo.trim()
    if (!titulo) return
    setNovo('')
    await supabase.from('checklist_itens').insert({
      empresa_id: empresaId,
      titulo,
      ordem: raizes.length,
    })
    carregar()
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
    setItens(prev => prev.map(i => alvos.includes(i.id)
      ? { ...i, ...patch, status: marcar ? 'concluido' : (i.status === 'concluido' ? 'a_fazer' : i.status) }
      : i))
    await supabase.from('checklist_itens').update(patch).in('id', alvos)
  }

  // Progresso conta folhas: contar pais junto duplicaria o mesmo trabalho.
  const folhasTodas = raizes.flatMap(r => folhasDe(r, filhos))
  const feitos = folhasTodas.filter(f => f.concluido).length
  const total = folhasTodas.length
  const pct = total ? Math.round((feitos / total) * 100) : 0
  const completo = feitos === total && total > 0

  const handlers: TarefaHandlers = {
    filhos,
    onAlternar: alternar,
    onAddSub: addSub,
    onAbrir: t => setAbertaId(t.id),
  }

  const aberta = abertaId ? itens.find(i => i.id === abertaId) : undefined

  return (
    <section className="bg-white border border-border rounded-xl shadow-sm overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-transparent">
        <ListChecks className="w-3.5 h-3.5 text-text-muted" />
        <h2 className="text-base font-semibold text-text-primary">Tarefas</h2>
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
          <div className="w-24 h-1 bg-surface-sunken rounded-full overflow-hidden">
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

      {/* Teto para a lista não empurrar a coluna inteira quando a empresa
          acumula muitas tarefas — a lista rola em si mesma. */}
      <div className="scroll-fino max-h-[40vh] overflow-y-auto divide-y divide-border">
        {raizes.map(item => (
          <TarefaLinha key={item.id} item={item} nivel={0} h={handlers} />
        ))}
        {total === 0 && <p className="text-sm text-text-secondary px-4 py-3">Nenhuma tarefa.</p>}
      </div>

      <form onSubmit={adicionar} className="flex gap-2 border-t border-border p-3">
        <input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          placeholder="Adicionar etapa..."
          className="flex-1 min-w-0 px-2 py-1 bg-surface-sunken border border-border rounded text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary focus:ring-2 focus:ring-btn-primary/20 transition-colors"
        />
        <button
          type="submit"
          disabled={!novo.trim()}
          className="shrink-0 px-2 bg-btn-primary text-white rounded hover:bg-btn-primary-hover transition-colors disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {aberta && (
        <TarefaModal
          tarefa={aberta}
          caminho={caminhoAte(aberta, itens)}
          ehPai={(filhos.get(aberta.id) ?? []).length > 0}
          usuarios={usuarios}
          onSalvar={patch => salvarTarefa(aberta, patch)}
          onRemover={() => remover(aberta)}
          onClose={() => setAbertaId(null)}
        />
      )}
    </section>
  )
}
