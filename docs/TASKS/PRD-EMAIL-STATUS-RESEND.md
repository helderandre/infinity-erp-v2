# PRD — Email Status Tracking via Resend + Reenvio de Emails

**Data**: 2026-03-05
**Branch**: master
**Escopo**: Tracking de status real de emails enviados via Resend (webhooks) + funcionalidade de reenvio

---

## 1. Resumo do Problema

Actualmente, quando um email é enviado a partir de uma tarefa de processo:
- O sistema marca a subtarefa como "concluída" mas **não rastreia** se o email foi entregue, aberto, clicado ou falhou
- Não existe forma de **reenviar** um email que falhou ou precisa ser reenviado
- O `log_emails` table existe no schema mas **nunca é populada**
- O `resend_id` retornado pela API do Resend é **descartado** (não guardado)

---

## 2. Objectivos

1. **Rastrear status real** de cada email enviado (sent → delivered → opened → clicked / bounced / failed)
2. **Reenviar emails** directamente da UI do card de email na tarefa
3. **Registar tudo** no sistema de actividades (`proc_task_activities`) e no `log_emails`
4. **Mostrar status visual** no card de email (badge com ícone/cor por estado)

---

## 3. Arquivos da Base de Código Relevantes

### 3.1 Envio de Email (Backend)

| Arquivo | Papel | O que muda |
|---------|-------|------------|
| [`supabase/functions/send-email/index.ts`](supabase/functions/send-email/index.ts) | Edge Function que envia via Resend API | Retornar `resend_id`; já retorna `id` — OK |
| [`app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`](app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts) | PUT — marca subtarefa completa + loga actividade | Guardar `resend_email_id` no `log_emails` + metadata |
| [`app/api/processes/[id]/tasks/[taskId]/route.ts`](app/api/processes/[id]/tasks/[taskId]/route.ts) | PUT — acções sobre tarefa (complete, start, etc.) | Para EMAIL tasks simples, guardar log_emails |

### 3.2 Envio de Email (Frontend)

| Arquivo | Papel | O que muda |
|---------|-------|------------|
| [`components/processes/subtask-email-sheet.tsx`](components/processes/subtask-email-sheet.tsx) | Editor visual Craft.js + envio de email (subtarefas) | Guardar `resend_id` da response; adicionar botão "Reenviar" |
| [`components/processes/task-detail-actions.tsx`](components/processes/task-detail-actions.tsx) | Acções de tarefa EMAIL simples | Guardar `resend_id`; adicionar "Reenviar" |
| [`components/processes/task-form-action.tsx`](components/processes/task-form-action.tsx) | Lista de subtarefas com badges | Mostrar badge de status do email (delivered/opened/etc.) |
| [`components/processes/process-task-card.tsx`](components/processes/process-task-card.tsx) | Card de tarefa na lista/kanban | Mostrar indicador de status email |

### 3.3 Webhook Handler (NOVO)

| Arquivo | Papel | Status |
|---------|-------|--------|
| `app/api/webhooks/resend/route.ts` | **NOVO** — Recebe webhooks do Resend | Criar |

### 3.4 Sistema de Actividades (já existe)

| Arquivo | Papel | O que muda |
|---------|-------|------------|
| [`lib/processes/activity-logger.ts`](lib/processes/activity-logger.ts) | `logTaskActivity()` utility | Adicionar tipos: `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_failed` |
| [`lib/validations/activity.ts`](lib/validations/activity.ts) | Zod schema dos activity types | Adicionar novos tipos de email |
| [`lib/constants.ts`](lib/constants.ts) | `TASK_ACTIVITY_TYPE_CONFIG` — ícones/cores | Adicionar configs para novos tipos |
| [`types/process.ts`](types/process.ts) | `TaskActivityType` union type | Adicionar novos tipos |
| [`hooks/use-task-activities.ts`](hooks/use-task-activities.ts) | Hook com realtime subscription | Já funciona — auto-updates via postgres_changes |
| [`components/processes/task-activity-timeline.tsx`](components/processes/task-activity-timeline.tsx) | Timeline visual | Já funciona — usa TASK_ACTIVITY_TYPE_CONFIG |

### 3.5 Reenvio de Email (NOVO)

| Arquivo | Papel | Status |
|---------|-------|--------|
| `app/api/processes/[id]/tasks/[taskId]/resend-email/route.ts` | **NOVO** — API de reenvio | Criar |

### 3.6 Database

| Tabela | Papel | O que muda |
|--------|-------|------------|
| `log_emails` | Registo de emails enviados | **Popular activamente** + adicionar campos |
| `proc_task_activities` | Actividades da tarefa | Adicionar novos tipos de actividade |
| `proc_subtasks` | Config de subtarefa | Guardar `resend_email_id` no `config.rendered` |

---

## 4. Documentação Resend — Trechos Relevantes

### 4.1 Webhooks — Event Types Disponíveis

```
email.sent        → API request successful, Resend will attempt delivery
email.delivered   → Successfully delivered to recipient's mail server
email.opened      → Recipient opened the email
email.clicked     → Recipient clicked a link
email.bounced     → Permanently rejected by recipient's mail server
email.complained  → Marked as spam
email.failed      → Failed to send due to error
email.delivery_delayed → Temporary delivery issue
```

### 4.2 Webhook Payload Structure

```json
{
  "type": "email.delivered",
  "created_at": "2023-02-22T23:41:12.126Z",
  "data": {
    "created_at": "2023-02-22T23:41:11.894719+00:00",
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "from": "Acme <onboarding@resend.dev>",
    "to": ["user@example.com"],
    "subject": "Hello World"
  }
}
```

**Payloads especiais:**

```json
// email.bounced
"data": {
  ...campos comuns,
  "bounce": {
    "message": "The recipient's inbox is full",
    "type": "Permanent",
    "subType": "General"
  }
}

// email.clicked
"data": {
  ...campos comuns,
  "click": {
    "ipAddress": "203.0.113.1",
    "link": "https://example.com/verify",
    "timestamp": "2023-02-22T23:45:00.000Z",
    "userAgent": "Mozilla/5.0 ..."
  }
}
```

### 4.3 Verificação de Webhook (Svix)

Headers obrigatórios em cada webhook:
- `svix-id` — ID único (usar para deduplicação)
- `svix-timestamp` — Timestamp
- `svix-signature` — HMAC-SHA256

```typescript
import { Webhook } from 'svix'

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!)
const payload = await req.text() // DEVE ser raw body, NÃO parsed JSON
const event = wh.verify(payload, {
  'svix-id': req.headers.get('svix-id')!,
  'svix-timestamp': req.headers.get('svix-timestamp')!,
  'svix-signature': req.headers.get('svix-signature')!,
})
```

**Importante**: Usar `await req.text()` e NÃO `await req.json()` — parsing quebra a assinatura.

### 4.4 Retrieve Email Status (Polling alternativo)

```
GET https://api.resend.com/emails/{email_id}
Authorization: Bearer re_xxxxxxxxx
```

Response:
```json
{
  "id": "49a3999c-...",
  "to": ["james@bond.com"],
  "from": "Acme <onboarding@resend.dev>",
  "subject": "Hello World",
  "last_event": "delivered",
  "created_at": "2023-04-03T22:13:42.674981+00:00"
}
```

O campo `last_event` reflecte o evento mais recente: `sent | delivered | bounced | opened | clicked | complained | delivery_delayed`.

### 4.5 Reenvio de Email — Padrão

O Resend **NÃO tem endpoint nativo de retry**. O padrão é enviar um novo email com o mesmo conteúdo:

```typescript
// 1. Buscar conteúdo original (do log_emails ou proc_subtasks.config.rendered)
// 2. Enviar novo email via POST /emails
// 3. Guardar novo resend_id no log_emails
```

### 4.6 Dependências Necessárias

```bash
npm install resend svix
```

O package `resend` **não está instalado** no projecto (o envio actual usa fetch directo para a API).
O package `svix` é necessário para verificar webhooks.

---

## 5. Padrões de Implementação do Codebase

### 5.1 Activity Logger — Padrão Existente

```typescript
// lib/processes/activity-logger.ts
export async function logTaskActivity(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  activityType: TaskActivityType,
  description: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from('proc_task_activities').insert({
    proc_task_id: taskId,
    user_id: userId,
    activity_type: activityType,
    description,
    metadata: metadata ?? {},
  })
  if (error) console.error('[activity-logger]', error)
}
```

### 5.2 Activity Type Config — Padrão Existente

```typescript
// lib/constants.ts
export const TASK_ACTIVITY_TYPE_CONFIG: Record<string, {
  icon: string; label: string; color: string
}> = {
  email_sent: { icon: 'Mail', label: 'Email enviado', color: 'text-sky-500' },
  completed:  { icon: 'CheckCircle2', label: 'Concluída', color: 'text-emerald-500' },
  // ... etc
}
```

### 5.3 Realtime Activities — Já Funciona

```typescript
// hooks/use-task-activities.ts
// Subscreve via postgres_changes INSERT em proc_task_activities
// Qualquer INSERT novo no DB → refetch automático → UI actualiza
```

### 5.4 Notificações — Padrão Existente

```typescript
// lib/notifications/service.ts
await notificationService.create({
  recipientId: assignedUserId,
  senderId: currentUserId,
  notificationType: 'task_updated',
  entityType: 'proc_task',
  entityId: taskId,
  title: 'Email rejeitado',
  body: 'O email para owner@example.com foi rejeitado (bounced)',
  actionUrl: `/dashboard/processos/${processId}?task=${taskId}`,
})
```

### 5.5 Envio Actual de Email (Edge Function)

```typescript
// supabase/functions/send-email/index.ts
// POST https://api.resend.com/emails
// Retorna: { success: true, id: "resend-email-id" }
```

A edge function **já retorna o `id` do Resend** — só precisamos guardá-lo.

### 5.6 Subtask Email Sheet — Fluxo de Envio Actual

```typescript
// components/processes/subtask-email-sheet.tsx — handleConfirmSend()
const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
  method: 'POST',
  body: JSON.stringify({ senderName, senderEmail, recipientEmail, cc, subject, body, attachments })
})
const data = await res.json()
// data.id === resend email ID — MAS NÃO É GUARDADO!

// Depois marca subtarefa como completa
await fetch(`/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`, {
  method: 'PUT',
  body: JSON.stringify({ rendered_content: {...}, is_completed: true })
})
```

### 5.7 Subtask API — Actividade Logada

```typescript
// app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts
// Quando is_completed = true e config.type === 'email':
await logTaskActivity(supabase, taskId, user.id, 'email_sent',
  `${userName} enviou email: ${subtask.title}`,
  { subtask_id: subtask.id, owner_id: subtask.owner_id }
)
```

---

## 6. Arquitectura Proposta

### 6.1 Fluxo de Envio (Melhorado)

```
1. User clica "Enviar Email" na SubtaskEmailSheet
   ↓
2. POST /functions/v1/send-email → Resend API
   ↓ retorna resend_email_id
3. PUT /api/processes/{id}/tasks/{taskId}/subtasks/{subtaskId}
   body: { rendered_content, is_completed: true, resend_email_id }
   ↓
4. Backend:
   a) Actualiza proc_subtasks (config.rendered + resend_email_id)
   b) INSERT log_emails (proc_task_id, subtask_id, resend_email_id, status='sent', ...)
   c) logTaskActivity('email_sent', metadata: { resend_email_id, recipient, subject })
   d) Recalcula progresso da tarefa pai
```

### 6.2 Fluxo de Webhook (NOVO)

```
Resend → POST /api/webhooks/resend
  ↓
1. Verificar assinatura (svix)
2. Extrair email_id do payload
3. Buscar log_emails WHERE provider_id = email_id
4. Actualizar log_emails.delivery_status
5. Se task encontrada:
   a) logTaskActivity('email_delivered' | 'email_opened' | etc.)
   b) Se bounced/failed → notificar assigned user
```

### 6.3 Fluxo de Reenvio (NOVO)

```
1. User clica "Reenviar" no card de email
   ↓
2. POST /api/processes/{id}/tasks/{taskId}/resend-email
   body: { subtask_id?, log_email_id }
   ↓
3. Backend:
   a) Buscar conteúdo original (log_emails ou subtask.config.rendered)
   b) POST /functions/v1/send-email → novo resend_email_id
   c) INSERT novo log_emails (com referência ao original: parent_email_id)
   d) logTaskActivity('email_sent', metadata: { resend: true, original_id })
   e) Se subtask estava completed por falha → manter completed (o reenvio é tracking separado)
```

### 6.4 UI — Email Status Card

```
┌─────────────────────────────────────────────────────┐
│ ✉ Pedido de Documentação                           │
│                                                     │
│ 👤 Abel André da Silva    📧 abel@email.com        │
│                                                     │
│ Status: ✅ Entregue  |  👁 Aberto (2x)  |  🔗 1   │
│                                                     │
│ Enviado: 05/03/2026 14:30                           │
│                                                     │
│ [👁 Ver]  [↻ Reenviar]                             │
└─────────────────────────────────────────────────────┘
```

---

## 7. Migração de Base de Dados Necessária

### 7.1 Alterações ao `log_emails`

```sql
-- A tabela log_emails JÁ EXISTE mas precisa de campos adicionais:
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

-- Índice para webhook lookup por resend_email_id
CREATE INDEX IF NOT EXISTS idx_log_emails_resend_id ON log_emails(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_task ON log_emails(proc_task_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_subtask ON log_emails(proc_subtask_id);
```

### 7.2 Novos Activity Types

Não precisa migração — os activity types são text livre no DB. Só actualizar:
- `lib/validations/activity.ts` (Zod enum)
- `types/process.ts` (TypeScript union)
- `lib/constants.ts` (icons/colors config)

---

## 8. Variáveis de Ambiente Necessárias

```env
# Já existe (na Supabase Edge Function)
RESEND_API_KEY=re_xxxxxxxxx

# NOVOS — adicionar ao .env.local do Next.js
RESEND_API_KEY=re_xxxxxxxxx          # Para API de reenvio (server-side)
RESEND_WEBHOOK_SECRET=whsec_xxxxxxx  # Para verificar webhooks
```

---

## 9. Dependências a Instalar

```bash
npm install svix
# 'resend' é opcional — podemos usar fetch directo como já fazemos
# mas svix é necessário para verificar webhooks
```

---

## 10. Mapeamento de Status → UI

| Resend Event | Status no DB | Badge PT-PT | Ícone | Cor |
|---|---|---|---|---|
| `email.sent` | `sent` | Enviado | `Mail` | `text-sky-500` |
| `email.delivered` | `delivered` | Entregue | `MailCheck` | `text-emerald-500` |
| `email.opened` | `opened` | Aberto | `MailOpen` | `text-violet-500` |
| `email.clicked` | `clicked` | Clicado | `MousePointerClick` | `text-indigo-500` |
| `email.bounced` | `bounced` | Rejeitado | `MailX` | `text-red-500` |
| `email.complained` | `complained` | Spam | `ShieldAlert` | `text-red-500` |
| `email.failed` | `failed` | Falhou | `AlertCircle` | `text-red-500` |
| `email.delivery_delayed` | `delayed` | Atrasado | `Clock` | `text-amber-500` |

---

## 11. Novos Activity Types para o Timeline

| Activity Type | Label PT-PT | Ícone | Cor | Descrição |
|---|---|---|---|---|
| `email_sent` | Email enviado | `Mail` | `text-sky-500` | **Já existe** |
| `email_delivered` | Email entregue | `MailCheck` | `text-emerald-500` | **NOVO** |
| `email_opened` | Email aberto | `MailOpen` | `text-violet-500` | **NOVO** |
| `email_clicked` | Link clicado | `MousePointerClick` | `text-indigo-500` | **NOVO** |
| `email_bounced` | Email rejeitado | `MailX` | `text-red-500` | **NOVO** |
| `email_failed` | Erro no envio | `AlertCircle` | `text-red-500` | **NOVO** |
| `email_resent` | Email reenviado | `MailPlus` | `text-sky-500` | **NOVO** |

---

## 12. Code Snippets — Implementação

### 12.1 Webhook Handler (Next.js App Router)

```typescript
// app/api/webhooks/resend/route.ts
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
  const payload = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
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
  }).eq('id', logEmail.id)

  // 3. Logar actividade na tarefa (se tarefa encontrada)
  if (logEmail.proc_task_id) {
    const activityMap: Record<string, string> = {
      delivered: 'email_delivered',
      opened: 'email_opened',
      clicked: 'email_clicked',
      bounced: 'email_bounced',
      failed: 'email_failed',
      complained: 'email_bounced',
    }
    const activityType = activityMap[eventType]
    if (activityType) {
      await supabase.from('proc_task_activities').insert({
        proc_task_id: logEmail.proc_task_id,
        user_id: null, // sistema
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

### 12.2 Resend Email API Route

```typescript
// app/api/processes/[id]/tasks/[taskId]/resend-email/route.ts
export async function POST(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id: processId, taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { log_email_id } = body

  // 1. Buscar email original
  const { data: original } = await supabase
    .from('log_emails')
    .select('*')
    .eq('id', log_email_id)
    .single()

  if (!original) return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 })

  // 2. Reenviar via edge function
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderName: original.sender_name,
      senderEmail: original.sender_email,
      recipientEmail: original.recipient_email,
      cc: original.cc,
      subject: original.subject,
      body: original.body_html,
    }),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: 'Falha ao reenviar' }, { status: 502 })

  // 3. Criar novo log_emails com referência ao original
  await supabase.from('log_emails').insert({
    proc_task_id: original.proc_task_id,
    proc_subtask_id: original.proc_subtask_id,
    resend_email_id: data.id,
    recipient_email: original.recipient_email,
    sender_email: original.sender_email,
    sender_name: original.sender_name,
    cc: original.cc,
    subject: original.subject,
    body_html: original.body_html,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    last_event: 'sent',
    parent_email_id: original.id,
    metadata: { resent_by: user.id, original_email_id: original.id },
  })

  // 4. Logar actividade
  const { data: userData } = await supabase
    .from('dev_users')
    .select('commercial_name')
    .eq('id', user.id)
    .single()

  await logTaskActivity(supabase, taskId, user.id, 'email_resent',
    `${userData?.commercial_name || 'Utilizador'} reenviou email para ${original.recipient_email}`,
    { resend_email_id: data.id, original_log_email_id: original.id }
  )

  return NextResponse.json({ success: true, id: data.id })
}
```

### 12.3 Hook para Email Status (NOVO)

```typescript
// hooks/use-email-status.ts
export function useEmailStatus(taskId: string | null, subtaskId?: string | null) {
  const [emails, setEmails] = useState<LogEmail[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchEmails = useCallback(async () => {
    if (!taskId) return
    const params = new URLSearchParams({ task_id: taskId })
    if (subtaskId) params.set('subtask_id', subtaskId)
    const res = await fetch(`/api/emails?${params}`)
    const data = await res.json()
    setEmails(data)
  }, [taskId, subtaskId])

  useEffect(() => {
    fetchEmails()
    // Realtime via postgres_changes em log_emails
    const supabase = createClient()
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

### 12.4 Email Status Badge Component (NOVO)

```typescript
// Dentro de task-form-action.tsx ou novo componente
function EmailStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: string; icon: React.ReactNode }> = {
    sent:      { label: 'Enviado',   variant: 'secondary', icon: <Mail className="h-3 w-3" /> },
    delivered: { label: 'Entregue',  variant: 'success',   icon: <MailCheck className="h-3 w-3" /> },
    opened:    { label: 'Aberto',    variant: 'default',   icon: <MailOpen className="h-3 w-3" /> },
    clicked:   { label: 'Clicado',   variant: 'default',   icon: <MousePointerClick className="h-3 w-3" /> },
    bounced:   { label: 'Rejeitado', variant: 'destructive', icon: <MailX className="h-3 w-3" /> },
    failed:    { label: 'Falhou',    variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
    delayed:   { label: 'Atrasado',  variant: 'warning',   icon: <Clock className="h-3 w-3" /> },
  }
  const c = config[status] || config.sent
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon} {c.label}
    </Badge>
  )
}
```

---

## 13. Resumo de Ficheiros a Criar/Modificar

### Criar (NOVOS)
1. `app/api/webhooks/resend/route.ts` — Webhook handler
2. `app/api/processes/[id]/tasks/[taskId]/resend-email/route.ts` — API reenvio
3. `app/api/emails/route.ts` — GET emails por task/subtask (para o hook)
4. `hooks/use-email-status.ts` — Hook com realtime
5. `supabase/migrations/XXXXXX_update_log_emails.sql` — Migração DB

### Modificar (EXISTENTES)
1. `components/processes/subtask-email-sheet.tsx` — Guardar resend_id + botão reenviar
2. `components/processes/task-detail-actions.tsx` — Guardar resend_id + botão reenviar
3. `components/processes/task-form-action.tsx` — Mostrar email status badge
4. `components/processes/process-task-card.tsx` — Indicador status email (opcional)
5. `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` — Inserir log_emails
6. `app/api/processes/[id]/tasks/[taskId]/route.ts` — Inserir log_emails (EMAIL tasks simples)
7. `lib/processes/activity-logger.ts` — Novos activity types
8. `lib/validations/activity.ts` — Novos tipos no Zod enum
9. `lib/constants.ts` — TASK_ACTIVITY_TYPE_CONFIG novos tipos + EMAIL_STATUS_CONFIG
10. `types/process.ts` — TaskActivityType + LogEmail type
11. `package.json` — Adicionar `svix`

---

## 14. Fontes e Referências

- [Resend Webhooks Introduction](https://resend.com/docs/webhooks/introduction)
- [Resend Webhook Event Types](https://resend.com/docs/dashboard/webhooks/event-types)
- [Resend Verify Webhook Requests](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests)
- [Resend Retrieve Email API](https://resend.com/docs/api-reference/emails/retrieve-email)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [Svix Next.js Guide](https://www.svix.com/guides/receiving/receive-webhooks-with-javascript-nextjs/)
