'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  Eye,
  Pencil,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn, interpolateVariables } from '@/lib/utils'
import { DocumentEditor } from '@/components/document-editor/document-editor'
import { DocumentVariablesSidebar } from '@/components/document-editor/document-variables-sidebar'
import type { DocumentEditorRef } from '@/components/document-editor/types'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskDocSheetProps {
  subtask: ProcSubtask
  propertyId: string
  processId: string
  taskId: string
  consultantId?: string
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
  consultantId,
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
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  const [resolvedVariables, setResolvedVariables] = useState<Record<string, string>>({})

  const { variables: templateVariables } = useTemplateVariables()
  const editorRef = useRef<DocumentEditorRef>(null)
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
        consultant_id: consultantId ?? undefined,
        process_id: processId ?? undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const vars: Record<string, string> = d.variables ?? {}
        setResolvedVariables(vars)
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
  }, [open, subtask, propertyId, consultantId, processId])

  const getEditorHtml = useCallback((): string => {
    if (editorRef.current) {
      return editorRef.current.getHTML()
    }
    return renderedHtml
  }, [renderedHtml])

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
      const html = getEditorHtml()
      await callSubtaskApi({
        rendered_content: {
          body_html: html,
        },
      })
      localDraftRef.current = { subtaskId: subtask.id, html }
      setRenderedHtml(html)
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
      const html = getEditorHtml()
      await callSubtaskApi({
        rendered_content: {
          body_html: html,
        },
        is_completed: true,
      })
      toast.success('Documento marcado como concluído!')
      onComplete()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao concluir')
    } finally {
      setIsCompleting(false)
    }
  }

  const handlePrint = () => {
    const html = getEditorHtml()
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>${templateName || subtask.title}</title>
        <style>
          body {
            font-family: 'Source Serif 4', Georgia, serif;
            padding: 2rem;
            max-width: 800px;
            margin: auto;
            font-size: 12pt;
            line-height: 1.6;
          }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ddd; padding: 8px; }
          img { max-width: 100%; }
        </style>
      </head><body>${html}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleSwitchToPreview = () => {
    const html = getEditorHtml()
    setPreviewHtml(html)
    setActiveTab('preview')
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

  const isCompleted = subtask.is_completed

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col p-0"
        style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw', height: '100dvh' }}
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
                {isCompleted && (
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Concluído
                  </Badge>
                )}
              </div>
            </div>
            {/* Edit / Preview toggle */}
            {renderedHtml && !isLoading && !error && (
              <div className="flex items-center gap-1 shrink-0 self-center">
                <button
                  onClick={() => setActiveTab('edit')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5',
                    activeTab === 'edit'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={handleSwitchToPreview}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5',
                    activeTab === 'preview'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Pré-visualizar
                </button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        {isLoading ? (
          <div className="p-6 space-y-3 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-28 mt-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 flex-1">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          </div>
        ) : renderedHtml ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Editor + Variables Sidebar — always mounted to preserve state */}
            <div className={cn('flex-1 overflow-hidden flex flex-row', activeTab !== 'edit' && 'hidden')}>
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <DocumentEditor
                  ref={editorRef}
                  content={renderedHtml}
                  mode={isCompleted ? 'readonly' : 'document'}
                  placeholder="Conteúdo do documento..."
                />
              </div>
              {!isCompleted && templateVariables.length > 0 && (
                <DocumentVariablesSidebar
                  allVariables={templateVariables}
                  resolvedVariables={resolvedVariables}
                  onVariableClick={(key) => {
                    const resolved = resolvedVariables[key]
                    if (resolved && editorRef.current?.editor) {
                      editorRef.current.editor.chain().focus().insertContent(resolved).run()
                    }
                  }}
                />
              )}
            </div>

            {/* Preview */}
            {activeTab === 'preview' && (
              <div className="flex-1 overflow-auto bg-muted/30 p-6">
                <div
                  className="mx-auto rounded-md border bg-white shadow-lg"
                  style={{ width: '210mm', minHeight: '297mm' }}
                >
                  <div
                    className="prose prose-sm sm:prose-base max-w-none px-10 py-8"
                    style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: '12pt', lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        {renderedHtml && !isCompleted ? (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
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
                className="rounded-full"
                onClick={handlePrint}
                disabled={isSaving || isCompleting}
              >
                <Download className="mr-2 h-4 w-4" />
                Imprimir / PDF
              </Button>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={handleMarkAsComplete}
              disabled={isSaving || isCompleting}
            >
              {isCompleting ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Marcar como Concluído
            </Button>
          </div>
        ) : renderedHtml && isCompleted ? (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Documento concluído.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
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
