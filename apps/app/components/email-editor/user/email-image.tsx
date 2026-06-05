'use client'

import { useRef, useState } from 'react'
import { useNode } from '@craftjs/core'
import { ImageIcon } from 'lucide-react'
import { useImageCompress } from '@/hooks/use-image-compress'
import { toast } from 'sonner'
import {
  EmailImageForm,
  EMAIL_IMAGE_FORM_DEFAULTS,
  type EmailImageFormProps,
} from '@/components/email-editor/shared/email-block-forms'

type EmailImageProps = EmailImageFormProps

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
    <div className="space-y-4 p-3">
      <EmailImageForm
        props={props}
        onChange={(patch) =>
          setProp((p: EmailImageProps) => {
            Object.assign(p, patch)
          })
        }
        onUpload={() => fileInputRef.current?.click()}
        uploading={isUploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleFileSelect}
        aria-label="Escolher imagem"
      />
    </div>
  )
}

EmailImage.craft = {
  displayName: 'Imagem',
  props: { ...EMAIL_IMAGE_FORM_DEFAULTS },
  related: {
    settings: EmailImageSettings,
  },
}
