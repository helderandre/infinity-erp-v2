'use client'

import { useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, FileDown, FileX, Copy } from 'lucide-react'
import { CopyButton } from '@/components/shared/copy-button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { ProcSubtask, ExternalFormField } from '@/types/subtask'
import type { ProcessInstance, ProcessOwner, ProcessDocument } from '@/types/process'

interface ExternalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtask: ProcSubtask
  property: ProcessInstance['property']
  owner?: ProcessOwner
  processDocuments: ProcessDocument[]
  onComplete: () => void
  isCompleting?: boolean
}

interface ResolvedDocShortcut {
  label: string
  doc_type_id: string
  available: boolean
  file_url: string | null
  file_name: string | null
}

function resolveFieldValue(
  field: ExternalFormField,
  property: ProcessInstance['property'],
  owner?: ProcessOwner
): string {
  if (!property && !owner) return ''

  switch (field.target_entity) {
    case 'property':
      return String((property as any)?.[field.field_name] ?? '')
    case 'property_specs':
      return String((property?.specs as any)?.[field.field_name] ?? '')
    case 'property_internal':
      return String((property?.internal as any)?.[field.field_name] ?? '')
    case 'owner':
    case 'property_owner':
      return String((owner as any)?.[field.field_name] ?? '')
    default:
      return ''
  }
}

function formatValue(value: string | number, fmt?: string): string {
  if (value === '' || value === null || value === undefined) return '—'
  switch (fmt) {
    case 'currency':
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value))
    case 'number':
      return new Intl.NumberFormat('pt-PT').format(Number(value))
    case 'date': {
      try {
        const d = new Date(String(value))
        return isNaN(d.getTime()) ? String(value) : format(d, 'dd/MM/yyyy', { locale: pt })
      } catch {
        return String(value)
      }
    }
    default:
      return String(value)
  }
}

function resolveDocumentShortcuts(
  shortcuts: { doc_type_id: string; label?: string }[],
  processDocuments: ProcessDocument[]
): ResolvedDocShortcut[] {
  return shortcuts.map(shortcut => {
    const doc = processDocuments.find(d => d.doc_type_id === shortcut.doc_type_id)
    return {
      label: shortcut.label || doc?.doc_type?.name || 'Documento',
      doc_type_id: shortcut.doc_type_id,
      available: !!doc,
      file_url: doc?.file_url || null,
      file_name: doc?.file_name || null,
    }
  })
}

export function ExternalFormDialog({
  open,
  onOpenChange,
  subtask,
  property,
  owner,
  processDocuments,
  onComplete,
  isCompleting,
}: ExternalFormDialogProps) {
  const config = subtask.config
  const fields = (config.external_form_fields || []) as ExternalFormField[]
  const externalLinks = (config.external_links || []) as { site_name: string; url: string; icon_url?: string }[]
  const docShortcuts = (config.document_shortcuts || []) as { doc_type_id: string; label?: string }[]
  const formTitle = (config.form_title as string) || 'Formulário Externo'

  const resolvedFields = useMemo(() => {
    return fields
      .sort((a, b) => a.order_index - b.order_index)
      .map(field => ({
        ...field,
        rawValue: resolveFieldValue(field, property, owner),
        formattedValue: formatValue(resolveFieldValue(field, property, owner), field.format),
      }))
  }, [fields, property, owner])

  const resolvedDocs = useMemo(
    () => resolveDocumentShortcuts(docShortcuts, processDocuments),
    [docShortcuts, processDocuments]
  )

  const handleCopyAll = useCallback(async () => {
    const text = resolvedFields
      .map(f => `${f.label}: ${f.formattedValue}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Todos os campos copiados!')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success('Todos os campos copiados!')
    }
  }, [resolvedFields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{formTitle}</DialogTitle>
          {owner && (
            <p className="text-sm text-muted-foreground">
              Proprietário: <span className="font-medium">{owner.name}</span>
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Fields section */}
          {resolvedFields.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Dados</h4>
                <Button variant="outline" size="sm" onClick={handleCopyAll}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar Todos
                </Button>
              </div>
              <div className="rounded-lg border divide-y">
                {resolvedFields.map((field, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-medium truncate">{field.formattedValue}</p>
                    </div>
                    <CopyButton value={field.rawValue || field.formattedValue} label={field.label} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External Links */}
          {externalLinks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Links Externos</h4>
                <div className="grid gap-2">
                  {externalLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{link.site_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Document Shortcuts */}
          {resolvedDocs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Documentos</h4>
                <div className="grid gap-2">
                  {resolvedDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.available ? (
                          <FileDown className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <FileX className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{doc.label}</p>
                          {doc.file_name && (
                            <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                          )}
                        </div>
                      </div>
                      {doc.available && doc.file_url ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            Abrir
                          </a>
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Não disponível</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!subtask.is_completed && (
            <Button onClick={onComplete} disabled={isCompleting}>
              {isCompleting ? 'A concluir...' : 'Concluir'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
