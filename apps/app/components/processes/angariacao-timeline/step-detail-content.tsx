'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  User,
  Users,
  Mail,
  MailCheck,
  Sparkles,
  Check,
  CheckCircle2,
  FileText,
  Paperclip,
  ListChecks,
  Loader2,
  ChevronDown,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubtaskPdfSheet } from '@/components/processes/subtask-pdf-sheet'
import { PropertyDocumentsRoot } from '@/components/properties/property-documents-root'
import { cn } from '@/lib/utils'
import type { AngariacaoStep } from './steps'
import type { StepStatus } from './process-timeline'
import { DescricaoImagensStep } from './descricao-imagens-step'

// Modelo CMI real (tpl_doc_library, PDF overlay 75 campos) — o mesmo do
// "Gerar CMI" do processo actual.
const CMI_DOC_LIBRARY_ID = '9223bdfc-31a0-4918-b5ee-580760ba8b32'

/**
 * Conteúdo rico de um passo — partilhado entre a vista inline (PC) e a
 * sheet (modern). Descrição (no próprio card) + área de acção por tipo.
 *
 * Email: template REAL editável (passo por enviar) OU card "email enviado"
 * (passo concluído) que expande para mostrar o que foi enviado.
 */
export function StepDetailContent({
  step,
  status,
  doneBy,
  doneAt,
  onComplete,
  propertyId,
  ownerId,
  consultantId,
  processId,
}: {
  step: AngariacaoStep
  status: StepStatus
  doneBy?: string | null
  doneAt?: string | null
  /** completar o passo (usado pela acção que gere o seu próprio fluxo, ex.: CMI) */
  onComplete?: () => void
  /** id real do imóvel — quando presente, o CMI usa o modelo real (PDF + prefill) */
  propertyId?: string | null
  /** contacto principal do imóvel — resolve as variáveis proprietario_* do CMI */
  ownerId?: string | null
  /** consultor/angariador — resolve as variáveis consultor_* do CMI */
  consultantId?: string | null
  /** proc_instance — resolve processo_ref */
  processId?: string | null
}) {
  const isEmail = step.action === 'email'
  // Passo 6 — "Descrição e Imagens do Imóvel" tem UI própria (2 tabs +
  // botão Tarefa Media), distinta do uploader genérico de documentos.
  const isDescricaoImagens = step.key === 'descricao_imagens'

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>

      {status === 'done' && !isEmail && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50/60 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Concluído{doneBy ? ` por ${doneBy}` : ''}
          {doneAt ? ` · ${doneAt}` : ''}
        </div>
      )}

      {isDescricaoImagens ? (
        <DescricaoImagensStep propertyId={propertyId} processId={processId} />
      ) : isEmail ? (
        <EmailArea step={step} status={status} sentBy={doneBy} sentAt={doneAt} />
      ) : status !== 'done' ? (
        <ActionArea
          step={step}
          onComplete={onComplete}
          propertyId={propertyId}
          ownerId={ownerId}
          consultantId={consultantId}
          processId={processId}
        />
      ) : null}
    </div>
  )
}

function ActionArea({
  step,
  onComplete,
  propertyId,
  ownerId,
  consultantId,
  processId,
}: {
  step: AngariacaoStep
  onComplete?: () => void
  propertyId?: string | null
  ownerId?: string | null
  consultantId?: string | null
  processId?: string | null
}) {
  switch (step.action) {
    case 'upload':
      return <DocumentsNeeded propertyId={propertyId} />
    case 'generate_doc':
      return (
        <GeneratePanel
          step={step}
          onComplete={onComplete}
          propertyId={propertyId}
          ownerId={ownerId}
          consultantId={consultantId}
          processId={processId}
        />
      )
    case 'confirm':
      return <ConfirmPanel step={step} />
    default:
      return null
  }
}

/* ── Email: template REAL, editável + card "email enviado" ──────────── */

// Templates reais em tpl_email_library (mesmos da rule `email_pedido_doc`).
const REAL_EMAIL_TEMPLATE_ID: Record<string, string> = {
  pedido_documentacao: '450c31c0-723d-4d79-8a2a-580e55b4f63f', // Pedido Singular
}

// Proprietários do imóvel (amostra). O email pode ir a um ou a todos —
// com dados reais virá de property_owners.
const EMAIL_RECIPIENTS = [
  { id: 'o1', name: 'João Silva', email: 'joao.silva@email.pt' },
  { id: 'o2', name: 'Maria Santos', email: 'maria.santos@email.pt' },
]

const FALLBACK_EMAIL_BODY: Record<string, string> = {
  envio_cmi: `Olá,

Em anexo segue o Contrato de Mediação Imobiliária (CMI) para a angariação do seu imóvel.

Por favor, reveja e assine o documento. Ficamos à disposição para qualquer esclarecimento.

Obrigado,
{{consultor}}`,
  email_agradecimento: `Olá,

O seu imóvel já se encontra publicado e divulgado nos nossos canais.

Queremos agradecer a confiança que depositou na Infinity Group. Vamos manter-lhe informado de cada passo e estamos sempre disponíveis para qualquer esclarecimento.

Obrigado,
{{consultor}}`,
}

// Assunto por defeito quando não há template real associado ao passo.
const FALLBACK_SUBJECT: Record<string, string> = {
  pedido_documentacao: 'Documentação para a angariação do seu imóvel',
  envio_cmi: 'Contrato de Mediação Imobiliária para assinatura',
  email_agradecimento: 'Obrigado pela sua confiança',
}

function useEmailTemplate(step: AngariacaoStep) {
  const templateId = REAL_EMAIL_TEMPLATE_ID[step.key]
  const [data, setData] = useState<{ subject?: string; body_html?: string } | null>(
    null
  )
  const [loading, setLoading] = useState(Boolean(templateId))

  useEffect(() => {
    if (!templateId) return
    let active = true
    fetch(`/api/libraries/emails/${templateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [templateId])

  const subject =
    data?.subject ??
    FALLBACK_SUBJECT[step.key] ??
    'Mensagem da Infinity Group'

  return { loading, subject, bodyHtml: data?.body_html ?? null }
}

function EmailArea({
  step,
  status,
  sentBy,
  sentAt,
}: {
  step: AngariacaoStep
  status: StepStatus
  sentBy?: string | null
  sentAt?: string | null
}) {
  const { loading, subject, bodyHtml } = useEmailTemplate(step)
  const fallback = FALLBACK_EMAIL_BODY[step.key] ?? ''

  if (status === 'done') {
    return (
      <SentEmailCard
        sentBy={sentBy}
        sentAt={sentAt}
        subject={subject}
        bodyHtml={bodyHtml}
        loading={loading}
        fallback={fallback}
      />
    )
  }

  return (
    <EditableEmail
      step={step}
      subject={subject}
      bodyHtml={bodyHtml}
      loading={loading}
      fallback={fallback}
    />
  )
}

function EmailBody({
  loading,
  bodyHtml,
  fallback,
  editable,
}: {
  loading: boolean
  bodyHtml: string | null
  fallback: string
  editable?: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar o template…
      </div>
    )
  }
  if (bodyHtml) {
    return (
      <div
        contentEditable={editable}
        suppressContentEditableWarning
        className={cn(
          'max-h-[460px] overflow-y-auto bg-white outline-none',
          editable && 'ring-2 ring-inset ring-emerald-500/40'
        )}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    )
  }
  return (
    <div
      contentEditable={editable}
      suppressContentEditableWarning
      className={cn(
        'whitespace-pre-line px-4 py-4 text-sm leading-relaxed text-foreground/90 outline-none',
        editable && 'ring-2 ring-inset ring-emerald-500/40'
      )}
    >
      {fallback}
    </div>
  )
}

function EditableEmail({
  step,
  subject,
  bodyHtml,
  loading,
  fallback,
}: {
  step: AngariacaoStep
  subject: string
  bodyHtml: string | null
  loading: boolean
  fallback: string
}) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(EMAIL_RECIPIENTS.map((r) => r.id))
  )
  const hasAttachment = step.order === 1 || step.order === 4

  const allSelected = selected.size === EMAIL_RECIPIENTS.length
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) {
        if (n.size > 1) n.delete(id) // manter pelo menos um destinatário
      } else {
        n.add(id)
      }
      return n
    })
  const toggleAll = () =>
    setSelected(
      allSelected
        ? new Set([EMAIL_RECIPIENTS[0].id]) // só o principal
        : new Set(EMAIL_RECIPIENTS.map((r) => r.id))
    )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Email a enviar
        </span>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Pencil className="h-3 w-3" />
          {editing ? 'Concluir edição' : 'Editar'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Destinatários — um ou todos os proprietários */}
        <div className="border-b bg-muted/30 px-4 py-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Destinatários · {selected.size}/{EMAIL_RECIPIENTS.length}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[11px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {allSelected ? 'Enviar só ao principal' : 'Enviar a todos'}
            </button>
          </div>
          <div className="space-y-0.5">
            {EMAIL_RECIPIENTS.map((r) => {
              const on = selected.has(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      on
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-muted-foreground/40'
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {r.email}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Assunto */}
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 text-sm">
          <span className="w-16 shrink-0 text-muted-foreground">Assunto</span>
          {editing ? (
            <input
              defaultValue={subject}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          ) : (
            <span className="font-medium text-foreground">{subject}</span>
          )}
        </div>

        <EmailBody
          loading={loading}
          bodyHtml={bodyHtml}
          fallback={fallback}
          editable={editing}
        />

        {hasAttachment && (
          <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2.5 text-sm">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">
              {step.order === 1
                ? 'Ficha de Branqueamento de Capitais.pdf'
                : 'CMI.pdf'}
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {editing
          ? 'A editar o email — as alterações aplicam-se antes de enviar.'
          : selected.size > 1
            ? `Vai ser enviado aos ${selected.size} proprietários seleccionados.`
            : 'Vai ser enviado a 1 proprietário.'}
      </p>
    </div>
  )
}

function SentEmailCard({
  sentBy,
  sentAt,
  subject,
  bodyHtml,
  loading,
  fallback,
}: {
  sentBy?: string | null
  sentAt?: string | null
  subject: string
  bodyHtml: string | null
  loading: boolean
  fallback: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <MailCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            Email enviado{sentBy ? ` por ${sentBy}` : ''}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {subject}
            {sentAt ? ` · ${sentAt}` : ''}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="border-t">
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-4 py-2 text-xs">
            <span className="text-muted-foreground">Para:</span>
            {EMAIL_RECIPIENTS.map((r) => (
              <span
                key={r.id}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
              >
                {r.name}
              </span>
            ))}
          </div>
          <EmailBody loading={loading} bodyHtml={bodyHtml} fallback={fallback} />
        </div>
      )}
    </div>
  )
}

/* ── Upload: documentos necessários (agrupados, estilo passo 2) ─────── */

type DocItem = { name: string; status: 'pending' | 'uploaded' }
type DocGroup = {
  label: string
  sub?: string
  icon: 'property' | 'singular'
  items: DocItem[]
}

const SAMPLE_DOC_GROUPS: DocGroup[] = [
  {
    label: 'Imóvel',
    icon: 'property',
    items: [
      { name: 'Certificado Energético', status: 'pending' },
      { name: 'Caderneta Predial Urbana', status: 'pending' },
      { name: 'Certidão Permanente', status: 'uploaded' },
      { name: 'Licença de Utilização', status: 'pending' },
      { name: 'Ficha Técnica de Habitação', status: 'pending' },
      { name: 'Planta do Imóvel', status: 'pending' },
    ],
  },
  {
    label: 'João Silva',
    sub: 'Pessoa singular',
    icon: 'singular',
    items: [
      { name: 'Cartão de Cidadão', status: 'pending' },
      { name: 'Ficha de Branqueamento de Capitais', status: 'pending' },
    ],
  },
]

function DocumentsNeeded({ propertyId }: { propertyId?: string | null }) {
  // Com imóvel real → gestor de documentos real do imóvel (upload a sério para
  // os documentos do imóvel). Sem (rota preview) → lista de amostra.
  if (propertyId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          Documentos do imóvel
        </div>
        <PropertyDocumentsRoot propertyId={propertyId} defaultTab="cmi" hideAlerts />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        Documentos necessários
      </div>

      {SAMPLE_DOC_GROUPS.map((group) => {
        const done = group.items.filter((d) => d.status === 'uploaded').length
        const GIcon = group.icon === 'property' ? Building2 : User
        return (
          <div key={group.label} className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <GIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {group.label}
                  {group.sub && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {group.sub}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {done}/{group.items.length}
              </span>
            </div>
            <ul className="divide-y">
              {group.items.map((doc) => (
                <li
                  key={doc.name}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{doc.name}</span>
                  {doc.status === 'uploaded' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Carregado
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      Em falta
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-6 text-center">
        <Paperclip className="h-5 w-5 text-muted-foreground/50" />
        <p className="text-sm font-medium">Arrastar ficheiros ou clicar</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          A IA extrai os dados e preenche a informação do imóvel
        </p>
      </div>
    </div>
  )
}

/* ── Gerar documento (o CMI real do sistema) ───────────────────────── */

type CmiField = { key: string; label: string; value: string }

// Campos do modelo CMI (amostra representativa dos 75 campos reais). Os
// preenchidos vêm dos dados do imóvel; os vazios aparecem como "em falta".
const CMI_FIELDS_INIT: CmiField[] = [
  { key: 'mediadora', label: 'Mediadora', value: 'Infinity Group' },
  { key: 'ami', label: 'Licença AMI', value: '' },
  { key: 'prop1', label: 'Proprietário', value: 'João Silva' },
  { key: 'prop1_nif', label: 'NIF', value: '' },
  { key: 'prop2', label: 'Proprietário', value: 'Maria Santos' },
  { key: 'prop2_nif', label: 'NIF', value: '' },
  { key: 'morada', label: 'Morada do imóvel', value: 'Rua das Flores, n.º 10, Lisboa' },
  { key: 'conservatoria', label: 'Conservatória / descrição', value: '' },
  { key: 'artigo', label: 'Artigo matricial', value: '' },
  { key: 'preco', label: 'Preço de venda', value: '350 000 €' },
  { key: 'comissao', label: 'Comissão', value: '5%' },
  { key: 'regime', label: 'Regime', value: '' },
]

/**
 * Builder do CMI — sem botão "gerar". Mostra o contrato com os campos
 * auto-preenchidos a partir do imóvel; os que faltam aparecem destacados
 * (amber) e a contagem em falta é mostrada em tag. Todos os campos são
 * editáveis inline. Com dados reais, é o modelo CMI (PDF overlay, 75 campos).
 */
function GeneratePanel({
  onComplete,
  propertyId,
  ownerId,
  consultantId,
  processId,
}: {
  step: AngariacaoStep
  onComplete?: () => void
  propertyId?: string | null
  ownerId?: string | null
  consultantId?: string | null
  processId?: string | null
}) {
  // Com imóvel real → modelo CMI real (PDF + prefill). Sem (rota preview) →
  // builder de amostra.
  if (propertyId)
    return (
      <CmiRealBuilder
        propertyId={propertyId}
        ownerId={ownerId}
        consultantId={consultantId}
        processId={processId}
        onComplete={onComplete}
      />
    )
  return <CmiMockBuilder onComplete={onComplete} />
}

/** Editor real do CMI embebido inline na sheet do passo (como o email aparece):
 * carrega o PDF do modelo já pré-preenchido a partir do imóvel e permite editar
 * os campos. Os campos em falta ficam destacados. */
function CmiRealBuilder({
  propertyId,
  ownerId,
  consultantId,
  processId,
  onComplete,
}: {
  propertyId: string
  ownerId?: string | null
  consultantId?: string | null
  processId?: string | null
  onComplete?: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-[68vh] min-h-[460px]">
          <SubtaskPdfSheet
            inline
            open
            onOpenChange={() => {}}
            propertyId={propertyId}
            ownerId={ownerId ?? undefined}
            consultantId={consultantId ?? undefined}
            processId={processId ?? undefined}
            docLibraryId={CMI_DOC_LIBRARY_ID}
            previewTitle="CMI — pré-preenchido a partir do imóvel"
          />
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => onComplete?.()}
      >
        Concluir CMI
      </Button>
    </div>
  )
}

function CmiMockBuilder({ onComplete }: { onComplete?: () => void }) {
  const [fields, setFields] = useState<CmiField[]>(CMI_FIELDS_INIT)
  const update = (key: string, value: string) =>
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, value } : f)))
  const get = (key: string) => fields.find((f) => f.key === key) as CmiField
  const missing = fields.filter((f) => !f.value.trim()).length
  const filled = fields.length - missing
  const f = (k: string) => <FieldInput field={get(k)} onChange={update} />

  return (
    <div className="space-y-3">
      {/* tags de estado dos campos */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> {filled} preenchidos
        </span>
        {missing > 0 ? (
          <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            {missing} em falta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Tudo preenchido
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          campos auto-preenchidos a partir do imóvel — editáveis
        </span>
      </div>

      {/* documento editável (builder) */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <FileText className="h-3.5 w-3.5" /> CMI.pdf
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Editável
          </span>
        </div>
        <div className="max-h-[460px] overflow-y-auto bg-white px-6 py-6 text-[13px] leading-8 text-neutral-800">
          <h3 className="text-center text-sm font-bold uppercase tracking-wide">
            Contrato de Mediação Imobiliária
          </h3>
          <p className="mt-4">
            <strong>Primeiro Outorgante (Mediadora):</strong> {f('mediadora')}, titular
            da licença AMI n.º {f('ami')}.
          </p>
          <p className="mt-2">
            <strong>Segundos Outorgantes (Proprietários):</strong> {f('prop1')}, NIF{' '}
            {f('prop1_nif')}; e {f('prop2')}, NIF {f('prop2_nif')}.
          </p>
          <p className="mt-2">
            <strong>Imóvel:</strong> sito em {f('morada')}, descrito na Conservatória
            sob {f('conservatoria')}, inscrito na matriz sob o artigo {f('artigo')}.
          </p>
          <p className="mt-4 font-semibold">Cláusula 1.ª — Objecto e regime</p>
          <p>
            Os Segundos Outorgantes incumbem a Mediadora de diligenciar a venda do
            imóvel, em regime de {f('regime')}.
          </p>
          <p className="mt-3 font-semibold">Cláusula 2.ª — Preço</p>
          <p>O preço de venda pretendido é de {f('preco')}.</p>
          <p className="mt-3 font-semibold">Cláusula 3.ª — Remuneração</p>
          <p>
            A Mediadora terá direito a uma remuneração de {f('comissao')} sobre o valor
            da venda, acrescida de IVA.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onComplete?.()}>Concluir CMI</Button>
        {missing > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Faltam {missing} campos por preencher.
          </span>
        )}
      </div>
    </div>
  )
}

function FieldInput({
  field,
  onChange,
}: {
  field: CmiField
  onChange: (key: string, value: string) => void
}) {
  const empty = !field.value.trim()
  return (
    <input
      value={field.value}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={`${field.label} (em falta)`}
      size={Math.max((field.value || field.label).length + 4, 8)}
      className={cn(
        'mx-0.5 inline rounded border-b px-1 text-[13px] outline-none transition-colors',
        empty
          ? 'border-amber-400 bg-amber-50 text-amber-800 placeholder:text-amber-600'
          : 'border-emerald-300 bg-emerald-50/40 text-neutral-900 focus:bg-white'
      )}
    />
  )
}

/* ── Confirmar ─────────────────────────────────────────────────────── */

function ConfirmPanel({ step }: { step: AngariacaoStep }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-6 text-center">
        <Paperclip className="h-5 w-5 text-muted-foreground/50" />
        <p className="text-sm font-medium">Carregar o CMI assinado</p>
      </div>
      <Requires step={step} />
    </div>
  )
}

function Requires({ step }: { step: AngariacaoStep }) {
  if (!step.requires.length) return null
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        O que é preciso
      </div>
      <ul className="space-y-1.5">
        {step.requires.map((r) => (
          <li key={r} className="flex items-start gap-2 text-sm text-foreground/90">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}
