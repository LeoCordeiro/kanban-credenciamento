export type ColunaId = 'a_analisar' | 'infraestrutura' | 'cadastro_inicial' | 'concluido' | 'descredenciado'

export interface Empresa {
  id: string
  coluna: ColunaId
  posicao: number
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  cnae_principal: string | null
  cnaes_secundarios: string | null
  nome_completo: string | null
  nome_mae: string | null
  cpf: string | null
  data_nascimento: string | null
  endereco: string | null
  endereco_empresa: string | null
  info_bancarias: string | null
  emails: string | null
  whatsapp: string | null
  site: string | null
  instagram: string | null
  reclame_aqui: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface Anexo {
  id: string
  empresa_id: string
  nome: string
  url: string
  tipo: string | null
  tamanho: number | null
  created_at: string
}

export interface Comentario {
  id: string
  empresa_id: string
  plataforma_id: string
  texto: string
  autor: string
  red_flag?: boolean
  created_at: string
}

export interface Credencial {
  id: string
  empresa_id: string
  titulo: string
  usuario: string
  senha: string | null
  url: string | null
  notas: string | null
  created_at: string
}

export interface Plataforma {
  id: string
  nome: string
  cor: string
  ordem?: number
  created_at: string
}

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type StatusTarefa = 'a_fazer' | 'fazendo' | 'bloqueado' | 'concluido'

export const PRIORIDADES: { id: Prioridade; nome: string; cor: string; chip: string }[] = [
  { id: 'baixa', nome: 'Baixa', cor: '#6b7280', chip: 'bg-gray-100 text-gray-600' },
  { id: 'media', nome: 'Média', cor: '#2563eb', chip: 'bg-blue-100 text-blue-700' },
  { id: 'alta', nome: 'Alta', cor: '#d97706', chip: 'bg-amber-100 text-amber-800' },
  { id: 'urgente', nome: 'Urgente', cor: '#dc2626', chip: 'bg-red-100 text-red-700' },
]

export const STATUS_TAREFA: { id: StatusTarefa; nome: string; cor: string; chip: string }[] = [
  { id: 'a_fazer', nome: 'A fazer', cor: '#97a0af', chip: 'bg-gray-100 text-gray-600' },
  { id: 'fazendo', nome: 'Fazendo', cor: '#0079bf', chip: 'bg-blue-100 text-blue-700' },
  { id: 'bloqueado', nome: 'Bloqueado', cor: '#dc2626', chip: 'bg-red-100 text-red-700' },
  { id: 'concluido', nome: 'Concluído', cor: '#16a34a', chip: 'bg-green-100 text-green-700' },
]

export interface ChecklistItem {
  id: string
  empresa_id: string
  titulo: string
  concluido: boolean
  ordem: number
  concluido_em: string | null
  concluido_por: string | null
  parent_id: string | null
  /** timestamptz — SLA em horas não cabe numa data pura. */
  prazo: string | null
  responsavel: string | null
  modelo_id: string | null
  /** Observação específica desta empresa. As instruções do tipo vêm do modelo. */
  descricao: string | null
  prioridade: Prioridade
  status: StatusTarefa
  sla_horas: number | null
  created_at: string
  /** Vem do join com checklist_modelo — instruções e documentação são do tipo. */
  modelo?: {
    instrucoes: string | null
    docs?: { documento: Documento | null }[] | null
  } | null
}

/** Na UI o conceito virou "tarefa" — mesma tabela checklist_itens. */
export type Tarefa = ChecklistItem

/** Um tipo de tarefa: o que toda empresa nova recebe. Editado em /tarefas. */
export interface ChecklistModeloItem {
  id: string
  titulo: string
  ordem: number
  /** SLA do tipo: prazo da tarefa nova = momento da criação + N horas. */
  sla_horas: number | null
  /** Como executar a tarefa. Fica no tipo, vale para todas as empresas. */
  instrucoes: string | null
  prioridade: Prioridade
  created_at: string
  /** Documentações de consulta (join). Aparecem dentro da tarefa na ficha. */
  docs?: { documento: Documento | null }[] | null
  /** Plataformas às quais a tarefa é restrita (join). Vazio = todas. */
  plataformas?: { plataforma_id: string }[] | null
}

export interface Usuario {
  id: string
  nome: string
  ativo?: boolean
  created_at?: string
}

export interface EmpresaPlataforma {
  id: string
  empresa_id: string
  plataforma_id: string
  coluna: ColunaId
  posicao: number
  has_red_flag?: boolean
  coluna_desde?: string
  created_at: string
}

export interface PendenteResumo {
  titulo: string
  /** Título da etapa raiz a que a tarefa pertence (vazio se ela própria é raiz). */
  etapa: string
  responsavel: string | null
  prazo: string | null
  atrasada: boolean
  prioridade: Prioridade
  status: StatusTarefa
}

export interface ChecklistResumo {
  feitos: number
  total: number
  pendentes: PendenteResumo[]
}

export interface BoardItem {
  epId: string
  empresa: Empresa
  coluna: ColunaId
  plataformaId: string
  hasRedFlag?: boolean
  redFlagComments?: string[]
  checklist?: ChecklistResumo
  colunaDesde?: string
  /** Campos que casaram com a busca e não aparecem no card (ex.: CPF, Endereço). */
  buscaEm?: string[]
}

export interface SlaColuna {
  id: string
  plataforma_id: string | null
  coluna: ColunaId
  max_horas: number
  created_at: string
}

export interface Documento {
  id: string
  titulo: string
  categoria: string | null
  conteudo: string | null
  url: string | null
  created_at: string
  updated_at: string
}

export interface Acesso {
  id: string
  titulo: string
  categoria: string | null
  url: string | null
  usuario: string | null
  senha: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export const COLUNAS: { id: ColunaId; nome: string; cor: string }[] = [
  { id: 'a_analisar', nome: 'A Analisar', cor: '#d97706' },
  { id: 'infraestrutura', nome: 'Infraestrutura', cor: '#2563eb' },
  { id: 'cadastro_inicial', nome: 'Cadastro Inicial', cor: '#7c3aed' },
  { id: 'concluido', nome: 'Concluído', cor: '#16a34a' },
  { id: 'descredenciado', nome: 'Descredenciado', cor: '#dc2626' },
]
