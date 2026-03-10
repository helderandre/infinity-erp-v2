'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Save, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { DynamicFormRenderer } from './dynamic-form-renderer'
import type { ProcSubtask } from '@/types/subtask'
import type { FormSectionConfig } from '@/types/subtask'

const FORM_ID = 'form-subtask-dialog'

interface FormSubtaskDialogProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: () => Promise<void>
  onSaved?: () => Promise<void>
  readOnly?: boolean
}

export function FormSubtaskDialog({
  subtask,
  processId,
  taskId,
  open,
  onOpenChange,
  onCompleted,
  onSaved,
  readOnly,
}: FormSubtaskDialogProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [sections, setSections] = useState<FormSectionConfig[]>([])
  const [formTitle, setFormTitle] = useState<string>('')
  const [propertyId, setPropertyId] = useState<string | undefined>()
  // Track whether save should also complete
  const shouldCompleteRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}/form`
      )
      if (!res.ok) throw new Error('Erro ao carregar formulário')
      const data = await res.json()
      setValues(data.values || {})
      const config = data.config || subtask.config
      setSections(config.sections || [])
      setFormTitle(config.form_title || '')
      if (data.property_id) setPropertyId(data.property_id)
    } catch {
      toast.error('Erro ao carregar dados do formulário')
    } finally {
      setLoading(false)
    }
  }, [processId, taskId, subtask.id, subtask.config])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  const handleSubmit = async (grouped: Record<string, Record<string, unknown>>) => {
    const wantsComplete = shouldCompleteRef.current
    shouldCompleteRef.current = false

    if (wantsComplete) {
      setCompleting(true)
    } else {
      setSubmitting(true)
    }

    try {
      // 1. Guardar dados do formulário
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}/form`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(grouped),
        }
      )
      if (!res.ok) throw new Error('Erro ao guardar')

      if (wantsComplete) {
        // 2. Marcar como concluída
        await onCompleted()
        toast.success('Dados guardados e subtarefa concluída')
        onOpenChange(false)
      } else {
        // Apenas guardar
        toast.success('Dados guardados com sucesso')
        if (onSaved) await onSaved()
      }
    } catch {
      toast.error(wantsComplete ? 'Erro ao concluir subtarefa' : 'Erro ao guardar dados')
    } finally {
      setSubmitting(false)
      setCompleting(false)
    }
  }

  // Trigger form submit with complete flag
  const handleSaveAndComplete = () => {
    shouldCompleteRef.current = true
    // Trigger the form submit programmatically
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null
    if (form) form.requestSubmit()
  }

  const sectionCount = sections.length
  const fieldCount = sections.reduce((acc, s) => acc + s.fields.length, 0)
  const isBusy = submitting || completing

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:sm:max-w-[800px] p-0 gap-0 flex flex-col h-full"
      >
        {/* HEADER FIXO */}
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <SheetTitle className="text-lg">{formTitle || subtask.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              Formulário
            </Badge>
            {!loading && sectionCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {sectionCount} {sectionCount === 1 ? 'secção' : 'secções'} · {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'}
              </Badge>
            )}
            {subtask.is_completed && (
              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50">
                Concluída
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* CORPO SCROLLÁVEL */}
        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="px-6 py-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum campo configurado para este formulário.</p>
            ) : (
              <DynamicFormRenderer
                formId={FORM_ID}
                sections={sections}
                defaultValues={values}
                onSubmit={handleSubmit}
                isSubmitting={isBusy}
                hideSubmitButton
                context={{ propertyId }}
                readOnly={readOnly}
              />
            )}
          </div>
        </ScrollArea>

        {/* FOOTER FIXO */}
        {!loading && sections.length > 0 && (
          <div className="border-t px-6 py-3 flex items-center justify-end gap-3">
            {readOnly ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isBusy}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  variant="outline"
                  disabled={isBusy}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar
                    </>
                  )}
                </Button>
                {!subtask.is_completed && (
                  <Button
                    type="button"
                    disabled={isBusy}
                    onClick={handleSaveAndComplete}
                  >
                    {completing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        A concluir...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Concluir
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
