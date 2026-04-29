'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ImagePlus, Loader2, Bug, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceRecorder } from './voice-recorder'
import { useImageCompress } from '@/hooks/use-image-compress'
import {
  FEEDBACK_PAGES,
  pathnameToFeedbackPage,
  type FeedbackPage,
} from '@/types/feedback'

interface FeedbackDialogProps {
  type: 'ticket' | 'ideia'
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImagePreview {
  file: File
  preview: string
}

const CONFIG = {
  ticket: {
    icon: Bug,
    title: 'Reportar Problema',
    description: 'Descreva o problema que encontrou. Pode escrever, gravar voz ou anexar imagens.',
    titlePlaceholder: 'Ex: Erro ao guardar imóvel',
    descriptionPlaceholder: 'Descreva o que aconteceu, onde aconteceu e o que esperava que acontecesse...',
    successMessage: 'Ticket enviado com sucesso! A equipa técnica irá analisar.',
  },
  ideia: {
    icon: Lightbulb,
    title: 'Sugerir Ideia',
    description: 'Partilhe a sua ideia. Pode escrever, gravar voz ou anexar imagens.',
    titlePlaceholder: 'Ex: Adicionar filtro por zona no mapa',
    descriptionPlaceholder: 'Descreva a sua ideia em detalhe: o que gostaria de ver, como funcionaria...',
    successMessage: 'Ideia enviada com sucesso! A equipa técnica irá avaliar.',
  },
}

const MAX_IMAGES = 5

export function FeedbackDialog({ type, open, onOpenChange }: FeedbackDialogProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [page, setPage] = useState<FeedbackPage | ''>('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { compressImage, isCompressing } = useImageCompress()
  const config = CONFIG[type]
  const Icon = config.icon

  // Auto-pré-selecciona a página actual quando o diálogo abre — o utilizador
  // pode substituir. Reseta entre aberturas para apanhar mudanças de rota.
  useEffect(() => {
    if (!open) return
    if (page) return
    const detected = pathnameToFeedbackPage(pathname)
    if (detected) setPage(detected)
  }, [open, pathname, page])

  const handleTranscription = (text: string) => {
    if (!title) {
      const firstSentence = text.match(/^[^.!?]+[.!?]?/)?.[0] || text
      const rest = text.slice(firstSentence.length).trim()
      setTitle(firstSentence.trim())
      if (rest) {
        setDescription((prev) => (prev ? `${prev}\n${rest}` : rest))
      }
    } else {
      setDescription((prev) => (prev ? `${prev}\n${text}` : text))
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens`)
      return
    }

    const toProcess = files.slice(0, remaining)

    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file)
        const preview = URL.createObjectURL(compressed)
        setImages((prev) => [...prev, { file: compressed, preview }])
      } catch {
        toast.error(`Erro ao comprimir ${file.name}`)
      }
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = []
    for (const img of images) {
      const formData = new FormData()
      formData.append('file', img.file)
      const res = await fetch('/api/feedback/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Erro ao fazer upload de imagem')
      const { url } = await res.json()
      urls.push(url)
    }
    return urls
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Título é obrigatório')
      return
    }
    if (!page) {
      toast.error(
        type === 'ticket'
          ? 'Indica em que secção detetaste isto'
          : 'Indica em que secção devemos implementar',
      )
      return
    }

    setIsSubmitting(true)
    try {
      // Upload images first
      let imageUrls: string[] = []
      if (images.length > 0) {
        imageUrls = await uploadImages()
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || null,
          images: imageUrls,
          page,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar')
      }

      toast.success(config.successMessage)
      // Cleanup
      images.forEach((img) => URL.revokeObjectURL(img.preview))
      setTitle('')
      setDescription('')
      setPage('')
      setImages([])
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className={cn('px-6 pb-4 border-b border-border/40 shrink-0', isMobile ? 'pt-8' : 'pt-6')}>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5" />
            {config.title}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            {config.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          {/* Card 1 — Voice recorder */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Gravar descrição por voz
            </span>
            <VoiceRecorder onTranscription={handleTranscription} />
          </div>

          {/* Card 2 — Título → Secção → Descrição */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Título</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={config.titlePlaceholder}
              />
            </div>

            {/* Page (auto-detect + manual override). Obrigatório, simplifica
                triagem na tech pipeline. Copy difere por tipo: bug pergunta
                onde foi detectado; ideia pergunta onde implementar. */}
            <div className="space-y-2">
              <Label htmlFor="feedback-page">
                {type === 'ticket'
                  ? 'Em que secção detetaste isto?'
                  : 'Em que secção devemos implementar?'}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Select value={page} onValueChange={(v) => setPage(v as FeedbackPage)}>
                <SelectTrigger id="feedback-page">
                  <SelectValue placeholder="Escolhe a secção…" />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_PAGES.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feedback-desc">Descrição</Label>
              <Textarea
                id="feedback-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={config.descriptionPlaceholder}
                rows={4}
              />
            </div>
          </div>

          {/* Card 3 — Imagens */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Imagens ({images.length}/{MAX_IMAGES})</Label>
              {images.length < MAX_IMAGES && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing}
                >
                  {isCompressing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {isCompressing ? 'A comprimir...' : 'Adicionar'}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.preview}
                      alt={`Imagem ${i + 1}`}
                      className="h-16 w-16 rounded-md object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer translúcido — Cancelar + Enviar sempre visíveis */}
        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || isCompressing || !title.trim() || !page}
            className="min-w-[100px]"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
