'use client'

import { useRef, useState } from 'react'
import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight, ImageIcon, Upload, Loader2 } from 'lucide-react'
import { useImageCompress } from '@/hooks/use-image-compress'
import { toast } from 'sonner'

interface EmailImageProps {
  src?: string
  alt?: string
  width?: number
  align?: string
  href?: string
  borderRadius?: number
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp'

export const EmailImage = ({
  src = '',
  alt = '',
  width = 100,
  align = 'center',
  href = '',
  borderRadius = 0,
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
        borderRadius,
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  ) : (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded border border-dashed p-8 text-muted-foreground"
      style={{ width: `${width}%` }}
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
    src,
    alt,
    width,
    align,
    href,
    borderRadius,
  } = useNode((node) => ({
    src: node.data.props.src,
    alt: node.data.props.alt,
    width: node.data.props.width,
    align: node.data.props.align,
    href: node.data.props.href,
    borderRadius: node.data.props.borderRadius,
  }))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { compressImage } = useImageCompress()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-selected
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
        <div className="flex gap-2">
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
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>URL da Imagem</Label>
        <Input
          type="text"
          placeholder="https://..."
          value={src}
          onChange={(e) => setProp((p: EmailImageProps) => { p.src = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Texto Alternativo</Label>
        <Input
          type="text"
          placeholder="Descrição da imagem"
          value={alt}
          onChange={(e) => setProp((p: EmailImageProps) => { p.alt = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Largura ({width}%)</Label>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[width]}
          onValueChange={([v]) => setProp((p: EmailImageProps) => { p.width = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={align}
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
      <div className="space-y-2">
        <Label>Link ao Clicar</Label>
        <Input
          type="text"
          placeholder="https://..."
          value={href}
          onChange={(e) => setProp((p: EmailImageProps) => { p.href = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Raio da Borda ({borderRadius}px)</Label>
        <Slider
          min={0}
          max={20}
          step={1}
          value={[borderRadius]}
          onValueChange={([v]) => setProp((p: EmailImageProps) => { p.borderRadius = v })}
        />
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
    align: 'center',
    href: '',
    borderRadius: 0,
  },
  related: {
    settings: EmailImageSettings,
  },
}
