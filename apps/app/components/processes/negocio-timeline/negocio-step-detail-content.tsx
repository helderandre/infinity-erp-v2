'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mail, Users, Loader2, Check, ScrollText, ExternalLink, Puzzle, FileSignature } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubtaskCardList } from '../subtask-card-list'
import { SubtaskEmailSheet } from '../subtask-email-sheet'
import { SubtaskPdfSheet } from '../subtask-pdf-sheet'
import { DocumentsChecklistCard } from '../documents-checklist-card'
import { NegocioCpcvDocs } from './negocio-cpcv-docs'
import { SurveyInviteCard } from '@/components/financial/survey-invite-card'

/**
 * Conteúdo rico do detalhe de um passo do fecho de negócio — mesma lógica de
 * design da angariação, mas um design por TIPO de acção. Wired a dados REAIS.
 * Tipos ainda não desenhados caem no `<SubtaskCardList>` real (funcional).
 *
 * Implementado: `email`, `documentos` (upload). A fazer: generate_doc, field,
 * schedule_event, ai_caption, faturação (moloni).
 *
 * Nota: `property_id` vive em `process.instance.property_id` (não em
 * `process.property_id`).
 */
export function NegocioStepDetailContent({
  stepKey,
  tasks,
  processId,
  deal,
  process,
  onTaskUpdate,
}: {
  stepKey?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[]
  processId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process?: any
  onTaskUpdate: () => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem tarefas neste passo para este cenário.
      </p>
    )
  }

  // "Guardar e verificar documentação" — Imóvel + tabs (Compradores | Vendedores).
  if (stepKey === 'guardar_verificar_docs') {
    return (
      <NegocioCpcvDocs
        tasks={tasks}
        processId={processId}
        deal={deal}
        process={process}
        onTaskUpdate={onTaskUpdate}
      />
    )
  }

  // "Direitos de Preferência" — link para o Casa Pronta + extensão MUBE, e por
  // baixo as subtarefas reais (pedido submetido + resposta recebida).
  if (stepKey === 'direitos_preferencia') {
    return (
      <div className="space-y-6">
        <DireitosPreferenciaCard />
        {tasks.map((task) => (
          <NegocioTaskContent
            key={task.id}
            task={task}
            processId={processId}
            deal={deal}
            process={process}
            onTaskUpdate={onTaskUpdate}
            showHeader={tasks.length > 1}
          />
        ))}
      </div>
    )
  }

  // "Agradecimento, inquérito e review" — um só passo que agrega 3 tasks:
  //   1. Email de agradecimento (composer real)
  //   2. Inquérito de satisfação — embute o card real de convite (envia o
  //      inquérito; a review no Google sai do próprio fluxo para promoters)
  //   3. Os checklists de confirmação (inquérito enviado / review solicitada)
  if (stepKey === 'email_agradecimento') {
    const agradTask = tasks.find(
      (t) => t.title === 'Email de agradecimento aos clientes'
    )
    const followUpTasks = tasks.filter(
      (t) =>
        t.title === 'Inquérito de satisfação' ||
        t.title === 'Pedido de review no Google'
    )
    return (
      <div className="space-y-6">
        {agradTask && (
          <NegocioTaskContent
            task={agradTask}
            processId={processId}
            deal={deal}
            process={process}
            onTaskUpdate={onTaskUpdate}
            showHeader
          />
        )}

        {deal?.id && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              Inquérito de satisfação e review no Google
            </h4>
            <SurveyInviteCard dealId={deal.id} dealStatus={deal.status ?? null} />
          </div>
        )}

        {followUpTasks.map((task) => (
          <NegocioTaskContent
            key={task.id}
            task={task}
            processId={processId}
            deal={deal}
            process={process}
            onTaskUpdate={onTaskUpdate}
            showHeader
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {tasks.map((task) => (
        <NegocioTaskContent
          key={task.id}
          task={task}
          processId={processId}
          deal={deal}
          process={process}
          onTaskUpdate={onTaskUpdate}
          showHeader={tasks.length > 1}
        />
      ))}
    </div>
  )
}

/* ── Design: DIREITOS DE PREFERÊNCIA (Casa Pronta + extensão MUBE) ───────── */

const CASA_PRONTA_URL =
  'https://www.casapronta.pt/CasaPronta/preferencias/PrePasso1.jsp'

function DireitosPreferenciaCard() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <ScrollText className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Pedido de Direitos de Preferência</p>
            <p className="text-xs text-muted-foreground">
              Submete o pedido no portal Casa Pronta. Recolhe depois a resposta nas
              subtarefas abaixo.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <Button asChild className="w-full">
            <a href={CASA_PRONTA_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Casa Pronta
            </a>
          </Button>

          <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
            <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div className="space-y-0.5 text-xs">
              <p className="font-medium text-foreground">
                Extensão MUBE Casa Pronta
              </p>
              <p className="text-muted-foreground">
                Com a extensão instalada no Chrome, abre o formulário do Casa Pronta,
                escolhe este negócio e o formulário é preenchido automaticamente com
                os dados do imóvel, vendedores e compradores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Design: GERAR DOCUMENTO (CPCV) — igual ao "Criar CMI" da angariação ── */

function GenerateDocStepContent({
  subtask,
  task,
  processId,
  propertyId,
  onTaskUpdate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtask: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any
  processId: string
  propertyId: string
  onTaskUpdate: () => void
}) {
  const isCompleted = Boolean(subtask?.is_completed)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileSignature className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          Editar CPCV
        </span>
        {isCompleted && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Concluído
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          pré-preenchido a partir do imóvel e das partes — editável
        </span>
      </div>

      {/* Editor real do CPCV embebido inline na sheet do passo (como o CMI) */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-[68vh] min-h-[460px]">
          <SubtaskPdfSheet
            inline
            open
            onOpenChange={() => {}}
            subtask={subtask}
            propertyId={propertyId}
            processId={processId}
            taskId={task.id}
            onComplete={onTaskUpdate}
          />
        </div>
      </div>
    </div>
  )
}

function NegocioTaskContent({
  task,
  processId,
  deal,
  process,
  onTaskUpdate,
  showHeader,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any
  processId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process?: any
  onTaskUpdate: () => void
  showHeader: boolean
}) {
  const propertyId: string = process?.instance?.property_id ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtasks = (task?.subtasks ?? []) as any[]

  const emailSubtasks = subtasks.filter((s) => s.config?.type === 'email')
  const uploadSubtasks = subtasks.filter((s) => s.config?.type === 'upload')

  let body: ReactNode

  // EMAIL — todas as subtarefas são emails.
  if (subtasks.length > 0 && emailSubtasks.length === subtasks.length) {
    body = (
      <EmailStepContent
        subtask={emailSubtasks[0]}
        task={task}
        processId={processId}
        deal={deal}
        propertyId={propertyId}
        onTaskUpdate={onTaskUpdate}
      />
    )
  } else if (
    // DOCUMENTOS — todas as subtarefas são uploads + há imóvel.
    subtasks.length > 0 &&
    uploadSubtasks.length === subtasks.length &&
    propertyId
  ) {
    body = (
      <DocumentsChecklistCard
        processId={processId}
        taskId={task.id}
        propertyId={propertyId}
        uploadSubtasks={uploadSubtasks}
        existingDocs={process?.documents ?? []}
        owners={process?.owners ?? []}
        mainOwnerId={task.owner_id || undefined}
        onRevert={async (subtaskId) => {
          await fetch(
            `/api/processes/${processId}/tasks/${task.id}/subtasks/${subtaskId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_completed: false }),
            }
          )
          onTaskUpdate()
        }}
        onTaskUpdate={onTaskUpdate}
      />
    )
  } else if (
    // GERAR DOCUMENTO (CPCV) — mesmo design do "Criar CMI" da angariação:
    // um card "Editar CPCV" que abre o sheet com a pré-visualização do PDF.
    subtasks.length > 0 &&
    subtasks.every((s) => s.config?.type === 'generate_doc')
  ) {
    body = (
      <GenerateDocStepContent
        subtask={subtasks[0]}
        task={task}
        processId={processId}
        propertyId={propertyId}
        onTaskUpdate={onTaskUpdate}
      />
    )
  } else {
    // Fallback — cards reais (funcionais) para os tipos ainda não desenhados.
    body = (
      <SubtaskCardList
        task={task}
        processId={processId}
        deal={deal ?? null}
        processInstance={process?.instance}
        propertyId={propertyId}
        owners={process?.owners ?? []}
        onSubtaskToggle={async (taskId, subtaskId, completed) => {
          const res = await fetch(
            `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_completed: completed }),
            }
          )
          if (!res.ok) throw new Error('Erro ao actualizar subtarefa')
        }}
        onTaskUpdate={onTaskUpdate}
      />
    )
  }

  if (!showHeader) return body
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{task.title}</h4>
      {body}
    </div>
  )
}

/* ── Design: EMAIL ──────────────────────────────────────────────────── */

function EmailStepContent({
  subtask,
  task,
  processId,
  deal,
  propertyId,
  onTaskUpdate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtask: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any
  processId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal?: any
  propertyId: string
  onTaskUpdate: () => void
}) {
  const libId = subtask?.config?.email_library_id as string | undefined
  const [tpl, setTpl] = useState<{ subject?: string; body_html?: string } | null>(null)
  const [loading, setLoading] = useState(Boolean(libId))
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!libId) {
      setLoading(false)
      return
    }
    let active = true
    fetch(`/api/libraries/emails/${libId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setTpl(d)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [libId])

  const recipients = ((deal?.deal_clients ?? []) as Array<{
    id: string
    name: string
    email: string | null
  }>).filter((c) => c.email)
  const isCompleted = Boolean(subtask?.is_completed)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Email a enviar
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Destinatários · {recipients.length}
          </span>
          <div className="mt-2 space-y-1">
            {recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem destinatários com email. Pode escolhê-los ao abrir o email.
              </p>
            ) : (
              recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground">{r.email}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-2 border-b px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Assunto</span>
          <span className="font-medium">{tpl?.subject ?? '—'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar o template…
          </div>
        ) : tpl?.body_html ? (
          <div
            className="max-h-[420px] overflow-y-auto bg-white"
            dangerouslySetInnerHTML={{ __html: tpl.body_html }}
          />
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Sem pré-visualização do template.
          </div>
        )}
      </div>

      {isCompleted ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          Email enviado.
        </p>
      ) : (
        <Button className="w-full" onClick={() => setSheetOpen(true)}>
          Enviar email
        </Button>
      )}

      <SubtaskEmailSheet
        subtask={subtask}
        propertyId={propertyId}
        processId={processId}
        taskId={task.id}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={() => {
          setSheetOpen(false)
          onTaskUpdate()
        }}
      />
    </div>
  )
}
