# SPEC — Email Status Tracking via Resend + Reenvio de Emails

**Data**: 2026-03-05
**PRD**: [PRD-EMAIL-STATUS-RESEND.md](../PRD-EMAIL-STATUS-RESEND.md)
**Branch**: master

---

## Fase 1 — Database + Types + Constants

### 1.1 CRIAR: `supabase/migrations/20260305_update_log_emails.sql`

Migração para adicionar colunas ao `log_emails` existente. A tabela actual tem: `id, proc_task_id, recipient_email, subject, sent_at, delivery_status, provider_id, metadata`.

```sql
ALTER TABLE log_emails
  ADD COLUMN IF NOT EXISTS proc_subtask_id UUID REFERENCES proc_subtasks(id),
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS cc TEXT[],
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS last_event TEXT DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS parent_email_id UUID REFERENCES log_emails(id),
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Índices para webhook lookup e queries
CREATE INDEX IF NOT EXISTS idx_log_emails_resend_id ON log_emails(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_task ON log_emails(proc_task_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_subtask ON log_emails(proc_subtask_id);

-- RLS: webhook handler usa admin client (bypass RLS), mas leitura precisa de policy
ALTER TABLE log_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read log_emails"
  ON log_emails FOR SELECT
  TO authenticated
  USING (true);

-- Insert via admin client (webhook + API routes), não precisa de policy de INSERT para authenticated
-- Mas o webhook handler usa createAdminClient() que bypassa RLS
```

**Nota**: A coluna `provider_id` existente NÃO será usada — usamos `resend_email_id` para clareza. A coluna `delivery_status` existente será usada em paralelo com `last_event`.

---

### 1.2 MODIFICAR: `types/process.ts`

**Localização**: Linha ~160-173 (union type `TaskActivityType`)

Adicionar novos activity types ao union:

```typescript
// ANTES (linha 160-173):
export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  // ... existing types ...
  | 'comment'

// DEPOIS — adicionar ao final, antes do último:
export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'due_date_change'
  | 'bypass'
  | 'upload'
  | 'email_sent'
  | 'doc_generated'
  | 'started'
  | 'completed'
  | 'viewed'
  | 'draft_generated'
  | 'comment'
  | 'email_delivered'   // ← NOVO
  | 'email_opened'      // ← NOVO
  | 'email_clicked'     // ← NOVO
  | 'email_bounced'     // ← NOVO
  | 'email_failed'      // ← NOVO
  | 'email_resent'      // ← NOVO
```

Adicionar também o type `LogEmail` no mesmo ficheiro (no final):

```typescript
export interface LogEmail {
  id: string
  proc_task_id: string | null
  proc_subtask_id: string | null
  resend_email_id: string | null
  recipient_email: string
  sender_email: string | null
  sender_name: string | null
  cc: string[] | null
  subject: string | null
  body_html: string | null
  sent_at: string | null
  delivery_status: string | null
  last_event: string
  events: Array<{
    type: string
    timestamp: string
    metadata?: Record<string, unknown> | null
  }>
  parent_email_id: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}
```

---

### 1.3 MODIFICAR: `lib/validations/activity.ts`

**Localização**: Linha 3 (z.enum array)

Adicionar novos tipos ao enum do Zod:

```typescript
// ANTES:
activity_type: z.enum([
  'status_change', 'assignment', 'priority_change', 'due_date_change',
  'bypass', 'upload', 'email_sent', 'doc_generated', 'started',
  'completed', 'viewed', 'draft_generated', 'comment',
]),

// DEPOIS:
activity_type: z.enum([
  'status_change', 'assignment', 'priority_change', 'due_date_change',
  'bypass', 'upload', 'email_sent', 'doc_generated', 'started',
  'completed', 'viewed', 'draft_generated', 'comment',
  'email_delivered', 'email_opened', 'email_clicked',
  'email_bounced', 'email_failed', 'email_resent',
]),
```

---

### 1.4 MODIFICAR: `lib/constants.ts`

**Localização**: Linha ~443-461 (`TASK_ACTIVITY_TYPE_CONFIG`)

Adicionar novos activity types ao config map:

```typescript
// Adicionar DENTRO do TASK_ACTIVITY_TYPE_CONFIG, depois de 'comment':
email_delivered:  { icon: 'MailCheck',          label: 'Email entregue',     color: 'text-emerald-500' },
email_opened:     { icon: 'MailOpen',           label: 'Email aberto',       color: 'text-violet-500' },
email_clicked:    { icon: 'MousePointerClick',  label: 'Link clicado',       color: 'text-indigo-500' },
email_bounced:    { icon: 'MailX',              label: 'Email rejeitado',    color: 'text-red-500' },
email_failed:     { icon: 'AlertCircle',        label: 'Erro no envio',      color: 'text-red-500' },
email_resent:     { icon: 'MailPlus',           label: 'Email reenviado',    color: 'text-sky-500' },
```

Adicionar também um **novo export** `EMAIL_STATUS_CONFIG` (no final do ficheiro ou junto ao bloco de email):

```typescript
export const EMAIL_STATUS_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  badgeVariant: 'secondary' | 'default' | 'destructive' | 'outline'
}> = {
  sent:      { label: 'Enviado',   icon: 'Mail',              color: 'text-sky-500',     badgeVariant: 'secondary' },
  delivered: { label: 'Entregue',  icon: 'MailCheck',         color: 'text-emerald-500', badgeVariant: 'default' },
  opened:    { label: 'Aberto',    icon: 'MailOpen',          color: 'text-violet-500',  badgeVariant: 'default' },
  clicked:   { label: 'Clicado',   icon: 'MousePointerClick', color: 'text-indigo-500',  badgeVariant: 'default' },
  bounced:   { label: 'Rejeitado', icon: 'MailX',             color: 'text-red-500',     badgeVariant: 'destructive' },
  complained:{ label: 'Spam',      icon: 'ShieldAlert',       color: 'text-red-500',     badgeVariant: 'destructive' },
  failed:    { label: 'Falhou',    icon: 'AlertCircle',       color: 'text-red-500',     badgeVariant: 'destructive' },
  delayed:   { label: 'Atrasado',  icon: 'Clock',             color: 'text-amber-500',   badgeVariant: 'outline' },
}
```

---

### 1.5 MODIFICAR: `components/processes/task-activity-timeline.tsx`

**Localização**: Linha ~27-31 (icon mapping)

Adicionar os novos ícones Lucide ao mapa de ícones. O componente usa um `Record<string, LucideIcon>` para mapear o nome do ícone (string) para o componente React.

Adicionar imports e entradas no mapa:

```typescript
// Adicionar aos imports do lucide-react:
import { MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus, ShieldAlert, Clock } from 'lucide-react'

// Adicionar ao iconMap:
MailCheck: MailCheck,
MailOpen: MailOpen,
MousePointerClick: MousePointerClick,
MailX: MailX,
AlertCircle: AlertCircle,
MailPlus: MailPlus,
ShieldAlert: ShieldAlert,
Clock: Clock,
```

---

## Fase 2 — Backend: Guardar resend_id + Inserir log_emails

### 2.1 MODIFICAR: `components/processes/subtask-email-sheet.tsx`

**Localização**: Função `handleConfirmSend()` (linha 516-571)

**O que mudar**: Capturar o `resend_email_id` da response do edge function e enviá-lo ao backend junto com a marcação de completed.

```typescript
// ANTES (linha 547-560):
if (!res.ok) {
  const err = await res.json()
  throw new Error(err.error || 'Erro ao enviar email')
}

await callSubtaskApi({
  rendered_content: {
    subject,
    body_html: pendingPayload.html,
    editor_state: JSON.parse(pendingPayload.state),
  },
  is_completed: true,
})

// DEPOIS:
if (!res.ok) {
  const err = await res.json()
  throw new Error(err.error || 'Erro ao enviar email')
}

const sendData = await res.json()
const resendEmailId = sendData.id // resend email ID

await callSubtaskApi({
  rendered_content: {
    subject,
    body_html: pendingPayload.html,
    editor_state: JSON.parse(pendingPayload.state),
  },
  is_completed: true,
  resend_email_id: resendEmailId,
  email_metadata: {
    sender_email: emailForm.senderEmail,
    sender_name: emailForm.senderName,
    recipient_email: emailForm.recipientEmail,
    cc: emailForm.cc ? emailForm.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
  },
})
```

**Nota**: A função `callSubtaskApi` faz fetch ao `PUT /api/processes/{id}/tasks/{taskId}/subtasks/{subtaskId}`. O body precisa ser actualizado no schema Zod do backend (ver 2.3).

---

### 2.2 MODIFICAR: `components/processes/task-detail-actions.tsx`

**Localização**: Função `handleSendEmail()` (linha 116-152)

**O que mudar**: Capturar o `resend_email_id` e passá-lo ao `handleAction('complete')` para que seja guardado no `log_emails`.

```typescript
// ANTES (linha 139-146):
if (!res.ok) {
  const err = await res.json()
  throw new Error(err.error || 'Erro ao enviar email')
}

toast.success('Email enviado com sucesso!')
setEmailDialogOpen(false)
await handleAction('complete')

// DEPOIS:
if (!res.ok) {
  const err = await res.json()
  throw new Error(err.error || 'Erro ao enviar email')
}

const sendData = await res.json()

toast.success('Email enviado com sucesso!')
setEmailDialogOpen(false)
await handleAction('complete', {
  resend_email_id: sendData.id,
  email_metadata: {
    sender_email: emailForm.senderEmail,
    sender_name: emailForm.senderName,
    recipient_email: emailForm.recipientEmail,
    cc: emailForm.cc ? emailForm.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
    subject: emailForm.subject,
    body_html: wrapEmailHtml(emailForm.body),
  },
})
```

**Nota**: A função `handleAction` é passada via props e faz `PUT /api/processes/{id}/tasks/{taskId}`. Verificar como `handleAction` passa os dados extra — pode ser necessário adicionar um parâmetro `extra_metadata` ao body do PUT, ou ajustar a interface do `handleAction` no componente pai.

Verificar a prop `handleAction` — se é `(action: string) => Promise<void>`, alterar para `(action: string, extraData?: Record<string, unknown>) => Promise<void>`. Propagar a mudança até ao componente que faz o fetch para a task API route.

---

### 2.3 MODIFICAR: `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

**Localização**: Linhas 8-23 (schema Zod) e linhas 107-189 (lógica de update + activity)

**O que mudar**:

**a) Actualizar o Zod schema** (linha 8-23) para aceitar os novos campos:

```typescript
const subtaskUpdateSchema = z
  .object({
    is_completed: z.boolean().optional(),
    rendered_content: z
      .object({
        subject: z.string().optional(),
        body_html: z.string().optional(),
        content_html: z.string().optional(),
        editor_state: z.any().optional(),
      })
      .optional(),
    resend_email_id: z.string().optional(),           // ← NOVO
    email_metadata: z.object({                         // ← NOVO
      sender_email: z.string().optional(),
      sender_name: z.string().optional(),
      recipient_email: z.string().optional(),
      cc: z.array(z.string()).optional(),
    }).optional(),
  })
  .refine(
    (data) => data.is_completed !== undefined || data.rendered_content !== undefined,
    { message: 'is_completed ou rendered_content são obrigatórios' }
  )
```

**b) Após update da subtarefa e ANTES do log de actividade** (depois da linha 123), inserir no `log_emails` quando é email completed:

```typescript
// Depois do update da subtarefa (linha 123), antes do log de actividade (linha 125):

// Inserir log_emails quando email é enviado com sucesso
if (is_completed && (subtaskType === 'email') && resend_email_id) {
  const { error: logError } = await adminDb.from('log_emails').insert({
    proc_task_id: taskId,
    proc_subtask_id: subtaskId,
    resend_email_id,
    recipient_email: email_metadata?.recipient_email || '',
    sender_email: email_metadata?.sender_email || null,
    sender_name: email_metadata?.sender_name || null,
    cc: email_metadata?.cc || null,
    subject: rendered_content?.subject || null,
    body_html: rendered_content?.body_html || null,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    last_event: 'sent',
    events: [{ type: 'sent', timestamp: new Date().toISOString() }],
    metadata: { subtask_title: (subtask as any).title },
  })
  if (logError) console.error('[log_emails] Erro ao inserir:', logError)
}
```

**c) Actualizar metadata do activity log** (linha 168-173) para incluir `resend_email_id`:

```typescript
const metadata: Record<string, unknown> = {
  subtask_id: subtaskId,
  subtask_title: subtaskTitle,
  ...(ownerName && { owner_name: ownerName, owner_id: (subtask as any).owner_id }),
  ...(templateName && { template_name: templateName }),
  ...(resend_email_id && { resend_email_id }),  // ← NOVO
}
```

---

### 2.4 MODIFICAR: `app/api/processes/[id]/tasks/[taskId]/route.ts`

**Localização**: PUT handler, case 'complete' (linha ~262-285)

**O que mudar**: Para tarefas EMAIL simples (não subtarefa), aceitar `resend_email_id` e `email_metadata` no body e inserir no `log_emails`.

Actualizar o Zod schema do body para aceitar campos opcionais:

```typescript
// No schema de validação do body (procurar onde 'action' é validado), adicionar:
resend_email_id: z.string().optional(),
email_metadata: z.object({
  sender_email: z.string().optional(),
  sender_name: z.string().optional(),
  recipient_email: z.string().optional(),
  cc: z.array(z.string()).optional(),
  subject: z.string().optional(),
  body_html: z.string().optional(),
}).optional(),
```

No case 'complete', após o update da tarefa e se `action_type === 'EMAIL'`:

```typescript
// Após update da tarefa, se é EMAIL task com resend_email_id:
if (resend_email_id && task.action_type === 'EMAIL') {
  const { error: logError } = await adminDb.from('log_emails').insert({
    proc_task_id: taskId,
    resend_email_id,
    recipient_email: email_metadata?.recipient_email || '',
    sender_email: email_metadata?.sender_email || null,
    sender_name: email_metadata?.sender_name || null,
    cc: email_metadata?.cc || null,
    subject: email_metadata?.subject || null,
    body_html: email_metadata?.body_html || null,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    last_event: 'sent',
    events: [{ type: 'sent', timestamp: new Date().toISOString() }],
  })
  if (logError) console.error('[log_emails] Erro ao inserir:', logError)
}
```

---

## Fase 3 — Webhook Handler (Resend → App)

### 3.1 INSTALAR: Dependência `svix`

```bash
npm install svix
```

---

### 3.2 CRIAR: `app/api/webhooks/resend/route.ts`

Webhook handler que recebe eventos do Resend, actualiza `log_emails` e loga actividades.

**Implementação completa** (seguir exactamente o snippet do PRD secção 12.1):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/admin'

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!

interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    bounce?: { message: string; type: string; subType: string }
    click?: { ipAddress: string; link: string; timestamp: string; userAgent: string }
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text()    // IMPORTANTE: raw text, NÃO json()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  let event: ResendWebhookPayload
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const resendEmailId = event.data.email_id
  const eventType = event.type.replace('email.', '') // 'delivered', 'opened', etc.

  // 1. Buscar log_emails pelo resend_email_id
  const { data: logEmail } = await supabase
    .from('log_emails')
    .select('id, proc_task_id, proc_subtask_id, events')
    .eq('resend_email_id', resendEmailId)
    .single()

  if (!logEmail) {
    // Email não registado no nosso sistema — ignorar silenciosamente
    return NextResponse.json({ received: true, matched: false })
  }

  // 2. Actualizar status e append ao histórico de eventos
  const events = Array.isArray(logEmail.events) ? logEmail.events : []
  events.push({
    type: eventType,
    timestamp: event.created_at,
    metadata: event.data.bounce || event.data.click || null,
  })

  await supabase.from('log_emails').update({
    last_event: eventType,
    delivery_status: eventType,
    events,
    ...(event.data.bounce && { error_message: event.data.bounce.message }),
  }).eq('id', logEmail.id)

  // 3. Logar actividade na tarefa
  if (logEmail.proc_task_id) {
    const activityMap: Record<string, string> = {
      delivered: 'email_delivered',
      opened: 'email_opened',
      clicked: 'email_clicked',
      bounced: 'email_bounced',
      failed: 'email_failed',
      complained: 'email_bounced',    // complained → mesmo tipo visual que bounced
    }
    const activityType = activityMap[eventType]
    if (activityType) {
      await supabase.from('proc_task_activities').insert({
        proc_task_id: logEmail.proc_task_id,
        user_id: null,                // evento de sistema (não de utilizador)
        activity_type: activityType,
        description: `Email ${eventType}: ${event.data.subject}`,
        metadata: {
          resend_email_id: resendEmailId,
          event_type: eventType,
          recipient: event.data.to?.[0],
          ...(event.data.bounce && { bounce: event.data.bounce }),
          ...(event.data.click && { click: event.data.click }),
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}
```

**IMPORTANTE**: A RLS policy de INSERT em `proc_task_activities` exige `auth.uid() = user_id`. O webhook usa `createAdminClient()` que bypassa RLS — OK. Mas atenção: `user_id: null` no INSERT. Verificar se a tabela aceita NULL no `user_id` — SIM, a coluna é `UUID REFERENCES dev_users(id)` sem NOT NULL (ver migração linha 4).

---

### 3.3 Configuração no Resend Dashboard

**Não é código** — é configuração manual:
1. Ir a https://resend.com/webhooks
2. Adicionar endpoint: `https://<domain>/api/webhooks/resend`
3. Seleccionar eventos: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.delivery_delayed`
4. Copiar o webhook signing secret para `RESEND_WEBHOOK_SECRET` no `.env.local`

---

## Fase 4 — API de Reenvio de Email

### 4.1 CRIAR: `app/api/processes/[id]/tasks/[taskId]/resend-email/route.ts`

API route POST que reenvia um email previamente enviado. Busca conteúdo original do `log_emails`, envia novo email via edge function, cria novo `log_emails` com referência ao original.

**Implementação completa** (seguir snippet do PRD secção 12.2):

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { z } from 'zod'

const resendSchema = z.object({
  log_email_id: z.string(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: processId, taskId } = await params
    const supabase = await createClient()
    const adminDb = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = resendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'log_email_id é obrigatório' }, { status: 400 })
    }

    const { log_email_id } = parsed.data

    // 1. Buscar email original
    const { data: original, error: fetchError } = await adminDb
      .from('log_emails')
      .select('*')
      .eq('id', log_email_id)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 })
    }

    // Verificar que pertence à tarefa correcta
    if (original.proc_task_id !== taskId) {
      return NextResponse.json({ error: 'Email não pertence a esta tarefa' }, { status: 403 })
    }

    // 2. Reenviar via edge function
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: original.sender_name,
          senderEmail: original.sender_email,
          recipientEmail: original.recipient_email,
          ...(original.cc && original.cc.length > 0 && { cc: original.cc }),
          subject: original.subject,
          body: original.body_html,
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error || 'Falha ao reenviar email' },
        { status: 502 }
      )
    }

    const sendData = await res.json()

    // 3. Criar novo log_emails com referência ao original
    const { error: insertError } = await adminDb.from('log_emails').insert({
      proc_task_id: original.proc_task_id,
      proc_subtask_id: original.proc_subtask_id,
      resend_email_id: sendData.id,
      recipient_email: original.recipient_email,
      sender_email: original.sender_email,
      sender_name: original.sender_name,
      cc: original.cc,
      subject: original.subject,
      body_html: original.body_html,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      last_event: 'sent',
      events: [{ type: 'sent', timestamp: new Date().toISOString() }],
      parent_email_id: original.id,
      metadata: { resent_by: user.id, original_email_id: original.id },
    })

    if (insertError) {
      console.error('[resend-email] Erro ao inserir log_emails:', insertError)
    }

    // 4. Logar actividade
    const { data: userData } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', user.id)
      .single()

    await logTaskActivity(
      adminDb,
      taskId,
      user.id,
      'email_resent',
      `${userData?.commercial_name || 'Utilizador'} reenviou email para ${original.recipient_email}`,
      { resend_email_id: sendData.id, original_log_email_id: original.id }
    )

    return NextResponse.json({ success: true, id: sendData.id })
  } catch (error) {
    console.error('[resend-email] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

## Fase 5 — API de Leitura de Emails + Hook

### 5.1 CRIAR: `app/api/emails/route.ts`

API GET que retorna emails de uma tarefa (para o hook `useEmailStatus`).

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('task_id')
    const subtaskId = searchParams.get('subtask_id')

    if (!taskId) {
      return NextResponse.json({ error: 'task_id é obrigatório' }, { status: 400 })
    }

    const adminDb = createAdminClient()
    let query = adminDb
      .from('log_emails')
      .select('*')
      .eq('proc_task_id', taskId)
      .order('sent_at', { ascending: false })

    if (subtaskId) {
      query = query.eq('proc_subtask_id', subtaskId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

### 5.2 CRIAR: `hooks/use-email-status.ts`

Hook com fetch + realtime subscription para `log_emails`.

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { LogEmail } from '@/types/process'

export function useEmailStatus(taskId: string | null, subtaskId?: string | null) {
  const [emails, setEmails] = useState<LogEmail[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchEmails = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ task_id: taskId })
      if (subtaskId) params.set('subtask_id', subtaskId)
      const res = await fetch(`/api/emails?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEmails(data)
      }
    } catch (err) {
      console.error('[useEmailStatus] Erro:', err)
    } finally {
      setIsLoading(false)
    }
  }, [taskId, subtaskId])

  useEffect(() => {
    fetchEmails()

    if (!taskId) return

    // Realtime subscription para updates de log_emails
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel(`email-status-${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'log_emails',
        filter: `proc_task_id=eq.${taskId}`,
      }, () => fetchEmails())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchEmails])

  return { emails, isLoading, refetch: fetchEmails }
}
```

**Nota**: Usar `createBrowserClient` do `@supabase/ssr` (mesmo padrão que `hooks/use-task-activities.ts`). Verificar como o hook existente cria o client e seguir o mesmo padrão.

---

## Fase 6 — UI: Email Status Badge + Botão Reenviar

### 6.1 MODIFICAR: `components/processes/task-form-action.tsx`

**O que mudar**: Nos items de subtarefa de tipo `email`, mostrar um badge com o status do email (enviado/entregue/aberto/rejeitado) em vez de apenas "Rascunho".

**Onde**: Na secção de badges das subtarefas (linhas ~200-220).

**Como**:
1. Importar `useEmailStatus` e `EMAIL_STATUS_CONFIG`
2. Para cada subtarefa de tipo email que está completed, buscar o `last_event` do `log_emails`
3. Renderizar `<EmailStatusBadge status={lastEvent} />` ao lado do badge de tipo

**Abordagem**: O componente `TaskFormAction` recebe a `task` como prop. Usar `useEmailStatus(task.id)` uma vez no topo do componente. Para cada subtarefa email completed, encontrar o email correspondente no array por `proc_subtask_id`.

```typescript
// No topo do componente:
import { useEmailStatus } from '@/hooks/use-email-status'
import { EMAIL_STATUS_CONFIG } from '@/lib/constants'

// Dentro do componente:
const { emails } = useEmailStatus(task.id)

// Na renderização de cada subtarefa email:
const emailForSubtask = emails.find(e => e.proc_subtask_id === subtask.id)
const emailStatus = emailForSubtask?.last_event || null

// Renderizar badge:
{emailStatus && (
  <Badge variant={EMAIL_STATUS_CONFIG[emailStatus]?.badgeVariant || 'secondary'} className="gap-1 text-xs">
    <EmailStatusIcon status={emailStatus} className="h-3 w-3" />
    {EMAIL_STATUS_CONFIG[emailStatus]?.label || emailStatus}
  </Badge>
)}
```

**Componente auxiliar `EmailStatusIcon`**: Criar inline ou como helper — mapeia o nome do ícone para o componente Lucide:

```typescript
function EmailStatusIcon({ status, className }: { status: string; className?: string }) {
  const config = EMAIL_STATUS_CONFIG[status]
  if (!config) return null
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Mail, MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, Clock, ShieldAlert,
  }
  const Icon = icons[config.icon]
  return Icon ? <Icon className={cn(config.color, className)} /> : null
}
```

---

### 6.2 MODIFICAR: `components/processes/subtask-email-sheet.tsx`

**O que mudar**: Adicionar botão "Reenviar" quando a subtarefa já foi enviada e existe um `log_email` para ela.

**Onde**: No header ou footer do sheet, junto ao botão "Enviar".

**Como**:
1. Importar `useEmailStatus`
2. Verificar se subtarefa já está completed e tem email no `log_emails`
3. Se sim, mostrar badge de status + botão "Reenviar"

```typescript
// Props ou state:
const { emails } = useEmailStatus(taskId, subtask.id)
const latestEmail = emails[0] // ordenado por sent_at DESC
const canResend = subtask.is_completed && latestEmail

// Botão de reenvio:
const [isResending, setIsResending] = useState(false)

const handleResend = async () => {
  if (!latestEmail) return
  setIsResending(true)
  try {
    const res = await fetch(
      `/api/processes/${processId}/tasks/${taskId}/resend-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_email_id: latestEmail.id }),
      }
    )
    if (!res.ok) throw new Error('Falha ao reenviar')
    toast.success('Email reenviado com sucesso!')
  } catch {
    toast.error('Erro ao reenviar email')
  } finally {
    setIsResending(false)
  }
}

// Na UI (junto ao footer do sheet):
{canResend && (
  <div className="flex items-center gap-2">
    <EmailStatusBadge status={latestEmail.last_event} />
    <Button variant="outline" size="sm" onClick={handleResend} disabled={isResending}>
      {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      Reenviar
    </Button>
  </div>
)}
```

---

### 6.3 MODIFICAR: `components/processes/task-detail-actions.tsx`

**O que mudar**: Para EMAIL tasks simples (não subtarefa), mostrar badge de status + botão reenviar quando já foi enviado.

**Onde**: Na secção de render de EMAIL tasks (perto da linha 262-286).

**Como**: Mesma lógica da 6.2 mas para task-level emails:

```typescript
const { emails } = useEmailStatus(task.id)
const latestEmail = emails[0]
const canResend = task.status === 'completed' && latestEmail

// Renderizar badge de status e botão reenviar (mesma lógica 6.2)
```

---

### 6.4 MODIFICAR: `components/processes/process-task-card.tsx` (OPCIONAL)

**O que mudar**: Para tarefas EMAIL completed, mostrar um pequeno indicador do status do email no card (ex: ícone de MailCheck verde).

**Onde**: Na secção de badges (linhas ~146-201), junto ao action type badge.

**Como**: Importar `EMAIL_STATUS_CONFIG` e usar o `task.task_result` ou um query leve. **ATENÇÃO**: Este componente renderiza muitos cards — NÃO usar o hook `useEmailStatus` aqui (seria N queries). Em vez disso, considerar passar o `last_event` como prop desde a página pai, ou skip this and only show status inside the task detail sheet.

**Recomendação**: Skip este ficheiro na implementação inicial. O status já aparece no task-form-action e no subtask-email-sheet. Adicionar aqui só se o utilizador pedir.

---

## Fase 7 — Realtime para log_emails

### 7.1 Configuração Supabase

Activar realtime na tabela `log_emails`. Executar via SQL no Supabase Dashboard:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE log_emails;
```

Sem isto, o `postgres_changes` subscription no hook `useEmailStatus` não vai funcionar.

---

## Fase 8 — Variáveis de Ambiente

### 8.1 Adicionar ao `.env.local`

```env
RESEND_API_KEY=re_xxxxxxxxx          # Para API de reenvio (server-side)
RESEND_WEBHOOK_SECRET=whsec_xxxxxxx  # Para verificar webhooks do Resend
```

A `RESEND_API_KEY` já existe na Supabase Edge Function. Para o reenvio server-side, usamos o mesmo endpoint da edge function (não chamamos a API do Resend directamente do Next.js), portanto esta chave **não é necessária no `.env.local`** se o reenvio for feito via edge function.

O `RESEND_WEBHOOK_SECRET` é **obrigatório** — vem do dashboard do Resend quando se configura o webhook.

---

## Resumo — Ficheiros por Ordem de Implementação

### CRIAR (5 ficheiros novos)

| # | Ficheiro | Fase |
|---|----------|------|
| 1 | `supabase/migrations/20260305_update_log_emails.sql` | 1 |
| 2 | `app/api/webhooks/resend/route.ts` | 3 |
| 3 | `app/api/processes/[id]/tasks/[taskId]/resend-email/route.ts` | 4 |
| 4 | `app/api/emails/route.ts` | 5 |
| 5 | `hooks/use-email-status.ts` | 5 |

### MODIFICAR (10 ficheiros existentes)

| # | Ficheiro | O que muda | Fase |
|---|----------|-----------|------|
| 1 | `types/process.ts` | Adicionar 6 activity types + interface `LogEmail` | 1 |
| 2 | `lib/validations/activity.ts` | Adicionar 6 tipos ao Zod enum | 1 |
| 3 | `lib/constants.ts` | Adicionar 6 entries no `TASK_ACTIVITY_TYPE_CONFIG` + criar `EMAIL_STATUS_CONFIG` | 1 |
| 4 | `components/processes/task-activity-timeline.tsx` | Adicionar 8 ícones Lucide ao icon map | 1 |
| 5 | `components/processes/subtask-email-sheet.tsx` | Capturar `resend_email_id` + enviar ao backend + botão reenviar | 2, 6 |
| 6 | `components/processes/task-detail-actions.tsx` | Capturar `resend_email_id` + enviar ao backend + botão reenviar | 2, 6 |
| 7 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | Aceitar `resend_email_id` + inserir `log_emails` | 2 |
| 8 | `app/api/processes/[id]/tasks/[taskId]/route.ts` | Aceitar `resend_email_id` + inserir `log_emails` para EMAIL tasks | 2 |
| 9 | `components/processes/task-form-action.tsx` | Mostrar email status badge nas subtarefas | 6 |
| 10 | `package.json` | Adicionar `svix` | 3 |

### CONFIGURAÇÃO (não código)

| # | Acção | Fase |
|---|-------|------|
| 1 | `npm install svix` | 3 |
| 2 | Adicionar `RESEND_WEBHOOK_SECRET` ao `.env.local` | 8 |
| 3 | Configurar webhook no Resend Dashboard | 8 |
| 4 | `ALTER PUBLICATION supabase_realtime ADD TABLE log_emails;` | 7 |
