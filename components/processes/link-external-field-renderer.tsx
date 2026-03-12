'use client'

import { useFieldArray, useFormContext } from 'react-hook-form'
import {
  FormField, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import type { FieldRendererProps } from './dynamic-form-renderer'

/**
 * Renderer para campos do tipo `link_external`.
 * Permite adicionar/remover grupos de links (nome do site, URL, data de publicação).
 * Persiste como array JSONB no campo `listing_links` de `dev_property_internal`.
 */
export function LinkExternalFieldRenderer({ field, name, control }: FieldRendererProps) {
  const { watch, setValue } = useFormContext()

  // O valor é um array de objectos { site_name, url, published_at? }
  const links: { site_name: string; url: string; published_at?: string }[] =
    (watch(name) as any[]) || []

  const addLink = () => {
    setValue(name, [...links, { site_name: '', url: '', published_at: '' }], { shouldDirty: true })
  }

  const removeLink = (index: number) => {
    setValue(name, links.filter((_, i) => i !== index), { shouldDirty: true })
  }

  const updateLink = (index: number, key: string, value: string) => {
    const updated = links.map((link, i) =>
      i === index ? { ...link, [key]: value } : link
    )
    setValue(name, updated, { shouldDirty: true })
  }

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addLink}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Link
            </Button>
          </div>

          {links.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center">
              <ExternalLink className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="text-sm text-muted-foreground">
                Nenhum link de anúncio adicionado.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adicione os portais onde este imóvel está publicado.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {links.map((link, index) => (
              <div
                key={index}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Anúncio {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeLink(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Nome do Site <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={link.site_name}
                      onChange={(e) => updateLink(index, 'site_name', e.target.value)}
                      placeholder="Ex: Idealista"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Data de Publicação
                    </label>
                    <DatePicker
                      value={link.published_at || ''}
                      onChange={(val) => updateLink(index, 'published_at', val)}
                      placeholder="Seleccionar data..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Link <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>

                {link.url && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir link
                  </a>
                )}
              </div>
            ))}
          </div>

          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
