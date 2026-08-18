import { Tarefa } from '@/types/kanban'

/** Data local de hoje em ISO (yyyy-mm-dd), sem passar por UTC. */
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function prazoVencido(prazo: string | null, concluido: boolean) {
  return !!prazo && !concluido && prazo.slice(0, 10) < hojeISO()
}

/** dd/mm a partir de "yyyy-mm-dd" sem new Date (data pura não tem fuso). */
export function formatPrazo(prazo: string) {
  const [, mes, dia] = prazo.slice(0, 10).split('-')
  return `${dia}/${mes}`
}

/** Map parent_id → filhos ordenados. Raízes ficam na chave 'raiz'. */
export function montarArvore(itens: Tarefa[]) {
  const filhos = new Map<string, Tarefa[]>()
  for (const t of itens) {
    const chave = t.parent_id ?? 'raiz'
    const lista = filhos.get(chave) ?? []
    lista.push(t)
    filhos.set(chave, lista)
  }
  for (const lista of filhos.values()) {
    lista.sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
  }
  return filhos
}

/** Folhas sob um item (o próprio, se não tem filhos). */
export function folhasDe(item: Tarefa, filhos: Map<string, Tarefa[]>): Tarefa[] {
  const diretos = filhos.get(item.id)
  if (!diretos || diretos.length === 0) return [item]
  return diretos.flatMap(f => folhasDe(f, filhos))
}

/** Ids do item + todos os descendentes. */
export function idsComDescendentes(item: Tarefa, filhos: Map<string, Tarefa[]>): string[] {
  const diretos = filhos.get(item.id) ?? []
  return [item.id, ...diretos.flatMap(f => idsComDescendentes(f, filhos))]
}

/** Estado efetivo: folha usa o próprio concluido; pai é o E lógico das folhas. */
export function estadoEfetivo(item: Tarefa, filhos: Map<string, Tarefa[]>) {
  return folhasDe(item, filhos).every(f => f.concluido)
}
