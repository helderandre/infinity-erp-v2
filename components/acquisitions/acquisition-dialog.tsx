'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Button } from '@/components/ui/button'
import { CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AcquisitionFormV2 } from './acquisition-form-v2'
import { DraftsList, type AcquisitionDraft } from './drafts-list'
import type { AcquisitionFormData } from '@/lib/validations/acquisition'

interface AcquisitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftId?: string
  negocioId?: string
  prefillData?: Partial<AcquisitionFormData>
  onComplete?: (procInstanceId: string) => void
}

type Step = 'loading' | 'picker' | 'form'

export function AcquisitionDialog({
  open,
  onOpenChange,
  draftId,
  negocioId,
  prefillData,
  onComplete,
}: AcquisitionDialogProps) {
  const isMobile = useIsMobile()

  // Skip picker entirely when caller already chose a path:
  //   - draftId  → resume that specific draft (e.g. processos page card)
  //   - negocioId or prefillData → caller is feeding context (negocio detail,
  //     voice prefill, etc.) and a fresh form is implied
  const skipPicker = !!draftId || !!negocioId || !!prefillData

  const [step, setStep] = useState<Step>(skipPicker ? 'form' : 'loading')
  const [drafts, setDrafts] = useState<AcquisitionDraft[]>([])
  const [resumeId, setResumeId] = useState<string | undefined>(draftId)

  // Tracks which draft (if any) the open form has already persisted to the DB
  // — set lazily by the form's `onDraftCreated` callback. Used to decide
  // whether to DELETE on discard.
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  // Flips true on the consultor's first edit (set by `onUserFirstEdit`). This
  // is the close-confirmation gate — race-safe because it's set immediately
  // on the first keystroke, not when the autosave debounce resolves.
  const [userHasEdited, setUserHasEdited] = useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  // Becomes true once the form successfully completes — bypass the close
  // confirmation in that case, the draft was promoted to a real process.
  const submittedRef = useRef(false)
  // Quando uma angariação é submetida com sucesso, em vez de redireccionar
  // para a página do processo, mostramos uma view de confirmação dentro do
  // próprio Sheet. O departamento interno (Broker/Gestor Processual) recebe
  // notificação e abre a página do processo a partir daí.
  const [submittedProcId, setSubmittedProcId] = useState<string | null>(null)
  // Imperative actions registered by the form. We call them from the
  // confirmation handlers to flush in-flight edits or stop pending saves.
  const formActionsRef = useRef<{
    flushSave: () => Promise<void>
    discard: () => Promise<void>
  } | null>(null)

  // Reset internal state whenever the dialog re-opens so we always re-evaluate
  // whether to show the picker. Closing is also a good moment to reset so the
  // next open does not flash stale state.
  useEffect(() => {
    if (open) {
      setResumeId(draftId)
      setStep(skipPicker ? 'form' : 'loading')
      setActiveDraftId(null)
      setUserHasEdited(false)
      submittedRef.current = false
      formActionsRef.current = null
      setSubmittedProcId(null)
    } else {
      setDrafts([])
      setActiveDraftId(null)
      setUserHasEdited(false)
      setConfirmCloseOpen(false)
      formActionsRef.current = null
      setSubmittedProcId(null)
    }
  }, [open, draftId, skipPicker])

  // Fetch drafts on open. The picker is the universal first screen for fresh
  // opens — even with zero drafts we still land there. This gives the
  // consultor one consistent entry point ("Continuar / Nova angariação")
  // regardless of state. With 0 drafts the picker shows a clean empty state
  // and a primary "Nova angariação" CTA.
  useEffect(() => {
    if (!open || skipPicker) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/acquisitions/drafts')
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (cancelled) return
        const list: AcquisitionDraft[] = data.data || []
        setDrafts(list)
        setStep('picker')
      } catch {
        // On failure, fall through to a fresh form so the consultor is never
        // blocked from creating a new angariação.
        if (!cancelled) {
          setDrafts([])
          setStep('form')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, skipPicker])

  const handleResume = useCallback((id: string) => {
    setResumeId(id)
    setStep('form')
  }, [])

  // Estáveis — evitam que o form re-subscreva o `form.watch` a cada render do
  // dialog (o que limparia o debounce timer entre keystrokes).
  const handleDraftCreatedStable = useCallback((id: string) => {
    setActiveDraftId(id)
  }, [])
  const handleUserFirstEditStable = useCallback(() => {
    setUserHasEdited(true)
  }, [])
  const handleRegisterActionsStable = useCallback(
    (actions: { flushSave: () => Promise<void>; discard: () => Promise<void> }) => {
      formActionsRef.current = actions
    },
    [],
  )
  // Quando o consultor escolhe "Retomar rascunho" no passo intro do form,
  // trocamos o `resumeId` e descartamos o estado local (activeDraftId,
  // userHasEdited) — o `key` no AcquisitionFormV2 força um remount limpo.
  const handleResumeDraftStable = useCallback((id: string) => {
    setResumeId(id)
    setActiveDraftId(null)
    setUserHasEdited(false)
    formActionsRef.current = null
  }, [])

  const handleStartNew = useCallback(() => {
    setResumeId(undefined)
    setStep('form')
  }, [])

  const handleDeleted = useCallback((id: string) => {
    // Picker continua a ser a home — quando a lista fica vazia o utilizador
    // vê o empty state com o CTA "Nova angariação" em vez de cair de imediato
    // no form. Mantém-lhe controlo da decisão.
    setDrafts((prev) => prev.filter((d) => d.proc_instance_id !== id))
  }, [])

  // Close request — runs whenever the user attempts to dismiss the Sheet
  // (X button, ESC, click outside, or controlled-state flip from the parent).
  const requestClose = useCallback(() => {
    // Bypass confirmation on the picker (no in-progress edits) or after a
    // successful submit. Also bypass when nothing has been edited — there's
    // nothing meaningful to save or discard.
    if (submittedRef.current || step !== 'form' || (!userHasEdited && !activeDraftId)) {
      onOpenChange(false)
      return
    }
    setConfirmCloseOpen(true)
  }, [step, userHasEdited, activeDraftId, onOpenChange])

  const handleKeepDraft = useCallback(async () => {
    setConfirmCloseOpen(false)
    // Garante que as últimas edições (que possam ainda estar dentro do
    // debounce de 1.5s) ficam persistidas antes de fechar.
    try {
      await formActionsRef.current?.flushSave()
    } catch {
      toast.error('Não foi possível guardar todas as edições — tente novamente.')
      return
    }
    onOpenChange(false)
  }, [onOpenChange])

  const handleDiscardDraft = useCallback(async () => {
    setConfirmCloseOpen(false)
    // Cancelar qualquer save pendente antes de apagar.
    await formActionsRef.current?.discard()
    const id = activeDraftId
    onOpenChange(false)
    if (!id) return
    try {
      const res = await fetch(`/api/acquisitions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast.success('Rascunho descartado')
    } catch {
      toast.error('Não foi possível descartar o rascunho — tente em Processos.')
    }
  }, [activeDraftId, onOpenChange])

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (o) {
            onOpenChange(true)
          } else {
            requestClose()
          }
        }}
      >
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          showCloseButton={false}
          className={cn(
            'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
          )}
          onInteractOutside={(e) => {
            // Não interferir com AlertDialog filho (overlay do AlertDialog
            // dispara onInteractOutside no Sheet).
            if (confirmCloseOpen) {
              e.preventDefault()
              return
            }
            e.preventDefault()
            requestClose()
          }}
          onEscapeKeyDown={(e) => {
            if (confirmCloseOpen) {
              e.preventDefault()
              return
            }
            e.preventDefault()
            requestClose()
          }}
        >
          <VisuallyHidden>
            <SheetTitle>Nova Angariação</SheetTitle>
          </VisuallyHidden>
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}

          {open && step === 'loading' && (
            <div className="flex items-center justify-center flex-1 py-12">
              <Spinner variant="infinite" size={32} className="text-muted-foreground" />
            </div>
          )}

          {open && step === 'picker' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0 flex items-start justify-between gap-3">
                <SheetTitle className="text-base font-semibold tracking-tight">
                  Nova Angariação
                </SheetTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={requestClose}
                  className="h-8 w-8 rounded-full -mt-1"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <DraftsList
                  drafts={drafts}
                  onResume={handleResume}
                  onStartNew={handleStartNew}
                  onDeleted={handleDeleted}
                />
              </div>
            </div>
          )}

          {open && step === 'form' && !submittedProcId && (
            <AcquisitionFormV2
              key={resumeId || 'new'}
              mode="dialog"
              draftId={resumeId}
              negocioId={negocioId}
              prefillData={prefillData}
              onDraftCreated={handleDraftCreatedStable}
              onUserFirstEdit={handleUserFirstEditStable}
              onRegisterActions={handleRegisterActionsStable}
              onResumeDraft={handleResumeDraftStable}
              onComplete={(procInstanceId) => {
                submittedRef.current = true
                setActiveDraftId(null)
                // Não fechamos o sheet nem redireccionamos. Mostramos a
                // view de confirmação dentro do próprio sheet — o
                // utilizador clica "Concluir" para fechar. A página do
                // processo é aberta a partir da notificação que a
                // gestão recebe (e não pelo consultor que submete).
                setSubmittedProcId(procInstanceId)
              }}
              onClose={requestClose}
            />
          )}

          {open && submittedProcId && (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center gap-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h2 className="text-xl font-semibold tracking-tight">Angariação submetida</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O nosso departamento interno vai tratar do processo. Avisamos-te quando precisarmos da tua acção (assinaturas, documentação, contactos com o proprietário…).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-full h-9 px-5 text-xs gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800 mt-2"
                onClick={() => {
                  const id = submittedProcId
                  setSubmittedProcId(null)
                  if (id) onComplete?.(id)
                  onOpenChange(false)
                }}
              >
                Concluir
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Guardar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Pode sair e continuar mais tarde — o rascunho fica gravado e disponível em
              Processos. Se descartar, todo o trabalho não submetido será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault()
                handleDiscardDraft()
              }}
              className="bg-transparent"
            >
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleKeepDraft()
              }}
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
