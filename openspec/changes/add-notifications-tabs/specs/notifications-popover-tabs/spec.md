## ADDED Requirements

### Requirement: Bucket classification via entity_type

The system SHALL classify every notification into exactly one of two buckets — `processo` or `geral` — based solely on its `entity_type` field. Notifications whose `entity_type` is one of `proc_instance`, `proc_task`, `proc_task_comment`, or `proc_chat_message` MUST be classified as `processo`. All other values (including unknown, null, or undefined) MUST be classified as `geral`.

A pure helper `classifyBucket(entityType)` and the constant `PROCESS_ENTITY_TYPES` MUST live in `lib/notifications/types.ts` and be the single source of truth for this classification across UI and API callers.

#### Scenario: Comment mention on a process task

- **WHEN** a notification has `entity_type = 'proc_task_comment'` and `notification_type = 'comment_mention'`
- **THEN** `classifyBucket` returns `'processo'` and the notification appears in the Processo tab

#### Scenario: Direct message between users

- **WHEN** a notification has `entity_type = 'internal_chat_message'` and `notification_type = 'dm_message'`
- **THEN** `classifyBucket` returns `'geral'` and the notification appears in the Geral tab

#### Scenario: Unknown or future entity_type

- **WHEN** a notification has `entity_type = 'some_future_type'` not listed in `PROCESS_ENTITY_TYPES`
- **THEN** `classifyBucket` returns `'geral'` (fail-open default)

#### Scenario: CRM notification normalised from leads_notifications

- **WHEN** a notification originated from `leads_notifications` and has been normalised into the unified `Notification` shape with `entity_type = 'lead'` (or similar non-proc value)
- **THEN** it is classified as `'geral'`

### Requirement: Tabs in the notification popover

The notification popover (`components/notifications/notification-popover.tsx`) SHALL render two mutually-exclusive tabs using the shadcn `Tabs` primitive: "Processo" and "Geral". At any moment exactly one tab SHALL be active, and the notification list below the tab bar SHALL show only the notifications belonging to the active bucket, preserving the existing sort order (`created_at DESC`).

The header ("Notificações" title + "Marcar tudo como lido" button) and footer ("Ver todas as notificações" link to `/dashboard/notificacoes`) MUST remain present and unchanged.

#### Scenario: User opens the popover and switches tabs

- **WHEN** the user opens the popover with Processo active, then clicks the "Geral" tab
- **THEN** the list content replaces Processo items with Geral items, the header + footer stay visible, and the scroll position resets to top

#### Scenario: Tab text is PT-PT

- **WHEN** the popover renders
- **THEN** the tab labels read exactly "Processo" and "Geral"

### Requirement: Per-tab unread badges

Each `TabsTrigger` SHALL display a badge showing the count of unread notifications in that bucket. The badge MUST use `variant="destructive"` when count > 0 and MUST be hidden (not rendered) when count = 0. Counts > 99 MUST render as `99+`, matching the global bell badge.

Counts MUST be derived client-side from the already-fetched notification array; no additional API calls SHALL be introduced for this derivation.

#### Scenario: 3 unread in Processo, 0 unread in Geral

- **WHEN** the user's notifications include 3 unread with `entity_type = 'proc_task_comment'` and zero unread notifications outside `PROCESS_ENTITY_TYPES`
- **THEN** the Processo tab shows a destructive badge `3` and the Geral tab shows no badge

#### Scenario: 150 unread in Geral

- **WHEN** the user has 150 unread Geral notifications
- **THEN** the Geral tab badge reads `99+`

### Requirement: Default active tab on open

When the popover transitions from closed to open, the system SHALL select the default tab using this priority:

1. `processo` — if the Processo bucket has ≥ 1 unread notification
2. `geral` — else if the Geral bucket has ≥ 1 unread notification
3. `processo` — otherwise

The active tab selection SHALL NOT be persisted across popover openings.

#### Scenario: Processo has unread, Geral has unread

- **WHEN** the popover opens and both buckets have unread notifications
- **THEN** the Processo tab is active

#### Scenario: Only Geral has unread

- **WHEN** the popover opens, Processo has 0 unread, and Geral has ≥ 1 unread
- **THEN** the Geral tab is active

#### Scenario: No unread in either bucket

- **WHEN** the popover opens with zero unread notifications in total
- **THEN** the Processo tab is active

#### Scenario: User changes tab then closes and reopens

- **WHEN** the user manually switches to Geral, closes the popover, and reopens it later (unread state unchanged)
- **THEN** the default-selection rule re-applies (tab is not remembered)

### Requirement: "Mark all as read" is scoped to active tab

The "Marcar tudo como lido" button inside the popover SHALL mark as read only the notifications that belong to the currently active tab's bucket. Notifications in the non-active bucket MUST remain unchanged (unread stays unread).

The button MUST be disabled when the active tab has zero unread notifications.

After a successful mark-all, the active tab's unread badge MUST disappear and the non-active tab's badge MUST remain.

#### Scenario: Marking all read from Processo tab

- **WHEN** user has 2 Processo unread and 4 Geral unread, is on the Processo tab, and clicks "Marcar tudo como lido"
- **THEN** the two Processo notifications become read, the four Geral notifications remain unread, the Processo badge disappears, and the Geral badge still reads `4`

#### Scenario: Marking all read from Geral tab with CRM notifications

- **WHEN** user is on the Geral tab with a mix of `internal_chat_message` notifications and CRM-normalised notifications (from `leads_notifications`)
- **THEN** both the `notifications` table (excluding `PROCESS_ENTITY_TYPES`) and the `leads_notifications` table are updated so that all Geral notifications become read

#### Scenario: Button disabled when no unread in active tab

- **WHEN** the active tab has zero unread notifications
- **THEN** the "Marcar tudo como lido" button is rendered with `disabled` state

### Requirement: Scoped mark-all API contract

The endpoint `PUT /api/notifications` SHALL accept an optional body with exactly one of two mutually-exclusive fields:

- `entity_types: string[]` — limits the update to notifications whose `entity_type` is in this list
- `exclude_entity_types: string[]` — limits the update to notifications whose `entity_type` is NOT in this list

When neither field is provided, the endpoint MUST preserve existing behaviour (mark all unread for the recipient). When both fields are provided, the endpoint MUST respond `400` with an error message indicating that the fields are mutually exclusive.

The response shape MUST remain unchanged from the current implementation.

#### Scenario: Include filter for Processo tab

- **WHEN** client sends `PUT /api/notifications` with body `{ "entity_types": ["proc_instance","proc_task","proc_task_comment","proc_chat_message"] }`
- **THEN** the server updates only the recipient's unread rows whose `entity_type` is in that array and returns success

#### Scenario: Exclude filter for Geral tab

- **WHEN** client sends `PUT /api/notifications` with body `{ "exclude_entity_types": ["proc_instance","proc_task","proc_task_comment","proc_chat_message"] }`
- **THEN** the server updates only the recipient's unread rows whose `entity_type` is NOT in that array and returns success

#### Scenario: No body (legacy behaviour)

- **WHEN** client sends `PUT /api/notifications` with no body or empty body
- **THEN** the server marks all of the recipient's unread rows as read (unchanged from before)

#### Scenario: Both filters provided

- **WHEN** client sends `PUT /api/notifications` with both `entity_types` and `exclude_entity_types` non-empty
- **THEN** the server responds with status `400` and an error describing the conflict, and performs no update

### Requirement: Empty states per tab

When the active tab has zero notifications in its bucket, the popover SHALL render a PT-PT empty state inside the list area — not the header or tabs. The copy MUST be:

- Processo tab empty: "Sem notificações de processo"
- Geral tab empty: "Sem notificações gerais"

The existing global empty state ("Nenhuma notificação" or equivalent) SHALL no longer be shown once tabs are introduced.

#### Scenario: Processo bucket is empty

- **WHEN** the user has no notifications with `entity_type` in `PROCESS_ENTITY_TYPES` and the Processo tab is active
- **THEN** the list area shows "Sem notificações de processo"

#### Scenario: Geral bucket is empty

- **WHEN** the user has no notifications outside `PROCESS_ENTITY_TYPES` and the Geral tab is active
- **THEN** the list area shows "Sem notificações gerais"

### Requirement: No regression in global unread count or realtime

The global bell-icon badge SHALL continue to display the **total** unread count (sum of both buckets), not per-tab. The realtime subscriptions in `hooks/use-notifications.ts` (Supabase channels on `notifications` and `leads_notifications`) MUST NOT be modified by this change; new events MUST flow into whichever bucket they classify into without additional wiring.

#### Scenario: Realtime insert into Processo bucket while Geral is active

- **WHEN** a new notification with `entity_type = 'proc_task_comment'` arrives via realtime while the user has the Geral tab active
- **THEN** the Processo tab badge increments, the Geral view is unchanged, and the global bell badge also increments
