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
import { ExternalLink, FileDown, FileX, Copy, ClipboardList } from 'lucide-react'
import { CopyButton } from '@/components/shared/copy-button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ProcSubtask, ExternalFormField, FormSectionConfig, FormFieldConfig } from '@/types/subtask'
import type { ProcessInstance, ProcessConsultant, ProcessOwner, ProcessDocument } from '@/types/process'

interface ExternalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtask: ProcSubtask
  property: ProcessInstance['property']
  owner?: ProcessOwner
  processInstance?: ProcessInstance
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

interface ResolvedField {
  label: string
  rawValue: string
  formattedValue: string
  width?: 'full' | 'half' | 'third'
}

interface ResolvedSection {
  title: string
  fields: ResolvedField[]
}

// ─── Value resolution ────────────────────────────────────

function resolveValue(
  fieldName: string,
  targetEntity: string,
  property: ProcessInstance['property'],
  owner?: ProcessOwner,
  consultant?: ProcessConsultant | null,
  processInstance?: ProcessInstance
): string {
  switch (targetEntity) {
    case 'property':
      return String((property as any)?.[fieldName] ?? '')
    case 'property_specs':
      return String((property?.specs as any)?.[fieldName] ?? '')
    case 'property_internal':
      return String((property?.internal as any)?.[fieldName] ?? '')
    case 'owner':
    case 'property_owner':
      return String((owner as any)?.[fieldName] ?? '')
    case 'consultant':
      return String((consultant as any)?.[fieldName] ?? '')
    case 'process':
      return String((processInstance as any)?.[fieldName] ?? '')
    default:
      return ''
  }
}

function formatValue(value: string | number, fieldType?: string): string {
  if (value === '' || value === null || value === undefined) return '—'
  switch (fieldType) {
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

// ─── Build sections from config ──────────────────────────

function buildSections(
  config: ProcSubtask['config'],
  property: ProcessInstance['property'],
  owner?: ProcessOwner,
  consultant?: ProcessConsultant | null,
  processInstance?: ProcessInstance
): ResolvedSection[] {
  const sections = config.sections as FormSectionConfig[] | undefined
  const legacyFields = config.external_form_fields as ExternalFormField[] | undefined

  // New format: sections from FormFieldPicker
  if (sections && sections.length > 0) {
    return sections.map(section => ({
      title: section.title,
      fields: (section.fields || [])
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map(field => {
          const raw = resolveValue(field.field_name, field.target_entity, property, owner, consultant, processInstance)
          return {
            label: field.label,
            rawValue: raw,
            formattedValue: formatValue(raw, field.field_type),
            width: field.width,
          }
        }),
    }))
  }

  // Legacy format: external_form_fields (flat list)
  if (legacyFields && legacyFields.length > 0) {
    return [{
      title: 'Dados',
      fields: legacyFields
        .sort((a, b) => a.order_index - b.order_index)
        .map(field => {
          const raw = resolveValue(field.field_name, field.target_entity, property, owner, consultant, processInstance)
          return {
            label: field.label,
            rawValue: raw,
            formattedValue: formatValue(raw, field.format),
          }
        }),
    }]
  }

  return []
}

// ─── Component ───────────────────────────────────────────

export function ExternalFormDialog({
  open,
  onOpenChange,
  subtask,
  property,
  owner,
  processInstance,
  processDocuments,
  onComplete,
  isCompleting,
}: ExternalFormDialogProps) {
  const config = subtask.config
  const externalLinks = (config.external_links || []) as { site_name: string; url: string; icon_url?: string }[]
  const docShortcuts = (config.document_shortcuts || []) as { doc_type_id: string; label?: string }[]
  const formTitle = (config.form_title as string) || 'Formulário Externo'

  const consultant = property?.consultant ?? null

  const resolvedSections = useMemo(
    () => buildSections(config, property, owner, consultant, processInstance),
    [config, property, owner, consultant, processInstance]
  )

  const totalFieldCount = resolvedSections.reduce((sum, s) => sum + s.fields.length, 0)

  const resolvedDocs = useMemo(
    () => resolveDocumentShortcuts(docShortcuts, processDocuments),
    [docShortcuts, processDocuments]
  )

  const handleCopyAll = useCallback(async () => {
    const lines = resolvedSections.flatMap(section =>
      section.fields.map(f => `${f.label}: ${f.formattedValue}`)
    )
    const text = lines.join('\n')
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
  }, [resolvedSections])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-500 shrink-0" />
            <DialogTitle className="flex-1">{formTitle}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {owner && (
              <p className="text-sm text-muted-foreground">
                Proprietário: <span className="font-medium">{owner.name}</span>
              </p>
            )}
            {totalFieldCount > 0 && (
              <Badge variant="outline" className="text-xs ml-auto">
                {resolvedSections.length} secç{resolvedSections.length !== 1 ? 'ões' : 'ão'} · {totalFieldCount} campo{totalFieldCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-5 py-2">
            {/* Sections with fields */}
            {resolvedSections.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Campos
                  </span>
                  <Button variant="outline" size="sm" onClick={handleCopyAll} className="h-7 text-xs">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar Todos
                  </Button>
                </div>

                {resolvedSections.map((section, sIdx) => (
                  <div key={sIdx} className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 border-b">
                      <h4 className="text-sm font-medium">{section.title}</h4>
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {section.fields.map((field, fIdx) => {
                          const colSpan = field.width === 'half' ? 'col-span-1'
                            : field.width === 'third' ? 'col-span-1'
                            : 'col-span-2'
                          return (
                            <div
                              key={fIdx}
                              className={cn(
                                'flex items-center justify-between gap-2 py-1.5',
                                colSpan,
                                fIdx > 0 && 'border-t border-border/30'
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">{field.label}</p>
                                <p className="text-sm font-medium truncate">{field.formattedValue}</p>
                              </div>
                              <CopyButton
                                value={field.rawValue || field.formattedValue}
                                label={field.label}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* External Links */}
            {externalLinks.length > 0 && (
              <>
                {resolvedSections.length > 0 && <Separator />}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Links Externos
                  </span>
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
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Documentos
                  </span>
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
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
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
