import { Tarefa, StatusTarefa } from '@/types/kanban'

/** Data local de hoje em ISO (yyyy-mm-dd), sem passar por UTC. */
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Com SLA em horas o prazo é um instante — vence na hora, não no fim do dia. */
export function prazoVencido(prazo: string | null, concluido: boolean) {
  return !!prazo && !concluido && new Date(prazo).getTime() < Date.now()
}

/** Horas restantes até o prazo (negativo = atrasado). */
export function horasAte(prazo: string) {
  return (new Date(prazo).getTime() - Date.now()) / 3_600_000
}

/**
 * Duração em horas escrita como se lê em voz alta: "6h", "36h", "3d".
 * Acima de 48h o número de horas para de ajudar e vira contagem de dias.
 */
export function formatHoras(horas: number) {
  const h = Math.round(Math.abs(horas))
  if (h < 48) return `${h}h`
  const dias = Math.floor(h / 24)
  const resto = h % 24
  return resto === 0 ? `${dias}d` : `${dias}d ${resto}h`
}

const HORA = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** Chip curto: hoje e amanhã ganham a hora, o resto fica em dd/mm. */
export function formatPrazo(prazo: string) {
  const d = new Date(prazo)
  const hoje = new Date()
  const amanha = new Date(hoje.getTime() + 86_400_000)
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (mesmoDia(d, hoje)) return `hoje ${HORA(d)}`
  if (mesmoDia(d, amanha)) return `amanhã ${HORA(d)}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Data e hora por extenso, para tooltip. */
export function formatPrazoCompleto(prazo: string) {
  const d = new Date(prazo)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} às ${HORA(d)}`
}

/** Valor para <input type="datetime-local">, que só aceita hora local sem fuso. */
export function paraInputDateTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
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

/**
 * Status do pai vem das folhas — bloqueio pesa mais que andamento, e andamento
 * mais que "a fazer". Folha usa o status dela mesma.
 */
export function statusEfetivo(item: Tarefa, filhos: Map<string, Tarefa[]>): StatusTarefa {
  const folhas = folhasDe(item, filhos)
  if (folhas.length === 1 && folhas[0].id === item.id) return item.status
  if (folhas.every(f => f.concluido)) return 'concluido'
  if (folhas.some(f => f.status === 'bloqueado')) return 'bloqueado'
  if (folhas.some(f => f.status === 'fazendo' || f.concluido)) return 'fazendo'
  return 'a_fazer'
}

/** Trilha de títulos até o pai da tarefa (sem incluir ela própria). */
export function caminhoAte(item: Tarefa, todas: Tarefa[]): string[] {
  const porId = new Map(todas.map(t => [t.id, t]))
  const trilha: string[] = []
  let atual = item.parent_id ? porId.get(item.parent_id) : undefined
  while (atual) {
    trilha.unshift(atual.titulo)
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined
  }
  return trilha
}
