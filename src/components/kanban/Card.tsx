'use client'

import Link from 'next/link'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Empresa, ChecklistResumo } from '@/types/kanban'
import { GripVertical, Pencil, Trash2, Globe, Mail, Phone, Flag, ListChecks, MessageCircle } from 'lucide-react'
import { temWhatsapp } from '../ZapPanel'

interface Props {
  empresa: Empresa
  dragId: string
  plataformaId?: string
  hasRedFlag?: boolean
  redFlagComments?: string[]
  checklist?: ChecklistResumo
  overlay?: boolean
  onEdit?: () => void
  onRemove?: () => void
  onAbrirZap?: () => void
}

function formatCNPJ(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function Card({ empresa, dragId, plataformaId, hasRedFlag, redFlagComments, checklist, overlay, onEdit, onRemove, onAbrirZap }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  const hasFlag = hasRedFlag

  return (
    <div
      ref={!overlay ? setNodeRef : undefined}
      style={style}
      className={`group bg-card-bg rounded-lg shadow-sm transition-shadow cursor-pointer ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'shadow-xl rotate-3 scale-105' : 'hover:shadow-md'} ${
        hasFlag ? 'border-2 border-red-500 ring-1 ring-red-200' : 'border border-transparent'
      }`}
    >
      {/* Colored top stripe */}

      {hasFlag && (
        <div className="px-2 py-1 bg-red-500 rounded-t text-white text-[10px]">
          <div className="flex items-center gap-1 font-semibold uppercase tracking-wide">
            <Flag className="w-2.5 h-2.5 fill-white shrink-0" />
            Red Flag
            {redFlagComments && redFlagComments.length > 1 && (
              <div className="relative group/tip ml-auto shrink-0">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[9px] font-bold cursor-default leading-none">
                  +{redFlagComments.length - 1}
                </span>
                <div className="hidden group-hover/tip:block absolute z-20 right-0 top-full mt-1 w-56 max-h-52 overflow-y-auto bg-white text-text-primary text-[11px] normal-case font-normal rounded-lg shadow-xl border border-border p-2 space-y-1.5">
                  {redFlagComments.map((c, idx) => (
                    <p key={idx} className="leading-snug border-b border-border last:border-0 pb-1.5 last:pb-0">{c}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          {redFlagComments && redFlagComments.length > 0 && (
            <p className="mt-0.5 leading-snug normal-case font-normal line-clamp-2">{redFlagComments[0]}</p>
          )}
        </div>
      )}
      <div className="p-2.5">
        {/* Drag handle + actions */}
        <div className="flex items-center gap-1 mb-1.5">
          <button
            {...listeners}
            {...attributes}
            className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing shrink-0 -ml-0.5"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1" />
          {!overlay && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={onEdit} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-black/5 transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={onRemove} className="p-1 rounded text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <Link
          href={`/empresa/${empresa.id}${plataformaId ? `?plataforma=${plataformaId}` : ''}`}
          className="text-sm font-medium text-text-primary hover:text-accent hover:underline leading-snug block"
          onClick={e => e.stopPropagation()}
        >
          {empresa.razao_social}
        </Link>

        {empresa.nome_fantasia && (
          <p className="text-xs text-text-secondary mt-0.5">{empresa.nome_fantasia}</p>
        )}

        <p className="text-[11px] text-text-muted mt-1 font-mono">{formatCNPJ(empresa.cnpj)}</p>

        {checklist && checklist.total > 0 && (
          <div className="relative group/check inline-flex items-center gap-1 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                checklist.feitos === checklist.total
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <ListChecks className="w-3 h-3" />
              {checklist.feitos}/{checklist.total}
            </span>

            {checklist.pendentes.length > 0 && (
              <div className="hidden group-hover/check:block absolute z-20 left-0 top-full mt-1 w-52 bg-white text-text-primary text-[11px] rounded-lg shadow-xl border border-border p-2">
                <p className="font-semibold text-text-secondary mb-1">Pendentes</p>
                <ul className="space-y-0.5">
                  {checklist.pendentes.map((t, i) => (
                    <li key={i} className="leading-snug">• {t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {(empresa.site || empresa.emails || empresa.whatsapp) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 pt-2 border-t border-border">
            {empresa.emails && (
              <a href={`mailto:${empresa.emails}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover truncate max-w-full">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{empresa.emails}</span>
              </a>
            )}
            {empresa.whatsapp && (
              <span className="flex items-center gap-1">
                <a href={`tel:${empresa.whatsapp.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{empresa.whatsapp}</span>
                </a>
                {onAbrirZap && temWhatsapp(empresa.whatsapp) && (
                  <button
                    onClick={e => { e.stopPropagation(); onAbrirZap() }}
                    title="Abrir conversa no ZapZap"
                    className="p-0.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            )}
            {empresa.site && (
              <a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover truncate max-w-full">
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">{empresa.site.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
