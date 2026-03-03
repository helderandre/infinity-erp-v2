'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor, Frame, Element, useEditor } from '@craftjs/core'
import { Layers } from '@craftjs/layers'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { EmailToolbox } from '@/components/email-editor/email-toolbox'
import { EmailSettingsPanel } from '@/components/email-editor/email-settings-panel'
import { EmailLayer } from '@/components/email-editor/email-layer'
import {
  Mail,
  CheckCircle2,
  Save,
  Loader2,
  AlertCircle,
  User,
  Building2,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { interpolateVariables } from '@/lib/utils'
import { renderEmailToHtml } from '@/lib/email-renderer'
import { useUser } from '@/hooks/use-user'
import type { ProcSubtask } from '@/types/subtask'

import { EmailVariablesProvider } from '@/components/email-editor/email-variables-context'
import { EmailContainer } from '@/components/email-editor/user/email-container'
import { EmailText } from '@/components/email-editor/user/email-text'
import { EmailHeading } from '@/components/email-editor/user/email-heading'
import { EmailImage } from '@/components/email-editor/user/email-image'
import { EmailButton } from '@/components/email-editor/user/email-button'
import { EmailDivider } from '@/components/email-editor/user/email-divider'
import { EmailSpacer } from '@/components/email-editor/user/email-spacer'
import { EmailAttachment } from '@/components/email-editor/user/email-attachment'
import { EmailGrid } from '@/components/email-editor/user/email-grid'
import { RenderNode } from '@/components/email-editor/email-render-node'

const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
  EmailGrid,
}

interface SubtaskEmailSheetProps {
  subtask: ProcSubtask
  propertyId: string
  processId: string
  taskId: string
  ownerEmail?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
  onSaveDraft?: () => void
}

type SavePayload = { state: string; html: string }

function getEmailLibraryId(subtask: ProcSubtask): string | undefined {
  const c = subtask.config
  if (c.has_person_type_variants) {
    if (subtask.owner?.person_type === 'singular') return c.singular_config?.email_library_id
    if (subtask.owner?.person_type === 'coletiva') return c.coletiva_config?.email_library_id
  }
  return c.email_library_id
}

/** Escape a runtime string value for safe embedding inside a JSON string literal */
function escapeForJsonString(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// ─── Inner component — needs useEditor context ──────────────────────────────

interface EditorCanvasProps {
  loadedEditorState: string
  subject: string
  onSubjectChange: (v: string) => void
  onSaveDraft: (p: SavePayload) => Promise<void>
  onMarkAsSent: (p: SavePayload) => Promise<void>
  onSendEmail: (p: SavePayload) => void
  isSaving: boolean
  isCompleting: boolean
  isCompleted: boolean
}

function RightSidebar() {
  return (
    <Tabs
      defaultValue="properties"
      className="w-64 shrink-0 border-l flex flex-col overflow-hidden gap-0"
    >
      <TabsList className="w-full rounded-none border-b h-9 shrink-0">
        <TabsTrigger value="properties" className="flex-1 text-xs">
          Propriedades
        </TabsTrigger>
        <TabsTrigger value="layers" className="flex-1 text-xs">
          Camadas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-0 flex-1 overflow-auto">
        <EmailSettingsPanel />
      </TabsContent>
      <TabsContent value="layers" className="mt-0 flex-1 overflow-auto">
        <Layers expandRootOnLoad renderLayer={EmailLayer} />
      </TabsContent>
    </Tabs>
  )
}

function EditorCanvas({
  loadedEditorState,
  subject,
  onSubjectChange,
  onSaveDraft,
  onMarkAsSent,
  onSendEmail,
  isSaving,
  isCompleting,
  isCompleted,
}: EditorCanvasProps) {
  const { query } = useEditor()
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [previewHtml, setPreviewHtml] = useState('')

  const getPayload = useCallback((): SavePayload => {
    const state = query.serialize()
    return { state, html: renderEmailToHtml(state, {}) }
  }, [query])

  const handleSwitchToPreview = () => {
    const { html } = getPayload()
    setPreviewHtml(html)
    setActiveTab('preview')
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Subject + tab bar */}
      <div className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-4 px-4 py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
            Assunto
          </Label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Assunto do email..."
            disabled={isCompleted}
            className="text-sm h-8 flex-1"
          />
          {/* Tab triggers */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('edit')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'edit'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Editar
            </button>
            <button
              onClick={handleSwitchToPreview}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'preview'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Pré-visualizar
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Edit layout — always mounted to preserve Craft.js state */}
        <div className={cn('flex flex-1 overflow-hidden', activeTab !== 'edit' && 'hidden')}>
          <EmailToolbox />
          <div className="flex-1 overflow-auto bg-muted/30 p-6">
            <div className="mx-auto" style={{ maxWidth: 620 }}>
              <Frame data={loadedEditorState}>
                <Element
                  is={EmailContainer}
                  canvas
                  padding={24}
                  background="#ffffff"
                  width="100%"
                  direction="column"
                  align="stretch"
                  justify="flex-start"
                  gap={8}
                >
                  <EmailText html="Edite o seu template aqui" />
                </Element>
              </Frame>
            </div>
          </div>
          <RightSidebar />
        </div>

        {/* Preview */}
        {activeTab === 'preview' && (
          <div className="flex-1 overflow-auto bg-muted/30 p-6">
            {subject && (
              <div
                className="mx-auto mb-3 rounded-md border bg-white px-4 py-2.5 text-sm"
                style={{ maxWidth: 620 }}
              >
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Assunto
                </span>
                <p className="mt-1 font-medium">{subject}</p>
              </div>
            )}
            <div
              className="mx-auto rounded-md border bg-white p-6"
              style={{ maxWidth: 620 }}
            >
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isCompleted ? (
        <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSaveDraft(getPayload())}
            disabled={isSaving || isCompleting}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar Rascunho
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkAsSent(getPayload())}
              disabled={isSaving || isCompleting}
            >
              {isCompleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Marcar como Enviado
            </Button>
            <Button
              size="sm"
              onClick={() => onSendEmail(getPayload())}
              disabled={isSaving || isCompleting}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar Email
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t shrink-0">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Email marcado como enviado.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Sheet ──────────────────────────────────────────────────────────────

export function SubtaskEmailSheet({
  subtask,
  propertyId,
  processId,
  taskId,
  ownerEmail = '',
  open,
  onOpenChange,
  onComplete,
  onSaveDraft: onSaveDraftProp,
}: SubtaskEmailSheetProps) {
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [loadedEditorState, setLoadedEditorState] = useState<string | null>(null)
  const [resolvedVariables, setResolvedVariables] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  // Email send dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<SavePayload | null>(null)
  const [emailForm, setEmailForm] = useState({
    senderName: '',
    senderEmail: '',
    recipientEmail: '',
    cc: '',
  })

  // Guarda o último rascunho salvo nesta sessão.
  // O prop `subtask` não é atualizado pelo pai após guardar, por isso este ref
  // serve de fonte de verdade enquanto o componente estiver montado.
  const localDraftRef = useRef<{ subtaskId: string; subject: string; editorState: string } | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)

    // Fetch variables em background (sempre, para os botões de variáveis terem valores reais)
    const previewDataPromise = fetch('/api/libraries/emails/preview-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        owner_id: subtask.owner_id ?? undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const vars: Record<string, string> = d.variables ?? {}
        setResolvedVariables(vars)
        return vars
      })
      .catch(() => ({} as Record<string, string>))

    // Prioridade 1: rascunho guardado nesta sessão (o prop `subtask` está stale após save)
    if (localDraftRef.current?.subtaskId === subtask.id) {
      setSubject(localDraftRef.current.subject)
      setLoadedEditorState(localDraftRef.current.editorState)
      setHasRendered(true)
      setEditorKey((k) => k + 1)
      void previewDataPromise
      return
    }

    // Prioridade 2: rascunho guardado na DB (vem no prop subtask quando o pai refetch)
    setLoadedEditorState(null)
    setHasRendered(false)

    const rendered = (subtask.config as Record<string, unknown>).rendered as
      | { subject?: string; body_html?: string; editor_state?: Record<string, unknown> }
      | undefined

    if (rendered?.editor_state) {
      setSubject(rendered.subject ?? '')
      setLoadedEditorState(JSON.stringify(rendered.editor_state))
      setHasRendered(true)
      setEditorKey((k) => k + 1)
      void previewDataPromise
      return
    }

    // Prioridade 3: carregar template de raiz
    const emailLibraryId = getEmailLibraryId(subtask)
    if (!emailLibraryId) {
      setError('Sem template de email configurado para esta subtarefa.')
      return
    }

    setIsLoading(true)

    Promise.all([
      fetch(`/api/libraries/emails/${emailLibraryId}`).then((r) => r.json()),
      previewDataPromise,
    ])
      .then(([templateData, variables]) => {
        if (templateData.error) {
          setError(templateData.error)
          return
        }

        setSubject(interpolateVariables(templateData.subject ?? '', variables))

        if (templateData.editor_state) {
          const stateStr = JSON.stringify(templateData.editor_state)
          const populated = stateStr.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            const val = variables[key]
            return val !== undefined ? escapeForJsonString(val) : ''
          })
          setLoadedEditorState(populated)
          setEditorKey((k) => k + 1)
        } else {
          setError(
            'Este template não tem editor visual configurado. Edite o template na biblioteca de emails para activar esta funcionalidade.'
          )
        }
      })
      .catch(() => setError('Erro ao carregar o template de email.'))
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
      throw new Error(err.error ?? 'Erro na operação')
    }
    return res.json()
  }

  const handleSaveDraft = async ({ state, html }: SavePayload) => {
    setIsSaving(true)
    try {
      await callSubtaskApi({
        rendered_content: {
          subject,
          body_html: html,
          editor_state: JSON.parse(state),
        },
      })
      // Guardar no ref para que a próxima reabertura carregue este rascunho
      // (o prop `subtask` do pai fica stale até que o pai faça refetch)
      localDraftRef.current = { subtaskId: subtask.id, subject, editorState: state }
      setHasRendered(true)
      setLoadedEditorState(state)
      toast.success('Rascunho guardado com sucesso!')
      onSaveDraftProp?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar rascunho')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkAsSent = async ({ state, html }: SavePayload) => {
    setIsCompleting(true)
    try {
      await callSubtaskApi({
        rendered_content: {
          subject,
          body_html: html,
          editor_state: JSON.parse(state),
        },
        is_completed: true,
      })
      toast.success('Email marcado como enviado!')
      onComplete()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao marcar como enviado')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleInitiateSend = (payload: SavePayload) => {
    setPendingPayload(payload)
    setEmailForm({
      senderName: user?.commercial_name || '',
      senderEmail: user?.professional_email || '',
      recipientEmail: ownerEmail,
      cc: '',
    })
    setEmailDialogOpen(true)
  }

  const handleConfirmSend = async () => {
    if (!pendingPayload) return
    setIsSendingEmail(true)
    try {
      const ccList = emailForm.cc
        ? emailForm.cc.split(',').map((e) => e.trim()).filter(Boolean)
        : []

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderName: emailForm.senderName,
            senderEmail: emailForm.senderEmail,
            recipientEmail: emailForm.recipientEmail,
            ...(ccList.length > 0 && { cc: ccList }),
            subject,
            body: pendingPayload.html,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar email')
      }

      // Save rendered content and mark as completed
      await callSubtaskApi({
        rendered_content: {
          subject,
          body_html: pendingPayload.html,
          editor_state: JSON.parse(pendingPayload.state),
        },
        is_completed: true,
      })

      toast.success('Email enviado com sucesso!')
      setEmailDialogOpen(false)
      onComplete()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar email')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const ownerBadge = subtask.owner ? (
    <Badge
      variant="outline"
      className={cn(
        'text-xs shrink-0',
        subtask.owner.person_type === 'singular'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-purple-50 text-purple-700 border-purple-200'
      )}
    >
      {subtask.owner.person_type === 'singular' ? (
        <User className="mr-1 h-3 w-3" />
      ) : (
        <Building2 className="mr-1 h-3 w-3" />
      )}
      {subtask.owner.name}
    </Badge>
  ) : null

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
            <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 shrink-0">
              <Mail className="h-4 w-4 text-amber-600" />
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
                    Enviado
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
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-28 mt-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 flex-1">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          </div>
        ) : loadedEditorState ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <EmailVariablesProvider variables={resolvedVariables}>
              <Editor
                key={editorKey}
                resolver={resolver}
                onRender={RenderNode}
                enabled={!subtask.is_completed}
              >
                <EditorCanvas
                  loadedEditorState={loadedEditorState}
                  subject={subject}
                  onSubjectChange={setSubject}
                  onSaveDraft={handleSaveDraft}
                  onMarkAsSent={handleMarkAsSent}
                  onSendEmail={handleInitiateSend}
                  isSaving={isSaving}
                  isCompleting={isCompleting}
                  isCompleted={subtask.is_completed}
                />
              </Editor>
            </EmailVariablesProvider>
          </div>
        ) : null}
      </SheetContent>

      {/* Email Send Dialog — fora do SheetContent para evitar z-index issues */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Enviar Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Remetente */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="es-senderName">Nome do remetente</Label>
                <Input
                  id="es-senderName"
                  value={emailForm.senderName}
                  onChange={(e) => setEmailForm((f) => ({ ...f, senderName: e.target.value }))}
                  placeholder="Ex: Infinity Group"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="es-senderEmail">
                  Email do remetente
                  {!emailForm.senderEmail && <span className="ml-1 text-xs text-destructive">*</span>}
                </Label>
                <Input
                  id="es-senderEmail"
                  type="email"
                  value={emailForm.senderEmail}
                  onChange={(e) => setEmailForm((f) => ({ ...f, senderEmail: e.target.value }))}
                  placeholder="noreply@dominio.pt"
                />
              </div>
            </div>

            {/* Destinatário + CC */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="es-recipientEmail">
                  Para
                  {!emailForm.recipientEmail && <span className="ml-1 text-xs text-destructive">*</span>}
                </Label>
                <Input
                  id="es-recipientEmail"
                  type="email"
                  value={emailForm.recipientEmail}
                  onChange={(e) => setEmailForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                  placeholder="destinatario@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="es-cc">
                  CC <span className="text-xs text-muted-foreground">(separar por vírgula)</span>
                </Label>
                <Input
                  id="es-cc"
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm((f) => ({ ...f, cc: e.target.value }))}
                  placeholder="cc1@exemplo.com, cc2@exemplo.com"
                />
              </div>
            </div>

            {/* Assunto (read-only — vem do editor) */}
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input value={subject} readOnly className="bg-muted/50 text-muted-foreground" />
            </div>

            {/* Preview do corpo */}
            <div className="space-y-1.5">
              <Label>Corpo do email</Label>
              {pendingPayload?.html ? (
                <div
                  className="rounded-md border p-3 text-sm prose prose-sm max-w-none max-h-40 overflow-y-auto bg-white"
                  dangerouslySetInnerHTML={{ __html: pendingPayload.html }}
                />
              ) : (
                <div className="rounded-md border p-3 text-sm text-muted-foreground italic">
                  Sem conteúdo.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={isSendingEmail}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={
                isSendingEmail ||
                !emailForm.senderName.trim() ||
                !emailForm.senderEmail.trim() ||
                !emailForm.recipientEmail.trim()
              }
            >
              {isSendingEmail ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
