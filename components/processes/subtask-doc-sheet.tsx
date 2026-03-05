'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  CheckCircle2,
  Save,
  AlertCircle,
  User,
  Building2,
  Download,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn, interpolateVariables } from '@/lib/utils'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskDocSheetProps {
  subtask: ProcSubtask
  propertyId: string
  processId: string
  taskId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
  onSaveDraft?: () => void
}

function getDocLibraryId(subtask: ProcSubtask): string | undefined {
  const c = subtask.config as Record<string, unknown>
  if (c.has_person_type_variants) {
    const personType = (subtask as unknown as { owner?: { person_type?: string } }).owner?.person_type
    if (personType === 'singular') return (c.singular_config as Record<string, string> | undefined)?.doc_library_id
    if (personType === 'coletiva') return (c.coletiva_config as Record<string, string> | undefined)?.doc_library_id
  }
  return c.doc_library_id as string | undefined
}

export function SubtaskDocSheet({
  subtask,
  propertyId,
  processId,
  taskId,
  open,
  onOpenChange,
  onComplete,
  onSaveDraft: onSaveDraftProp,
}: SubtaskDocSheetProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renderedHtml, setRenderedHtml] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)

  const localDraftRef = useRef<{ subtaskId: string; html: string } | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)

    // Fetch preview variables
    const previewDataPromise = fetch('/api/libraries/emails/preview-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        owner_id: (subtask as unknown as { owner_id?: string }).owner_id ?? undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const vars: Record<string, string> = d.variables ?? {}
        return vars
      })
      .catch(() => ({} as Record<string, string>))

    // Priority 1: local draft from this session
    if (localDraftRef.current?.subtaskId === subtask.id) {
      setRenderedHtml(localDraftRef.current.html)
      setHasRendered(true)
      void previewDataPromise
      return
    }

    // Priority 2: saved rendered content from DB
    const rendered = (subtask.config as Record<string, unknown>).rendered as
      | { body_html?: string }
      | undefined

    if (rendered?.body_html) {
      setRenderedHtml(rendered.body_html)
      setHasRendered(true)
      void previewDataPromise
      return
    }

    // Priority 3: load template from library
    const docLibraryId = getDocLibraryId(subtask)
    if (!docLibraryId) {
      setError('Sem template de documento configurado para esta subtarefa.')
      return
    }

    setIsLoading(true)

    Promise.all([
      fetch(`/api/libraries/docs/${docLibraryId}`).then((r) => r.json()),
      previewDataPromise,
    ])
      .then(([templateData, variables]) => {
        if (templateData.error) {
          setError(templateData.error)
          return
        }

        setTemplateName(templateData.name ?? 'Documento')

        if (templateData.content_html) {
          const populated = interpolateVariables(templateData.content_html, variables)
          setRenderedHtml(populated)
        } else {
          setError(
            'Este template não tem conteúdo HTML configurado. Edite o template na biblioteca de documentos.'
          )
        }
      })
      .catch(() => setError('Erro ao carregar o template de documento.'))
      .finally(() => setIsLoading(false))
  }, [open, subtask, propertyId])

  const callSubtaskApi = async (payload: Record<string, unknown>) => {
    const res = await fetch(
      `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erro na operacao')
    }
    return res.json()
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      await callSubtaskApi({
        rendered_content: {
          body_html: renderedHtml,
        },
      })
      localDraftRef.current = { subtaskId: subtask.id, html: renderedHtml }
      setHasRendered(true)
      toast.success('Rascunho do documento guardado!')
      onSaveDraftProp?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar rascunho')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkAsComplete = async () => {
    setIsCompleting(true)
    try {
      await callSubtaskApi({
        rendered_content: {
          body_html: renderedHtml,
        },
        is_completed: true,
      })
      toast.success('Documento marcado como concluido!')
      onComplete()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao concluir')
    } finally {
      setIsCompleting(false)
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>${templateName || subtask.title}</title>
        <style>body{font-family:Arial,sans-serif;padding:2rem;max-width:800px;margin:auto;}</style>
      </head><body>${renderedHtml}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const ownerInfo = (subtask as unknown as { owner?: { person_type?: string; name?: string } }).owner
  const ownerBadge = ownerInfo ? (
    <Badge
      variant="outline"
      className={cn(
        'text-xs shrink-0',
        ownerInfo.person_type === 'singular'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-purple-50 text-purple-700 border-purple-200'
      )}
    >
      {ownerInfo.person_type === 'singular' ? (
        <User className="mr-1 h-3 w-3" />
      ) : (
        <Building2 className="mr-1 h-3 w-3" />
      )}
      {ownerInfo.name}
    </Badge>
  ) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col p-0 sm:max-w-3xl"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-purple-100 p-1.5 shrink-0">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-snug">{subtask.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {ownerBadge}
                {hasRendered && (
                  <Badge variant="secondary" className="text-xs">
                    <Save className="mr-1 h-3 w-3" />
                    Rascunho guardado
                  </Badge>
                )}
                {subtask.is_completed && (
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Concluido
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        {isLoading ? (
          <div className="p-6 space-y-3 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 flex-1">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          </div>
        ) : renderedHtml ? (
          <div className="flex-1 overflow-auto bg-muted/30 p-6">
            <div
              className="mx-auto rounded-md border bg-white p-8 prose prose-sm max-w-none"
              style={{ maxWidth: 720 }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        ) : null}

        {/* Footer */}
        {renderedHtml && !subtask.is_completed ? (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isCompleting}
              >
                {isSaving ? (
                  <Spinner variant="infinite" size={16} className="mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar Rascunho
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isSaving || isCompleting}
              >
                <Download className="mr-2 h-4 w-4" />
                Imprimir / PDF
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleMarkAsComplete}
              disabled={isSaving || isCompleting}
            >
              {isCompleting ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Marcar como Concluido
            </Button>
          </div>
        ) : renderedHtml && subtask.is_completed ? (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Documento concluido.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
            >
              <Download className="mr-2 h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
