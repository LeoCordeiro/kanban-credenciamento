'use client'

import { useEffect, useState } from 'react'
import { X, ExternalLink, MessageCircle } from 'lucide-react'

const ZAPZAP = process.env.NEXT_PUBLIC_ZAPZAP_URL ?? 'https://zapzap.axussolutions.com.br'

/** Só os dígitos — o ZapZap casa pelo fim do número, então DDI e nono dígito não importam. */
export const temWhatsapp = (v?: string | null) => String(v ?? '').replace(/\D/g, '').length >= 8

export function urlDoZap(whatsapp: string) {
  return `${ZAPZAP}/#/central/tel/${String(whatsapp).replace(/\D/g, '')}`
}

interface Props {
  empresa: string
  whatsapp: string
  onClose: () => void
}

export function ZapPanel({ empresa, whatsapp, onClose }: Props) {
  const url = urlDoZap(whatsapp)

  // Esc fecha, e o body trava para o board não rolar atrás do painel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="bg-white w-full max-w-3xl h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{empresa}</p>
            <p className="text-xs text-text-muted font-mono">{whatsapp}</p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir o ZapZap em uma aba"
            className="p-2 text-text-muted hover:text-text-primary hover:bg-black/5 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="p-2 text-text-muted hover:text-text-primary hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Sessão própria: o navegador isola o armazenamento de um site embutido, então
            o login aqui dentro é separado do da aba normal do ZapZap. */}
        <iframe
          src={url}
          title={`WhatsApp — ${empresa}`}
          className="flex-1 w-full border-0"
        />
      </aside>
    </div>
  )
}

/** Estado compartilhado por quem abre o painel (card do board e página da empresa). */
export function useZapPanel() {
  const [alvo, setAlvo] = useState<{ empresa: string; whatsapp: string } | null>(null)
  return {
    alvo,
    abrir: (empresa: string, whatsapp: string) => setAlvo({ empresa, whatsapp }),
    fechar: () => setAlvo(null),
  }
}
