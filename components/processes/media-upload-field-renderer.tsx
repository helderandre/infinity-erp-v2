'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageIcon } from 'lucide-react'
import { PropertyMediaUpload } from '@/components/properties/property-media-upload'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import type { PropertyMedia } from '@/types/property'
import type { FieldRendererProps } from './dynamic-form-renderer'

interface MediaUploadContext {
  propertyId?: string
}

/**
 * Renderer para o campo `media_upload`.
 * Integra PropertyMediaUpload + PropertyMediaGallery dentro do DynamicFormRenderer.
 *
 * O campo no form armazena a contagem de imagens (para validação min).
 * Os uploads vão directamente para /api/properties/{propertyId}/media.
 */
export function MediaUploadFieldRenderer({
  field,
  name,
  context,
}: FieldRendererProps & { context?: MediaUploadContext }) {
  const form = useFormContext()
  const propertyId = context?.propertyId
  const [media, setMedia] = useState<PropertyMedia[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMedia = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/media`)
      if (res.ok) {
        const data = await res.json()
        setMedia(data)
        // Actualizar contagem no form para validação
        form.setValue(name, data.length, { shouldDirty: false })
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false)
    }
  }, [propertyId, form, name])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  if (!propertyId) {
    return (
      <FormItem>
        <FormLabel>{field.label}</FormLabel>
        <p className="text-sm text-muted-foreground">
          Não foi possível determinar o imóvel associado.
        </p>
      </FormItem>
    )
  }

  return (
    <FormItem>
      <div className="flex items-center justify-between">
        <FormLabel>
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </FormLabel>
        {!loading && (
          <Badge variant="secondary" className="text-xs gap-1">
            <ImageIcon className="h-3 w-3" />
            {media.length} {media.length === 1 ? 'imagem' : 'imagens'}
          </Badge>
        )}
      </div>
      {field.help_text && <FormDescription>{field.help_text}</FormDescription>}

      <div className="space-y-4">
        {/* Upload de novas imagens */}
        <PropertyMediaUpload
          propertyId={propertyId}
          onUploadComplete={fetchMedia}
        />

        {/* Galeria de imagens existentes */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="aspect-video rounded-md" />
            <Skeleton className="aspect-video rounded-md" />
            <Skeleton className="aspect-video rounded-md" />
          </div>
        ) : media.length > 0 ? (
          <PropertyMediaGallery
            propertyId={propertyId}
            media={media}
            onMediaChange={fetchMedia}
          />
        ) : null}
      </div>

      {field.required && field.min && media.length < field.min && !loading && (
        <p className="text-sm font-medium text-destructive">
          Mínimo de {field.min} {field.min === 1 ? 'imagem' : 'imagens'} obrigatório
        </p>
      )}
      <FormMessage />
    </FormItem>
  )
}
