'use client'

import { useState } from 'react'
import { Building2, FileCheck, User, Briefcase, ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { FolderIcon } from '@/components/icons/folder-icon'
import type { DocumentFolder } from '@/types/process'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  FileCheck,
  User,
  Briefcase,
  ImageIcon,
}

interface DocumentFolderCardProps {
  folder: DocumentFolder
  onClick: () => void
}

export function DocumentFolderCard({ folder, onClick }: DocumentFolderCardProps) {
  const TypeIcon = ICON_MAP[folder.icon] || FileCheck
  const [hovered, setHovered] = useState(false)

  return (
    <Card
      className="overflow-hidden gap-0 cursor-pointer transition-all hover:shadow-sm hover:scale-[1.01] py-0"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="aspect-[16/10] m-2 rounded-lg bg-muted/30 flex items-center justify-center relative"
        style={{ perspective: '600px' }}
      >
        <FolderIcon className="h-48 w-48" hovered={hovered} />
        <div className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <CardContent className="p-4">
        <p className="font-semibold text-sm truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {folder.document_count} {folder.type === 'media'
            ? (folder.document_count === 1 ? 'imagem' : 'imagens')
            : (folder.document_count === 1 ? 'documento' : 'documentos')
          }
        </p>
      </CardContent>
    </Card>
  )
}
