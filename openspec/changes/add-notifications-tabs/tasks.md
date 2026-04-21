## 1. Classificação partilhada (`lib/notifications/types.ts`)

- [x] 1.1 Adicionar `export const PROCESS_ENTITY_TYPES = ['proc_instance','proc_task','proc_task_comment','proc_chat_message'] as const` com tipo `ProcessEntityType`.
- [x] 1.2 Adicionar `export type NotificationBucket = 'processo' | 'geral'`.
- [x] 1.3 Exportar helper puro `classifyBucket(entityType: string | null | undefined): NotificationBucket` — devolve `'processo'` se `PROCESS_ENTITY_TYPES.includes(entityType as any)`, senão `'geral'`.
- [x] 1.4 Skipped — projecto sem harness de testes unitários configurado; função é trivial (one-liner sobre `Array.includes`) e coberta pelas verificações manuais 5.2/5.3.
- [x] 1.5 **Design correction:** adicionar `'lead'` a `NotificationEntityType` e mudar o normalizer CRM (`hooks/use-notifications.ts` linha 30) para `entity_type: 'lead'` — anteriormente forçava `'proc_instance'`, o que atiraria CRM para a aba Processo (cenário já antecipado em `spec.md` "CRM notification normalised from leads_notifications").

## 2. API — `PUT /api/notifications` com escopo

- [x] 2.1 Em [app/api/notifications/route.ts](app/api/notifications/route.ts) actualizar o handler `PUT`: ler body JSON opcional; aceitar `entity_types?: string[]` e `exclude_entity_types?: string[]`.
- [x] 2.2 Validar com Zod (schema `markAllReadScopeSchema` em [lib/validations/notification.ts](lib/validations/notification.ts)): ambos opcionais, arrays não-vazios quando presentes; refine rejeita 400 se ambos forem fornecidos com mensagem `"entity_types and exclude_entity_types are mutually exclusive"`.
- [x] 2.3 Filtro aplicado: `entity_types` → `.in('entity_type', list)`; `exclude_entity_types` → `.not('entity_type','in','("a","b",...)')` com valores quotados (formato PostgREST). Sem body → comportamento actual inalterado.
- [x] 2.4 Response shape intacta (`{ success, count }`); `GET`, `unread-count` e `[id]` não tocados.

## 3. Hook `use-notifications`

- [x] 3.1 Assinatura `markAllAsRead(options?: { scope?: NotificationBucket })` com default igual ao comportamento actual.
- [x] 3.2 Scope `'processo'`: `PUT /api/notifications` com `entity_types: [...PROCESS_ENTITY_TYPES]`; sem chamada ao CRM. Optimistic update filtra por `classifyBucket === 'processo'`.
- [x] 3.3 Scope `'geral'`: `PUT /api/notifications` com `exclude_entity_types: [...PROCESS_ENTITY_TYPES]` **+** `PUT /api/crm/notifications { all: true }`. Optimistic filtra por `classifyBucket === 'geral'` (inclui `entity_type === 'lead'` dos CRM normalizados).
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
