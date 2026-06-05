// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  Video,
  Music,
  File,
  ExternalLink,
  Download,
  Loader2,
  BookOpen,
} from 'lucide-react'
import type { TrainingLessonMaterial } from '@/types/training'
import type { LucideIcon } from 'lucide-react'

interface LessonMaterialsProps {
  lessonId: string
  courseId?: string
}

const FILE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  zip: FileArchive,
  rar: FileArchive,
  '7z': FileArchive,
  mp4: Video,
  webm: Video,
  mp3: Music,
}

function getFileIcon(extension?: string | null): LucideIcon {
  if (!extension) return File
  return FILE_ICONS[extension] || File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function LessonMaterials({ lessonId, courseId }: LessonMaterialsProps) {
  const [materials, setMaterials] = useState<TrainingLessonMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/training/lessons/${lessonId}/materials`)
      .then(res => res.json())
      .then(json => setMaterials(json.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [lessonId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (materials.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Materiais de Apoio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {materials.map((material) => {
          const isFile = material.material_type === 'file'
          const Icon = isFile
            ? getFileIcon(material.file_extension)
            : ExternalLink

          return (
            <div
              key={material.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {isFile ? material.file_name : material.link_title}
                  </p>
                  {isFile && material.file_size_bytes && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(material.file_size_bytes)}
                    </p>
                  )}
                  {material.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {material.description}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Fire-and-forget tracking
                  if (courseId) {
                    fetch(`/api/training/materials/${material.id}/download`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ course_id: courseId }),
                    }).catch(() => {})
                  }
                  const url = isFile ? material.file_url : material.link_url
                  if (url) window.open(url, '_blank')
                }}
              >
                {isFile ? (
                  <>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Descarregar
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Abrir
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
