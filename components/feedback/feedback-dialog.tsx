'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Bug, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { VoiceRecorder } from './voice-recorder'
import { useImageCompress } from '@/hooks/use-image-compress'

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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { compressImage, isCompressing } = useImageCompress()
  const config = CONFIG[type]
  const Icon = config.icon

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
      setImages([])
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Voice recorder */}
          <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
            <span className="text-sm text-muted-foreground">
              Gravar descrição por voz
            </span>
            <VoiceRecorder onTranscription={handleTranscription} />
          </div>

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

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Imagens ({images.length}/{MAX_IMAGES})</Label>
              {images.length < MAX_IMAGES && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isCompressing || !title.trim()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
