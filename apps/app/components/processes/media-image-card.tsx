'use client'

import { useState } from 'react'
import { Eye, Download, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DocumentFile } from '@/types/process'

interface MediaImageCardProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}

export function MediaImageCard({ file, onPreview, onDownload }: MediaImageCardProps) {
  const [imgError, setImgError] = useState(false)
  const isCover = file.doc_type?.name === 'Capa'

  return (
    <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md group py-0">
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {!imgError ? (
          <img
            src={file.file_url}
            alt={file.file_name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Imagem indisponível
          </div>
        )}

        {/* Cover badge */}
        {isCover && (
          <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
            Capa
          </Badge>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); onPreview(file) }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); onDownload(file) }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs text-muted-foreground truncate">{file.file_name}</p>
      </div>
    </Card>
  )
}
