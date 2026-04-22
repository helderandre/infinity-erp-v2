'use client'

import { FileText, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonalDesign } from '@/hooks/use-personal-designs'

interface PersonalDesignCardProps {
  design: PersonalDesign
  onOpen?: (design: PersonalDesign) => void
  onEdit?: (design: PersonalDesign) => void
  onDelete?: (design: PersonalDesign) => void
}

function isPdf(d: PersonalDesign): boolean {
  return d.mime_type === 'application/pdf' || !!d.file_name?.toLowerCase().endsWith('.pdf')
}

export function PersonalDesignCard({
  design,
  onOpen,
  onEdit,
  onDelete,
}: PersonalDesignCardProps) {
  const thumb = design.thumbnail_url || (isPdf(design) ? null : design.file_url)

  return (
    <div
      className={cn(
        'group relative rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-pointer'
      )}
      onClick={() => onOpen?.(design)}
    >
      <div className="block">
        {thumb ? (
          <div className="aspect-[4/3] bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={design.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="p-2.5">
          <p className="text-xs font-medium truncate uppercase">{design.name}</p>
        </div>
      </div>
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(design)
            }}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white text-destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(design)
            }}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
