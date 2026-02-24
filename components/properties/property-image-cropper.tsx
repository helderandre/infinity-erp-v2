'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Loader2, RectangleHorizontal, Square, Unlock } from 'lucide-react'
import getCroppedImg from '@/lib/crop-image'

const ASPECT_OPTIONS = [
  { label: '16:9', value: 16 / 9, icon: RectangleHorizontal },
  { label: '1:1', value: 1, icon: Square },
  { label: 'Livre', value: 0, icon: Unlock },
] as const

interface PropertyImageCropperProps {
  imageSrc: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropDone: (croppedBlob: Blob) => void
  aspect?: number
}

export function PropertyImageCropper({
  imageSrc,
  open,
  onOpenChange,
  onCropDone,
  aspect: initialAspect = 16 / 9,
}: PropertyImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState(initialAspect)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (blob) {
        onCropDone(blob)
        onOpenChange(false)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const isFreeAspect = aspect === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recortar imagem</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-muted rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={isFreeAspect ? undefined : aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-4 px-2">
          <span className="text-sm text-muted-foreground shrink-0">Proporção</span>
          <div className="flex gap-1">
            {ASPECT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = aspect === opt.value
              return (
                <Button
                  key={opt.label}
                  type="button"
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setAspect(opt.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 px-2">
          <span className="text-sm text-muted-foreground shrink-0">Zoom</span>
          <Slider
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            min={1}
            max={3}
            step={0.1}
            className="flex-1"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
