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
  created_at: string
}

export interface EmpresaPlataforma {
  id: string
  empresa_id: string
  plataforma_id: string
  coluna: ColunaId
  posicao: number
  has_red_flag?: boolean
  created_at: string
}

export interface BoardItem {
  epId: string
  empresa: Empresa
  coluna: ColunaId
  plataformaId: string
  hasRedFlag?: boolean
  redFlagComments?: string[]
}

export const COLUNAS: { id: ColunaId; nome: string; cor: string }[] = [
  { id: 'a_analisar', nome: 'A Analisar', cor: '#d97706' },
  { id: 'infraestrutura', nome: 'Infraestrutura', cor: '#2563eb' },
  { id: 'cadastro_inicial', nome: 'Cadastro Inicial', cor: '#7c3aed' },
  { id: 'concluido', nome: 'Concluído', cor: '#16a34a' },
  { id: 'descredenciado', nome: 'Descredenciado', cor: '#dc2626' },
]
