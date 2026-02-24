'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PropertyImageCropper } from './property-image-cropper'
import { useImageCompress } from '@/hooks/use-image-compress'
import { ImagePlus, X, Crop, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface PropertyMediaUploadProps {
  propertyId: string
  onUploadComplete: () => void
}

interface PendingImage {
  id: string
  file: File
  preview: string
  croppedFile?: File
}

export function PropertyMediaUpload({
  propertyId,
  onUploadComplete,
}: PropertyMediaUploadProps) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [cropImage, setCropImage] = useState<PendingImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { compressImages, isCompressing, progress: compressProgress } = useImageCompress()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newPending = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))

    setPendingImages((prev) => [...prev, ...newPending])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePending = (id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  const handleCropDone = useCallback(
    (blob: Blob) => {
      if (!cropImage) return
      const file = new File([blob], cropImage.file.name.replace(/\.[^.]+$/, '.webp'), {
        type: 'image/webp',
      })
      const newPreview = URL.createObjectURL(file)

      setPendingImages((prev) =>
        prev.map((p) => {
          if (p.id === cropImage.id) {
            URL.revokeObjectURL(p.preview)
            return { ...p, croppedFile: file, preview: newPreview }
          }
          return p
        })
      )
      setCropImage(null)
    },
    [cropImage]
  )

  const handleUpload = async () => {
    if (!pendingImages.length) return
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Compress all images
      const filesToCompress = pendingImages.map((p) => p.croppedFile || p.file)
      const compressed = await compressImages(filesToCompress)

      // Upload each compressed image
      for (let i = 0; i < compressed.length; i++) {
        const formData = new FormData()
        formData.append('file', compressed[i])

        const res = await fetch(`/api/properties/${propertyId}/media`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao fazer upload')
        }

        setUploadProgress(Math.round(((i + 1) / compressed.length) * 100))
      }

      // Cleanup previews
      pendingImages.forEach((p) => URL.revokeObjectURL(p.preview))
      setPendingImages([])
      toast.success(`${compressed.length} imagem(ns) enviada(s) com sucesso`)
      onUploadComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const isBusy = isUploading || isCompressing

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Adicionar Imagens
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {pendingImages.length > 0 && (
          <Button size="sm" onClick={handleUpload} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar {pendingImages.length} imagem(ns)
          </Button>
        )}
      </div>

      {isBusy && (
        <div className="space-y-1">
          <Progress value={isCompressing ? compressProgress : uploadProgress} />
          <p className="text-xs text-muted-foreground">
            {isCompressing ? 'A comprimir imagens...' : 'A enviar imagens...'}
          </p>
        </div>
      )}

      {pendingImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {pendingImages.map((img) => (
            <div key={img.id} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => setCropImage(img)}
                >
                  <Crop className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => removePending(img.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cropImage && (
        <PropertyImageCropper
          imageSrc={cropImage.preview}
          open={!!cropImage}
          onOpenChange={(open) => !open && setCropImage(null)}
          onCropDone={handleCropDone}
        />
      )}
    </div>
  )
}
