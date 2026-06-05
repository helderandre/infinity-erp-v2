'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Camera, Sparkles, Loader2, Trash2, Save, Instagram, Linkedin, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Image from 'next/image'

type MomentType = 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'

const MOMENT_LABELS: Record<MomentType, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  contrato_arrendamento: 'Contrato de Arrendamento',
  entrega_chaves: 'Entrega de Chaves',
}

interface MarketingMoment {
  id: string
  photo_urls: string[]
  manual_caption: string | null
  ai_description: string | null
  ai_description_model: string | null
  ai_description_generated_at: string | null
  published_to_instagram: boolean
  published_to_linkedin: boolean
}

export interface DealMarketingMomentCardProps {
  dealId: string
  momentType: MomentType
  existingMoment?: MarketingMoment | null
  onSaved?: (moment: MarketingMoment) => void
  onMarkSubtaskComplete?: () => void
  compact?: boolean
}

export function DealMarketingMomentCard({
  dealId,
  momentType,
  existingMoment,
  onSaved,
  onMarkSubtaskComplete,
  compact = false,
}: DealMarketingMomentCardProps) {
  const [moment, setMoment] = useState<MarketingMoment | null>(existingMoment ?? null)
  const [photos, setPhotos] = useState<string[]>(existingMoment?.photo_urls ?? [])
  const [caption, setCaption] = useState<string>(
    existingMoment?.manual_caption ?? existingMoment?.ai_description ?? ''
  )
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existingMoment) {
      setMoment(existingMoment)
      setPhotos(existingMoment.photo_urls)
      setCaption(existingMoment.manual_caption ?? existingMoment.ai_description ?? '')
    }
  }, [existingMoment])

  const handlePickFiles = () => fileInputRef.current?.click()

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    const uploaded: string[] = []
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/deals/${dealId}/marketing-moments/upload`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(`Falha ao carregar ${file.name}: ${err.error ?? 'erro'}`)
          continue
        }
        const { url } = await res.json()
        uploaded.push(url)
      }
      setPhotos((prev) => [...prev, ...uploaded])
      if (uploaded.length > 0) toast.success(`${uploaded.length} foto(s) carregada(s)`)
    } catch (err) {
      console.error(err)
      toast.error('Erro inesperado no upload')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((u) => u !== url))
  }

  const handleGenerateCaption = async () => {
    setIsGenerating(true)
    try {
      // Se ainda não há moment row, criamos com generate_ai_caption=true
      if (!moment) {
        if (photos.length === 0) {
          toast.error('Carrega pelo menos 1 foto antes de gerar legenda')
          return
        }
        const res = await fetch(`/api/deals/${dealId}/marketing-moments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moment_type: momentType,
            photo_urls: photos,
            generate_ai_caption: true,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? 'Erro ao gerar legenda')
          return
        }
        const { data } = await res.json()
        setMoment(data)
        if (data.ai_description) {
          setCaption(data.ai_description)
          toast.success('Legenda gerada com IA')
        }
        return
      }
      // Já existe moment — só re-gera
      const res = await fetch(
        `/api/deals/${dealId}/marketing-moments/${moment.id}/generate-caption`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erro ao gerar legenda')
        return
      }
      const { data } = await res.json()
      setMoment(data)
      if (data.ai_description) {
        setCaption(data.ai_description)
        toast.success('Legenda regenerada com IA')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (photos.length === 0) {
      toast.error('Carrega pelo menos 1 foto')
      return
    }
    setIsSaving(true)
    try {
      let saved: MarketingMoment | null = null
      if (!moment) {
        // Criar
        const res = await fetch(`/api/deals/${dealId}/marketing-moments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moment_type: momentType,
            photo_urls: photos,
            manual_caption: caption || null,
            generate_ai_caption: false,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? 'Erro ao guardar')
          return
        }
        saved = (await res.json()).data
      } else {
        // Actualizar
        const res = await fetch(
          `/api/deals/${dealId}/marketing-moments/${moment.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photo_urls: photos,
              manual_caption: caption || null,
            }),
          }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? 'Erro ao actualizar')
          return
        }
        saved = (await res.json()).data
      }
      if (saved) {
        setMoment(saved)
        toast.success('Momento guardado')
        onSaved?.(saved)
        onMarkSubtaskComplete?.()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleTogglePublish = async (channel: 'instagram' | 'linkedin') => {
    if (!moment) {
      toast.error('Guarda o momento primeiro')
      return
    }
    const field = channel === 'instagram' ? 'published_to_instagram' : 'published_to_linkedin'
    const next = !moment[field]
    const res = await fetch(`/api/deals/${dealId}/marketing-moments/${moment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    })
    if (!res.ok) {
      toast.error('Erro a actualizar publicação')
      return
    }
    const { data } = await res.json()
    setMoment(data)
    toast.success(next ? `Marcado como publicado no ${channel}` : 'Desmarcado')
  }

  return (
    <div className={cn('space-y-3 rounded-lg border bg-card', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-pink-500/10 flex items-center justify-center">
            <Camera className="h-4 w-4 text-pink-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Momento de Marketing</p>
            <p className="text-xs text-muted-foreground">{MOMENT_LABELS[momentType]}</p>
          </div>
        </div>
        {moment?.ai_description_generated_at && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            IA gerada
          </Badge>
        )}
      </div>

      {/* Photo grid */}
      <div className="space-y-2">
        <Label className="text-xs">Fotos</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((url) => (
            <div
              key={url}
              className="relative aspect-square rounded-md overflow-hidden border bg-muted group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePhoto(url)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                aria-label="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isUploading}
            className="aspect-square rounded-md border-2 border-dashed bg-muted/30 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-muted-foreground gap-1 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">Adicionar</span>
              </>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Caption */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Legenda</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerateCaption}
            disabled={isGenerating || photos.length === 0}
            className="h-7 text-xs gap-1"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 text-amber-500" />
            )}
            {moment?.ai_description ? 'Re-gerar' : 'Gerar com IA'}
          </Button>
        </div>
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Escreve a legenda manualmente ou gera com IA…"
          rows={6}
          className="text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || photos.length === 0}
          className="gap-1.5"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {moment ? 'Actualizar' : 'Guardar momento'}
        </Button>

        {moment && (
          <>
            <Button
              type="button"
              variant={moment.published_to_instagram ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTogglePublish('instagram')}
              className="gap-1.5"
            >
              {moment.published_to_instagram ? <Check className="h-3.5 w-3.5" /> : <Instagram className="h-3.5 w-3.5" />}
              Instagram
            </Button>
            <Button
              type="button"
              variant={moment.published_to_linkedin ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTogglePublish('linkedin')}
              className="gap-1.5"
            >
              {moment.published_to_linkedin ? <Check className="h-3.5 w-3.5" /> : <Linkedin className="h-3.5 w-3.5" />}
              LinkedIn
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// Suppress unused-import lint for Image (next/image) — kept reserved for future thumbnails
void Image
