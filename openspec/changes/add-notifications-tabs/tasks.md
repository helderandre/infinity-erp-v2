## 1. Classificação partilhada (`lib/notifications/types.ts`)

- [x] 1.1 ~~`PROCESS_ENTITY_TYPES`~~ → **substituído** por `export const PROCESS_NOTIFICATION_TYPES = ['comment_mention','chat_mention','chat_message','task_comment'] as const` com tipo `ProcessNotificationType`. (Ver 1.6.)
- [x] 1.2 `export type NotificationBucket = 'processo' | 'geral'`.
- [x] 1.3 Helper `classifyBucket(notificationType: string | null | undefined): NotificationBucket` — devolve `'processo'` sse `notification_type` ∈ `PROCESS_NOTIFICATION_TYPES`, senão `'geral'`. (Ver 1.6.)
- [x] 1.4 Skipped — projecto sem harness de testes unitários configurado; função é trivial e coberta pelas verificações manuais.
- [x] 1.5 Normalizer CRM em `hooks/use-notifications.ts` passou a usar `entity_type: 'lead'` (aditivo; não participa na classificação após 1.6 mas fica semanticamente mais honesto que `'proc_instance'`).
- [x] 1.6 **Correcção pós-UAT:** inverter a classificação — `entity_type` (`proc_*`) é demasiado abrangente; `calendar_reminder` usa `entity_type: 'proc_instance'` em [app/api/cron/calendar-reminders/route.ts:180](app/api/cron/calendar-reminders/route.ts#L180), `task_assigned` usa `'proc_task'`, alertas `alert_on_*` idem — todos estes caíam incorrectamente em Processo. Solução: classificar por `notification_type` com lista estreita `['comment_mention','chat_mention','chat_message','task_comment']`. Refactorado `lib/notifications/types.ts`, `app/api/notifications/route.ts` (chaves `notification_types`/`exclude_notification_types`), `lib/validations/notification.ts`, `hooks/use-notifications.ts` e `components/notifications/notification-popover.tsx`. Spec + design actualizados.

## 2. API — `PUT /api/notifications` com escopo

- [x] 2.1 `PUT /api/notifications` aceita body JSON opcional com `notification_types?: string[]` / `exclude_notification_types?: string[]` (chaves renomeadas em 1.6).
- [x] 2.2 Zod schema `markAllReadScopeSchema` com refine 400 para conflito — mensagem `"notification_types and exclude_notification_types are mutually exclusive"`.
- [x] 2.3 Filtro aplicado em `notification_type` (não `entity_type`): `notification_types` → `.in('notification_type', list)`; `exclude_notification_types` → `.not('notification_type','in','("a","b",...)')`. Sem body → inalterado.
- [x] 2.4 Response shape intacta (`{ success, count }`); `GET`, `unread-count` e `[id]` não tocados.

## 3. Hook `use-notifications`

- [x] 3.1 Assinatura `markAllAsRead(options?: { scope?: NotificationBucket })` com default igual ao comportamento actual.
- [x] 3.2 Scope `'processo'`: `PUT /api/notifications` com `notification_types: [...PROCESS_NOTIFICATION_TYPES]`; sem chamada ao CRM. Optimistic: `classifyBucket(n.notification_type) === 'processo'`.
- [x] 3.3 Scope `'geral'`: `PUT /api/notifications` com `exclude_notification_types: [...PROCESS_NOTIFICATION_TYPES]` **+** `PUT /api/crm/notifications { all: true }`. Optimistic: `classifyBucket(n.notification_type) === 'geral'`.
- [x] 3.4 Sem scope: duas chamadas como antes (sem body + CRM `{ all: true }`).
- [x] 3.5 Snapshot `{id, read_at}` capturado apenas das entries tocadas; em `catch`, revertidas individualmente e `unreadCount` recomposto.

## 4. Popover — UI com abas

- [x] 4.1 Imports adicionados (`Tabs*` de `@/components/ui/tabs`, `Badge` de `@/components/ui/badge`, `classifyBucket` + `NotificationBucket` de `@/lib/notifications/types`).
- [x] 4.2 `useState<NotificationBucket>('processo')` + `<Tabs value={activeTab} onValueChange={...}>`.
- [x] 4.3 Um único `useMemo` sobre `notifications` devolve `{ processNotifications, generalNotifications, processUnread, generalUnread }` (evita 4 filters sobre o mesmo array).
- [x] 4.4 `TabsList` com `TabsTrigger value="processo"|"geral"`; `Badge variant="destructive"` só renderiza quando count > 0; `99+` via helper `formatBadge`.
- [x] 4.5 Listas dentro de `TabsContent`; wrapper com `max-height: min(50vh, 420px)` preservado; `NotificationItem` inalterado.
- [x] 4.6 Empty states PT-PT por aba ("Sem notificações de processo" / "Sem notificações gerais"); o empty state global anterior foi removido.
- [x] 4.7 Botão "Marcar tudo como lido" agora chama `markAllAsRead({ scope: activeTab })` e `disabled` segue `activeUnread === 0`. Removida a condicional `unreadCount > 0` que antes ocultava o botão.
- [x] 4.8 `Popover` passa a ser controlado (`open`/`onOpenChange`); `useEffect([open])` recalcula default quando passa a `true` com regra `processo > geral > processo`.
- [x] 4.9 Título "Notificações" + badge global + footer "Ver todas as notificações" intactos.

## 5. Verificação

- [ ] 5.1 `npm run dev` — abrir o popover com a conta de teste. Confirmar duas abas, labels PT-PT, badges por aba, lista filtrada. **(manual — aguarda utilizador)**
- [ ] 5.2 Disparar um `comment_mention` numa tarefa de processo (criar comentário com `@username` em `/dashboard/processos/[id]`). Confirmar que cai na aba **Processo**, badge Processo incrementa, badge global do sino incrementa. **(manual)**
- [ ] 5.3 Enviar uma DM ou criar notificação `internal_chat_message`. Confirmar que cai em **Geral** e **não** aparece em Processo. **(manual)**
- [ ] 5.4 Com não-lidas em ambas as abas: clicar "Marcar tudo como lido" na aba Processo → só Processo fica zerado; badge Geral permanece. Clicar "Marcar tudo como lido" na aba Geral → Geral fica zerado e CRM normalisado também fica marcado como lido. **(manual)**
- [ ] 5.5 Fechar e reabrir o popover com só Geral a ter não-lidas → aba activa abre em Geral (default dinâmico). **(manual)**
- [ ] 5.6 Verificar que a página `/dashboard/notificacoes` continua inalterada e funcional (smoke-test: abrir, confirmar lista + filtros `all/unread` + dropdown de tipos). **(manual)**
- [x] 5.7 `npx tsc --noEmit` — nenhum erro novo nos ficheiros tocados. Único erro remanescente (`app/api/notifications/route.ts` na linha do `.update(...)` com `Argument ... not assignable to 'never'`) é **pré-existente** na mesma chamada (verificado via `git stash`); é uma fricção generalizada de tipos Supabase no repo, não introduzida por este change.
