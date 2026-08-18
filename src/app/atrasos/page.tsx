'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SlaColuna, ColunaId, COLUNAS, Prioridade, StatusTarefa, PRIORIDADES, STATUS_TAREFA } from '@/types/kanban'
import { hojeISO, formatPrazo } from '@/lib/tarefas'
import { Painel, CabecalhoSecao } from '@/components/ui/Painel'
import { AlarmClock, Timer, CalendarDays, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface TarefaVencida {
  id: string
  titulo: string
  prazo: string
  responsavel: string | null
  prioridade: Prioridade
  status: StatusTarefa
  empresas: { id: string; razao_social: string } | null
}

interface CardEstourado {
  epId: string
  empresaId: string
  razaoSocial: string
  plataformaId: string
  plataformaNome: string
  plataformaCor: string
  coluna: ColunaId
  dias: number
  maxDias: number
}

function diasDeAtraso(prazo: string) {
  const [a, m, d] = prazo.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hojeISO().split('-').map(Number)
  return Math.round((Date.UTC(ha, hm - 1, hd) - Date.UTC(a, m - 1, d)) / 86_400_000)
}

export default function AtrasosPage() {
  const [tarefas, setTarefas] = useState<TarefaVencida[]>([])
  const [cards, setCards] = useState<CardEstourado[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const [{ data: vencidas }, { data: eps }, { data: slas }] = await Promise.all([
        supabase
          .from('checklist_itens')
          .select('id, titulo, prazo, responsavel, prioridade, status, empresas(id, razao_social)')
          .eq('concluido', false)
          .not('prazo', 'is', null)
          .lt('prazo', hojeISO())
          .order('prazo'),
        supabase
          .from('empresa_plataforma')
          .select('id, coluna, coluna_desde, empresa_id, plataforma_id, empresas(id, razao_social), plataformas(id, nome, cor)'),
        supabase.from('sla_colunas').select('*'),
      ])

      setTarefas((vencidas as any[]) ?? [])

      const regras = (slas ?? []) as SlaColuna[]
      const slaPara = (plataformaId: string, coluna: string) =>
        regras.find(s => s.plataforma_id === plataformaId && s.coluna === coluna)?.max_dias ??
        regras.find(s => s.plataforma_id === null && s.coluna === coluna)?.max_dias

      const estourados: CardEstourado[] = []
      for (const ep of (eps as any[]) ?? []) {
        if (!ep.coluna_desde || !ep.empresas || !ep.plataformas) continue
        const max = slaPara(ep.plataforma_id, ep.coluna)
        if (max == null) continue
        const dias = Math.floor((Date.now() - new Date(ep.coluna_desde).getTime()) / 86_400_000)
        if (dias > max) {
          estourados.push({
            epId: ep.id,
            empresaId: ep.empresas.id,
            razaoSocial: ep.empresas.razao_social,
            plataformaId: ep.plataformas.id,
            plataformaNome: ep.plataformas.nome,
            plataformaCor: ep.plataformas.cor,
            coluna: ep.coluna,
            dias,
            maxDias: max,
          })
        }
      }
      estourados.sort((a, b) => (b.dias - b.maxDias) - (a.dias - a.maxDias))
      setCards(estourados)
      setCarregando(false)
    }
    carregar()
  }, [])

  const nomeColuna = (id: ColunaId) => COLUNAS.find(c => c.id === id)?.nome ?? id
  const corColuna = (id: ColunaId) => COLUNAS.find(c => c.id === id)?.cor ?? '#666'

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <AlarmClock className="w-5 h-5 text-red-500" /> Atrasos
        </h1>

        <Painel>
          <CabecalhoSecao
            icone={<CalendarDays className="w-3.5 h-3.5 text-text-muted" />}
            titulo="Tarefas com prazo vencido"
            contagem={tarefas.length > 0 ? <span className="text-xs font-mono text-red-600 font-semibold">{tarefas.length}</span> : undefined}
          />
          {carregando ? (
            <p className="text-sm text-text-secondary px-4 py-3">Carregando...</p>
          ) : tarefas.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-3">Nenhuma tarefa vencida. 🎉</p>
          ) : (
            <div className="divide-y divide-border">
              {tarefas.map(t => (
                <Link
                  key={t.id}
                  href={t.empresas ? `/empresa/${t.empresas.id}` : '#'}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-card-hover transition-colors group"
                >
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-semibold">
                    <CalendarDays className="w-3 h-3" /> {formatPrazo(t.prazo)}
                  </span>
                  <span className="text-sm text-text-primary truncate">{t.titulo}</span>
                  {(t.prioridade === 'urgente' || t.prioridade === 'alta') && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORIDADES.find(p => p.id === t.prioridade)?.chip}`}>
                      {PRIORIDADES.find(p => p.id === t.prioridade)?.nome}
                    </span>
                  )}
                  {t.status === 'bloqueado' && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_TAREFA.find(s => s.id === 'bloqueado')?.chip}`}>
                      Bloqueado
                    </span>
                  )}
                  <span className="text-xs text-text-secondary truncate">{t.empresas?.razao_social}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    {t.responsavel && (
                      <span className="w-5 h-5 rounded-full bg-btn-primary/15 text-btn-primary text-[10px] font-bold uppercase flex items-center justify-center" title={t.responsavel}>
                        {t.responsavel.slice(0, 2)}
                      </span>
                    )}
                    <span className="text-xs text-red-600 font-medium">{diasDeAtraso(t.prazo)}d de atraso</span>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Painel>

        <Painel>
          <CabecalhoSecao
            icone={<Timer className="w-3.5 h-3.5 text-text-muted" />}
            titulo="Cards estourando o SLA de coluna"
            contagem={cards.length > 0 ? <span className="text-xs font-mono text-amber-600 font-semibold">{cards.length}</span> : undefined}
          />
          {carregando ? (
            <p className="text-sm text-text-secondary px-4 py-3">Carregando...</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-3">Nenhum card parado além do SLA.</p>
          ) : (
            <div className="divide-y divide-border">
              {cards.map(c => (
                <Link
                  key={c.epId}
                  href={`/empresa/${c.empresaId}?plataforma=${c.plataformaId}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-card-hover transition-colors group"
                >
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold">
                    <Timer className="w-3 h-3" /> {c.dias}d / SLA {c.maxDias}
                  </span>
                  <span className="text-sm text-text-primary truncate">{c.razaoSocial}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: corColuna(c.coluna) }}>
                      {nomeColuna(c.coluna)}
                    </span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: c.plataformaCor }}>
                      {c.plataformaNome}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Painel>
      </div>
    </div>
  )
}
