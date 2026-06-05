// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  Video,
  Music,
  File,
  ExternalLink,
  Trash2,
  Upload,
  Link,
  Loader2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { TrainingLessonMaterial } from '@/types/training'
import type { LucideIcon } from 'lucide-react'

interface LessonMaterialUploadProps {
  lessonId: string
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

const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'zip', 'rar', '7z',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'mp4', 'webm',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function LessonMaterialUpload({ lessonId }: LessonMaterialUploadProps) {
  const [materials, setMaterials] = useState<TrainingLessonMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/materials`)
      const json = await res.json()
      setMaterials(json.data || [])
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMaterials()
  }, [lessonId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error(`Extensão não permitida. Extensões aceites: ${ALLOWED_EXTENSIONS.join(', ')}`)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ficheiro excede o tamanho máximo de 50MB')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('material_type', 'file')

    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/materials`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error()
      toast.success('Ficheiro carregado com sucesso!')
      fetchMaterials()
    } catch {
      toast.error('Erro ao carregar o ficheiro.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddLink = async () => {
    if (!linkUrl || !linkTitle) {
      toast.error('URL e título são obrigatórios.')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('material_type', 'link')
    formData.append('link_url', linkUrl)
    formData.append('link_title', linkTitle)

    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/materials`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error()
      toast.success('Link adicionado com sucesso!')
      setLinkUrl('')
      setLinkTitle('')
      setShowLinkForm(false)
      fetchMaterials()
    } catch {
      toast.error('Erro ao adicionar o link.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (materialId: string) => {
    setDeletingId(materialId)
    try {
      const res = await fetch(
        `/api/training/lessons/${lessonId}/materials/${materialId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error()
      toast.success('Material eliminado com sucesso!')
      fetchMaterials()
    } catch {
      toast.error('Erro ao eliminar o material.')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1 h-3.5 w-3.5" />
          )}
          Ficheiro
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowLinkForm(!showLinkForm)}
        >
          <Link className="mr-1 h-3.5 w-3.5" />
          Link
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
          onChange={handleFileUpload}
        />
      </div>

      {/* Link form */}
      {showLinkForm && (
        <div className="space-y-2 rounded-md border p-3">
          <div>
            <Label className="text-xs">URL *</Label>
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              placeholder="Nome do recurso"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddLink}
              disabled={isUploading}
            >
              Adicionar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowLinkForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Materials list */}
      {materials.length === 0 && !showLinkForm && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhum material adicionado a esta lição.
        </p>
      )}

      {materials.map((material) => {
        const Icon =
          material.material_type === 'link'
            ? ExternalLink
            : getFileIcon(material.file_extension)

        return (
          <div
            key={material.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {material.material_type === 'file'
                    ? material.file_name
                    : material.link_title}
                </p>
                {material.material_type === 'file' && material.file_size_bytes && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(material.file_size_bytes)}
                  </p>
                )}
                {material.material_type === 'link' && material.link_url && (
                  <p className="truncate text-xs text-muted-foreground">
                    {material.link_url}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={deletingId === material.id}
              onClick={() => handleDelete(material.id)}
            >
              {deletingId === material.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
