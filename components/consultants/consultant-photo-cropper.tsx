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
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Monitor, Smartphone, Upload } from 'lucide-react'
import getCroppedImg from '@/lib/crop-image'

interface ConsultantPhotoCropperProps {
  imageSrc: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropDone: (croppedBlob: Blob) => void
  consultantName?: string
}

export function ConsultantPhotoCropper({
  imageSrc,
  open,
  onOpenChange,
  onCropDone,
  consultantName = 'Consultor',
}: ConsultantPhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Preview generation
  const updatePreview = useCallback(async (area: Area | null) => {
    if (!area) return
    try {
      const blob = await getCroppedImg(imageSrc, area)
      if (blob) {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }
    } catch {
      // silently fail preview
    }
  }, [imageSrc])

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
    updatePreview(croppedPixels)
  }, [updatePreview])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (blob) {
        onCropDone(blob)
        onOpenChange(false)
      }
    } catch (err) {
      console.error('Erro ao recortar imagem:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    onOpenChange(open)
  }

  const displayUrl = previewUrl || imageSrc
  const isCropped = !!previewUrl

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recortar foto de perfil</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Recomendado: foto retrato (3:4), rosto no topo 20% da imagem. Min. 600x800px.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* ─── Cropper ─── */}
          <div className="space-y-4">
            <div className="relative w-full h-[420px] bg-neutral-950 rounded-xl overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                showGrid
              />
            </div>

            <div className="flex items-center gap-4 px-1">
              <span className="text-sm text-muted-foreground shrink-0 w-12">Zoom</span>
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={1}
                max={3}
                step={0.05}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                {zoom.toFixed(1)}x
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground px-1">
              Proporção fixa 3:4 (retrato). Ajuste o zoom e arraste para posicionar o rosto na zona superior.
            </p>
          </div>

          {/* ─── Previews Panel ─── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Pré-visualização</h3>
              <Badge variant="secondary" className="text-[10px] rounded-full">
                6 contextos
              </Badge>
            </div>

            <div className="space-y-4 pb-2">
              {/* Website Card Desktop — 3:4 */}
              <PreviewCard label="Website Card (Desktop)" sublabel="3:4 retrato" icon={Monitor}>
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '3/4', width: 150 }}>
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: isCropped ? 'center' : 'center 20%' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <span className="inline-flex bg-black/50 backdrop-blur-md text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                      {consultantName.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </PreviewCard>

              {/* Website Card Mobile — 4:3.5 */}
              <PreviewCard label="Website Card (Mobile)" sublabel="~4:3.5 paisagem" icon={Smartphone}>
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '4/3.5', width: 180 }}>
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: isCropped ? 'center' : 'center 20%' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1.5 left-2">
                    <span className="inline-flex bg-black/50 backdrop-blur-md text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
                      {consultantName.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </PreviewCard>

              {/* Website Modal Mobile — wider crop */}
              <PreviewCard label="Website Modal (Mobile)" sublabel="topo da folha" icon={Smartphone}>
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '16/11', width: 180 }}>
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: isCropped ? 'center' : 'center 10%' }}
                  />
                </div>
              </PreviewCard>

              {/* Leadership / Square — 1:1 */}
              <PreviewCard label="Lideranca (1:1)" sublabel="quadrado, centro 20%" icon={Monitor}>
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '1/1', width: 120 }}>
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: isCropped ? 'center' : 'center 20%' }}
                  />
                </div>
              </PreviewCard>

              {/* ERP Card — 3:4 centered */}
              <PreviewCard label="ERP Card (Plataforma)" sublabel="3:4 centrado" icon={Monitor}>
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '3/4', width: 130 }}>
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                    style={{ objectPosition: isCropped ? 'center' : 'center' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <span className="inline-flex bg-black/50 backdrop-blur-md text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                      {consultantName.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </PreviewCard>

              {/* ERP Avatar — circle */}
              <PreviewCard label="ERP Avatar" sublabel="circular" icon={Monitor}>
                <div className="h-16 w-16 rounded-full overflow-hidden bg-muted ring-2 ring-background shadow-md">
                  <img
                    src={displayUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: isCropped ? 'center' : 'center 20%' }}
                  />
                </div>
              </PreviewCard>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? (
              <Spinner variant="infinite" size={16} className="mr-2" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Guardar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewCard({
  label,
  sublabel,
  icon: Icon,
  children,
}: {
  label: string
  sublabel: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border bg-card/50">
      <div className="shrink-0">{children}</div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs font-medium">{label}</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </div>
  )
}
