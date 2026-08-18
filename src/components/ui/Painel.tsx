'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/* ── Vocabulário visual compartilhado ───────────────────────────────────────
   Mesma linguagem do board: card branco arredondado com sombra suave, fonte
   do sistema, escala de texto padrão do Tailwind, rótulos em caixa normal.
   Mono só no dado que se copia.                                             */

export const INPUT = 'w-full px-3 py-2 bg-surface-sunken border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors'
export const CAMPO_LABEL = 'block text-xs text-text-secondary mb-1'
export const TITULO_SECAO = 'text-base font-semibold text-text-primary'
export const BOTAO_DISCRETO = 'inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors'

export function Painel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-card-bg border border-border rounded-xl shadow-sm overflow-hidden ${className}`}>{children}</section>
}

export function CabecalhoSecao({ icone, titulo, contagem, children }: { icone?: React.ReactNode; titulo: string; contagem?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      {icone}
      <h2 className={TITULO_SECAO}>{titulo}</h2>
      {contagem}
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  )
}

export function CopyBtn({ value, titulo = 'Copiar' }: { value: string; titulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200) }}
      className={`shrink-0 p-1 rounded-lg transition-colors ${ok ? 'text-green-600' : 'text-text-muted hover:text-accent hover:bg-black/5'}`}
      title={titulo}
      aria-label={titulo}
    >
      {ok ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

export function Field({ label, children, copyValue, mono, span }: { label: string; children: React.ReactNode; copyValue?: string; mono?: boolean; span?: boolean }) {
  return (
    <div data-campo className={span ? 'col-span-2' : ''}>
      <dt className={CAMPO_LABEL}>{label}</dt>
      <dd className="flex items-start gap-1">
        <div className={`flex-1 min-w-0 text-sm leading-snug text-text-primary ${mono ? 'font-mono' : ''}`}>
          {children || <span className="text-text-muted">—</span>}
        </div>
        {copyValue && <CopyBtn value={copyValue} />}
      </dd>
    </div>
  )
}
