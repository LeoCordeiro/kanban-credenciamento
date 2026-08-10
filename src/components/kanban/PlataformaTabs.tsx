'use client'

import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plataforma } from '@/types/kanban'
import { Pencil, Trash2 } from 'lucide-react'

interface TabProps {
  plataforma: Plataforma
  isActive: boolean
  count: number
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function Tab({ plataforma, isActive, count, onSelect, onEdit, onDelete }: TabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plataforma.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group/tab flex flex-col items-center touch-none ${isDragging ? 'opacity-60 z-20' : ''}`}
      {...attributes}
      {...listeners}
    >
      <button
        onClick={onSelect}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-grab active:cursor-grabbing ${
          isActive
            ? 'bg-white text-text-primary shadow-md'
            : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white'
        }`}
      >
        {plataforma.nome}
        {isActive && count > 0 && (
          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-accent text-white rounded-full font-bold">{count}</span>
        )}
      </button>
      <div className={`flex gap-1 mt-1 h-5 transition-opacity ${isActive ? 'opacity-0 group-hover/tab:opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={onEdit} className="p-1 text-white/50 hover:text-white">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="p-1 text-white/50 hover:text-red-300">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

interface Props {
  plataformas: Plataforma[]
  selectedId: string | null
  count: number
  onSelect: (id: string) => void
  onEdit: (p: Plataforma) => void
  onDelete: (id: string) => void
  onReorder: (e: DragEndEvent) => void
}

export function PlataformaTabs({ plataformas, selectedId, count, onSelect, onEdit, onDelete, onReorder }: Props) {
  // distance: 8 deixa o clique de selecionar a aba passar sem virar arrasto
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
      <SortableContext items={plataformas.map(p => p.id)} strategy={horizontalListSortingStrategy}>
        {plataformas.map(p => (
          <Tab
            key={p.id}
            plataforma={p}
            isActive={selectedId === p.id}
            count={selectedId === p.id ? count : 0}
            onSelect={() => onSelect(p.id)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}
