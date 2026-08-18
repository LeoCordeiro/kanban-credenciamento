'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/** Modal padrão do app: backdrop escuro, clique fora fecha, Escape fecha. */
export function Modal({ titulo, onClose, maxWidth = 'max-w-md', children }: {
  titulo?: string
  onClose: () => void
  maxWidth?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        {titulo && (
          <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold text-text-primary">{titulo}</h2>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
