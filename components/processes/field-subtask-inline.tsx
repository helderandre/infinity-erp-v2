'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Form, FormField, FormItem, FormControl, FormMessage,
} from '@/components/ui/form'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Loader2, Pencil, Maximize2, Eye, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { FIELD_COMPONENTS } from './dynamic-form-renderer'
import {
  Glimpse,
  GlimpseContent,
  GlimpseTrigger,
  GlimpseTitle,
  GlimpseDescription,
  GlimpseImage,
} from '@/components/kibo-ui/glimpse'
import type { ProcSubtask, FormFieldConfig, ListingLink } from '@/types/subtask'

// ─── OG Preview cache + fetcher ──────────────────────────
type OgData = { title: string | null; description: string | null; image: string | null }
const ogCache = new Map<string, OgData>()

function LinkPreviewCard({ link }: { link: ListingLink }) {
  const [og, setOg] = useState<OgData | null>(null)

  useEffect(() => {
    if (!link.url) return
    if (ogCache.has(link.url)) {
      setOg(ogCache.get(link.url)!)
      return
    }
    fetch(`/api/og-preview?url=${encodeURIComponent(link.url)}`)
      .then((r) => r.json())
      .then((data: OgData) => {
        ogCache.set(link.url, data)
        setOg(data)
      })
      .catch(() => setOg({ title: null, description: null, image: null }))
  }, [link.url])

  return (
    <Glimpse openDelay={200} closeDelay={100}>
      <GlimpseTrigger asChild>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          {link.site_name}
        </a>
      </GlimpseTrigger>
      <GlimpseContent side="top" className="w-80 p-0 overflow-hidden">
        {og?.image && (
          <GlimpseImage
            src={og.image}
            alt={og.title || link.site_name}
            className="mb-0 rounded-none border-0 border-b"
          />
        )}
        <div className="p-3 space-y-1">
          <GlimpseTitle>{og?.title || link.site_name}</GlimpseTitle>
          {og?.description && (
            <GlimpseDescription>{og.description}</GlimpseDescription>
          )}
          <p className="truncate text-xs text-muted-foreground/70">{link.url}</p>
          {link.published_at && (
            <p className="text-xs text-muted-foreground">
              Publicado: {new Date(link.published_at).toLocaleDateString('pt-PT')}
            </p>
          )}
        </div>
      </GlimpseContent>
    </Glimpse>
  )
}

interface FieldSubtaskInlineProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  onCompleted: () => Promise<void>
}

// Field types that benefit from expanded editing
const EXPANDABLE_TYPES = new Set(['textarea', 'rich_text', 'text'])

export function FieldSubtaskInline({
  subtask,
  processId,
  taskId,
  onCompleted,
}: FieldSubtaskInlineProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(!subtask.is_completed)
  const [expanded, setExpanded] = useState(false)
  const [currentValue, setCurrentValue] = useState<unknown>(null)

  const config = subtask.config || {}
  const fieldConfig = config.field as FormFieldConfig | undefined
  const autoComplete = config.auto_complete_on_save !== false

  const fieldKey = fieldConfig
    ? `${fieldConfig.target_entity}__${fieldConfig.field_name}`
    : ''

  const form = useForm<Record<string, unknown>>({
    defaultValues: { [fieldKey]: null },
  })

  const loadValue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}/form`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      const val = data.values?.[fieldKey] ?? null
      setCurrentValue(val)
      form.reset({ [fieldKey]: val })
    } catch {
      toast.error('Erro ao carregar valor do campo')
    } finally {
      setLoading(false)
    }
  }, [processId, taskId, subtask.id, fieldKey, form])

  useEffect(() => {
    if (fieldConfig) loadValue()
  }, [fieldConfig, loadValue])

  if (!fieldConfig) {
    return <p className="text-xs text-muted-foreground">Campo não configurado</p>
  }

  const Component = FIELD_COMPONENTS[fieldConfig.field_type]
  if (!Component) return null

  const isExpandable = EXPANDABLE_TYPES.has(fieldConfig.field_type)

  const handleSave = async () => {
    const values = form.getValues()
    const value = values[fieldKey]

    setSubmitting(true)
    try {
      const body: Record<string, Record<string, unknown>> = {
        [fieldConfig.target_entity]: {
          [fieldConfig.field_name]: value,
        },
      }
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}/form`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) throw new Error()
      setCurrentValue(value)
      toast.success('Campo guardado')
      setEditing(false)
      setExpanded(false)
      if (autoComplete) await onCompleted()
    } catch {
      toast.error('Erro ao guardar campo')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-10 w-full" />
  }

  // Read-only state
  if (!editing && subtask.is_completed) {
    // Special display for link_external (array of objects)
    if (fieldConfig.field_type === 'link_external' && Array.isArray(currentValue)) {
      const links = currentValue as ListingLink[]
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{fieldConfig.label}</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum link adicionado</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map((link, i) => (
                <LinkPreviewCard key={i} link={link} />
              ))}
            </div>
          )}
        </div>
      )
    }

    const isHtml = typeof currentValue === 'string' && currentValue.startsWith('<')
    const displayValue = currentValue === null || currentValue === undefined
      ? '—'
      : typeof currentValue === 'boolean'
        ? (currentValue ? 'Sim' : 'Não')
        : Array.isArray(currentValue)
          ? currentValue.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ')
          : isHtml
            ? '' // rendered below as HTML
            : String(currentValue)

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm flex-1">
            <span className="text-muted-foreground">{fieldConfig.label}:</span>{' '}
            {!isHtml && <span className="font-medium">{displayValue}</span>}
          </span>
          {isHtml && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setExpanded(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Visualizar</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isHtml && (
          <div
            className="text-sm prose prose-sm max-w-none rounded-md border px-3 py-2 bg-muted/30 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
            dangerouslySetInnerHTML={{ __html: currentValue as string }}
          />
        )}

        {/* Read-only expanded dialog */}
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{fieldConfig.label}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {isHtml ? (
                <div
                  className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: currentValue as string }}
                />
              ) : (
                <p className="text-sm">{displayValue}</p>
              )}
            </div>
            <div className="pt-3 border-t flex justify-end">
              <Button variant="outline" onClick={() => setExpanded(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Field editor content (shared between inline and dialog)
  const fieldEditor = (
    <Component
      field={fieldConfig}
      name={fieldKey}
      control={form.control as never}
    />
  )

  const actionButtons = (
    <div className="flex justify-end gap-2">
      {subtask.is_completed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            form.reset({ [fieldKey]: currentValue })
            setEditing(false)
            setExpanded(false)
          }}
        >
          Cancelar
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        disabled={submitting}
        onClick={handleSave}
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Guardar
          </>
        )}
      </Button>
    </div>
  )

  // Editing state
  return (
    <Form {...form}>
      <div className="space-y-2">
        {fieldEditor}
        <div className="flex items-center justify-between">
          {isExpandable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="h-3 w-3 mr-1" />
              Expandir
            </Button>
          ) : (
            <div />
          )}
          {actionButtons}
        </div>
      </div>

      {/* Expanded dialog for larger editing */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{fieldConfig.label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
            {fieldEditor}
          </div>
          <div className="pt-3 border-t">
            {actionButtons}
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
