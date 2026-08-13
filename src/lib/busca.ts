import { Empresa } from '@/types/kanban'

/** Sem acento e em minúscula: "GOIÁS" e "goias" têm que se achar. */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const soDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Campos varridos pela busca do board. `rotulo` é o que aparece no card quando
 * o resultado bate num campo que o card não mostra — sem isso a empresa surge
 * na lista sem explicação e parece bug.
 */
const CAMPOS: { chave: keyof Empresa; rotulo: string; noCard?: boolean }[] = [
  { chave: 'razao_social',      rotulo: 'Razão social',    noCard: true },
  { chave: 'nome_fantasia',     rotulo: 'Nome fantasia',   noCard: true },
  { chave: 'cnpj',              rotulo: 'CNPJ',            noCard: true },
  { chave: 'emails',            rotulo: 'E-mail',          noCard: true },
  { chave: 'whatsapp',          rotulo: 'Telefone',        noCard: true },
  { chave: 'site',              rotulo: 'Site',            noCard: true },
  { chave: 'instagram',         rotulo: 'Instagram' },
  { chave: 'reclame_aqui',      rotulo: 'Reclame Aqui' },
  { chave: 'nome_completo',     rotulo: 'Responsável' },
  { chave: 'nome_mae',          rotulo: 'Nome da mãe' },
  { chave: 'cpf',               rotulo: 'CPF' },
  { chave: 'endereco',          rotulo: 'Endereço' },
  { chave: 'endereco_empresa',  rotulo: 'Endereço' },
  { chave: 'cnae_principal',    rotulo: 'CNAE' },
  { chave: 'cnaes_secundarios', rotulo: 'CNAE' },
  { chave: 'info_bancarias',    rotulo: 'Dados bancários' },
]

export interface Resultado {
  achou: boolean
  /** Rótulos dos campos que casaram e NÃO aparecem no card. */
  ondeEscondido: string[]
}

/**
 * Busca em todos os campos da empresa. Vários termos separados por espaço
 * precisam bater todos ("flor goias"), cada um em qualquer campo.
 *
 * Número é comparado também sem máscara, nos dois sentidos: digitar
 * "63965543000163" acha "63.965.543/0001-63", e digitar "(11) 92201-1449"
 * acha "11922011449".
 */
export function buscar(empresa: Empresa, busca: string): Resultado {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return { achou: true, ondeEscondido: [] }

  const escondidos = new Set<string>()

  const achou = termos.every(termo => {
    // Só compara sem máscara quando o termo é um número escrito com pontuação
    // de documento. Extrair dígitos de "xpto999" e procurar "999" casaria com
    // qualquer código CNAE — a parte de letras seria ignorada em silêncio.
    const ehNumero = /^[\d.\-/()\s]+$/.test(termo)
    const digitosDoTermo = ehNumero ? soDigitos(termo) : ''
    let bateu = false

    for (const campo of CAMPOS) {
      const valor = empresa[campo.chave]
      if (!valor) continue
      const bruto = String(valor)

      let casou = normalizar(bruto).includes(termo)
      // 3 dígitos é o mínimo para não casar com qualquer coisa
      if (!casou && digitosDoTermo.length >= 3) {
        casou = soDigitos(bruto).includes(digitosDoTermo)
      }

      if (casou) {
        bateu = true
        if (!campo.noCard) escondidos.add(campo.rotulo)
      }
    }
    return bateu
  })

  return { achou, ondeEscondido: achou ? [...escondidos] : [] }
}
