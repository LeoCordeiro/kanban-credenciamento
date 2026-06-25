'use client'

import { useDroppable } from '@dnd-kit/core'
import { BoardItem } from '@/types/kanban'
import { Card } from './Card'
import { Plus } from 'lucide-react'

interface Props {
  coluna: { id: string; nome: string; cor: string }
  items: BoardItem[]
  plataformaId: string
  onAddCard: () => void
  onEditCard: (empresaId: string) => void
  onRemoveCard: (epId: string) => void
}

export function Column({ coluna, items, plataformaId, onAddCard, onEditCard, onRemoveCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })

  return (
    <div className="flex flex-col flex-1 min-w-[250px]">
      <div
        ref={setNodeRef}
        className={`flex flex-col rounded-xl transition-colors ${
          isOver ? 'bg-column-bg ring-2 ring-accent/40' : 'bg-column-bg'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-2 px-3 pt-3 pb-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: coluna.cor }} />
          <h2 className="text-base font-bold text-text-primary">{coluna.nome}</h2>
          <span className="text-xs text-text-muted bg-black/5 px-1.5 py-0.5 rounded-full">{items.length}</span>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-2 px-2 pb-2 min-h-[40px]">
          {items.map(item => (
            <Card
              key={item.epId}
              empresa={item.empresa}
              dragId={item.epId}
              plataformaId={plataformaId}
              hasRedFlag={item.hasRedFlag}
              onEdit={() => onEditCard(item.empresa.id)}
              onRemove={() => onRemoveCard(item.epId)}
            />
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={onAddCard}
          className="flex items-center gap-1.5 px-3 py-2 mx-1 mb-1 text-text-secondary hover:text-text-primary text-sm transition-colors rounded-lg hover:bg-black/5"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>
    </div>
  )
}
