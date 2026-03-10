'use client'

import { Building2, FileCheck, User, Briefcase, Folder } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { DocumentFolder } from '@/types/process'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  FileCheck,
  User,
  Briefcase,
}

interface DocumentFolderCardProps {
  folder: DocumentFolder
  onClick: () => void
}

export function DocumentFolderCard({ folder, onClick }: DocumentFolderCardProps) {
  const TypeIcon = ICON_MAP[folder.icon] || FileCheck

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] py-0"
      onClick={onClick}
    >
      <div className="aspect-[16/10] bg-muted flex items-center justify-center relative">
        <Folder className="h-16 w-16 text-blue-400" />
        <div className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <CardContent className="p-4">
        <p className="font-semibold text-sm truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {folder.document_count} {folder.document_count === 1 ? 'documento' : 'documentos'}
        </p>
      </CardContent>
    </Card>
  )
}
