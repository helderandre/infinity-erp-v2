'use client'

import { useRef, useState } from 'react'
import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight, ImageIcon, Upload, Loader2, X } from 'lucide-react'
import { useImageCompress } from '@/hooks/use-image-compress'
import { toast } from 'sonner'
import { UnitInput, RadiusInput } from '@/components/email-editor/settings'

const SHADOW_PRESETS = [
  { value: 'none', label: 'Nenhuma' },
  { value: '0 1px 2px 0 rgba(0,0,0,0.05)', label: 'Extra Leve' },
  { value: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', label: 'Leve' },
  { value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', label: 'Média' },
  { value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', label: 'Grande' },
]

interface EmailImageProps {
  src?: string
  alt?: string
  width?: number
  height?: number
  align?: string
  href?: string
  borderRadius?: string
  boxShadow?: string
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp'

export const EmailImage = ({
  src = '',
  alt = '',
  width = 100,
  height = 0,
  align = 'center',
  href = '',
  borderRadius = '0px',
  boxShadow = 'none',
}: EmailImageProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  const imgEl = src ? (
    <img
      src={src}
      alt={alt}
      style={{
        width: `${width}%`,
        height: height > 0 ? height : 'auto',
        borderRadius,
        display: 'block',
        maxWidth: '100%',
        objectFit: height > 0 ? 'cover' : undefined,
        boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
      }}
    />
  ) : (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded border border-dashed p-8 text-muted-foreground"
      style={{
        width: `${width}%`,
        height: height > 0 ? height : undefined,
      }}
    >
      <ImageIcon className="h-8 w-8" />
      <span className="text-sm">Seleccione para carregar imagem</span>
    </div>
  )

  const content = href && src ? <a href={href}>{imgEl}</a> : imgEl

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{ textAlign: align as React.CSSProperties['textAlign'] }}
    >
      {content}
    </div>
  )
}

const EmailImageSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailImageProps,
  }))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { compressImage } = useImageCompress()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (file.type === 'image/svg+xml') {
      toast.error('Formato SVG não é suportado. Use JPEG, PNG ou WebP.')
      return
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Tipo de ficheiro não suportado. Use JPEG, PNG ou WebP.')
      return
    }

    setIsUploading(true)
    try {
      const compressed = await compressImage(file)

      const formData = new FormData()
      formData.append('file', compressed)

      const res = await fetch('/api/libraries/emails/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao carregar imagem')
      }

      const { url } = await res.json()
      setProp((p: EmailImageProps) => { p.src = url })
      toast.success('Imagem carregada com sucesso')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar imagem')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Imagem</Label>
        {props.src && (
          <div className="relative rounded-md overflow-hidden border">
            <img src={props.src} alt={props.alt || ''} className="w-full h-auto" />
            <div className="flex gap-2 p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-3 w-3" />
                Trocar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setProp((p: EmailImageProps) => { p.src = '' })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {!props.src && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'A carregar...' : 'Carregar imagem'}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      <div className="space-y-2">
        <Label>Ou insira URL</Label>
        <Input
          type="text"
          placeholder="https://..."
          className="font-mono text-xs"
          value={props.src}
          onChange={(e) => setProp((p: EmailImageProps) => { p.src = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Texto alternativo</Label>
        <Input
          type="text"
          placeholder="Descrição da imagem"
          value={props.alt}
          onChange={(e) => setProp((p: EmailImageProps) => { p.alt = e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Largura</Label>
        <UnitInput
          value={`${props.width ?? 100}%`}
          onChange={(v) => setProp((p: EmailImageProps) => { p.width = Math.min(100, Math.max(10, parseFloat(v) || 100)) })}
          units={['%']}
        />
      </div>
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.align}
          onValueChange={(v) => {
            if (v) setProp((p: EmailImageProps) => { p.align = v })
          }}
        >
          <ToggleGroupItem value="left" aria-label="Esquerda">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Direita">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <RadiusInput
        value={props.borderRadius || '0px'}
        onChange={(v) => setProp((p: EmailImageProps) => { p.borderRadius = v })}
      />
      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => setProp((p: EmailImageProps) => { p.boxShadow = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOW_PRESETS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

EmailImage.craft = {
  displayName: 'Imagem',
  props: {
    src: '',
    alt: '',
    width: 100,
    height: 0,
    align: 'center',
    href: '',
    borderRadius: '0px',
    boxShadow: 'none',
  },
  related: {
    settings: EmailImageSettings,
  },
}
