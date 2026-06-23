'use client'

import Link from 'next/link'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Empresa } from '@/types/kanban'
import { GripVertical, Pencil, Trash2, Globe, Mail, Phone } from 'lucide-react'

interface Props {
  empresa: Empresa
  dragId: string
  overlay?: boolean
  onEdit?: () => void
  onRemove?: () => void
}

function formatCNPJ(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function Card({ empresa, dragId, overlay, onEdit, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={!overlay ? setNodeRef : undefined}
      style={style}
      className={`group bg-card-bg rounded-lg shadow-sm transition-shadow cursor-pointer ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'shadow-xl rotate-3 scale-105' : 'hover:shadow-md'}`}
    >
      {/* Colored top stripe */}

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
          href={`/empresa/${empresa.id}`}
          className="text-sm font-medium text-text-primary hover:text-accent hover:underline leading-snug block"
          onClick={e => e.stopPropagation()}
        >
          {empresa.razao_social}
        </Link>

        {empresa.nome_fantasia && (
          <p className="text-xs text-text-secondary mt-0.5">{empresa.nome_fantasia}</p>
        )}

        <p className="text-[11px] text-text-muted mt-1 font-mono">{formatCNPJ(empresa.cnpj)}</p>

        {(empresa.site || empresa.emails || empresa.whatsapp) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 pt-2 border-t border-border">
            {empresa.emails && (
              <a href={`mailto:${empresa.emails}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover truncate max-w-full">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{empresa.emails}</span>
              </a>
            )}
            {empresa.whatsapp && (
              <a href={`tel:${empresa.whatsapp.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{empresa.whatsapp}</span>
              </a>
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
