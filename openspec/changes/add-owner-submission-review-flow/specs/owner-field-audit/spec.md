## ADDED Requirements

### Requirement: Tabela `owner_field_audit` regista alterações em colunas-whitelist

O sistema SHALL manter uma tabela `public.owner_field_audit` com o esquema:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `owner_id` | uuid NOT NULL | FK `owners(id) ON DELETE CASCADE` |
| `field_name` | text NOT NULL | uma das 6 colunas-whitelist |
| `old_value` | text | NULL se a coluna estava vazia antes |
| `new_value` | text | NULL se o owner limpou a coluna |
| `edited_by_auth_user_id` | uuid | NULL quando service role sem JWT |
| `edited_via` | text NOT NULL DEFAULT 'unknown' | tipicamente `'owner_app'` ou `'erp'` |
| `subtask_id` | uuid | NULL quando não há contexto de subtask |
| `proc_task_id` | uuid | NULL quando não resolúvel (denormalizado para queries) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

A tabela MUST ter os seguintes índices:
- `idx_owner_field_audit_owner_created ON (owner_id, created_at DESC)` — listagem cronológica por owner.
- `idx_owner_field_audit_subtask_field_created ON (subtask_id, field_name, created_at DESC)` — usado para o rate-limit da notificação.

A whitelist de `field_name` SHALL ser exactamente:
- `naturality`
- `address`
- `marital_status`
- `legal_rep_naturality`
- `legal_rep_address`
- `legal_rep_marital_status`

#### Scenario: Schema bate com a especificação

- **WHEN** a migration `20260522_owner_submission_review_flow.sql` é aplicada
- **THEN** existe a tabela `public.owner_field_audit` com as 10 colunas listadas
- **AND** ambos os índices existem
- **AND** a FK `owner_id` tem `ON DELETE CASCADE`

#### Scenario: Eliminar owner remove audit trail

- **WHEN** um `owners` row é DELETEd
- **THEN** todas as rows correspondentes em `owner_field_audit` são removidas (CASCADE)

---

### Requirement: Trigger captura UPDATEs em colunas-whitelist e cria audit row

O sistema SHALL ter um trigger `trg_owners_field_audit` em `owners` que dispara `AFTER UPDATE OF naturality, address, marital_status, legal_rep_naturality, legal_rep_address, legal_rep_marital_status FOR EACH ROW`.

A função `audit_owner_field_change()` (SECURITY DEFINER, owner postgres) MUST:

1. Para cada uma das 6 colunas-whitelist, verificar `OLD.<col> IS DISTINCT FROM NEW.<col>`.
2. Para cada coluna alterada, INSERTar uma row em `owner_field_audit` com:
   - `owner_id = NEW.id`
   - `field_name = '<col>'`
   - `old_value = OLD.<col>`
   - `new_value = NEW.<col>`
   - `edited_by_auth_user_id = auth.uid()` (NULL se sem JWT)
   - `edited_via = COALESCE(current_setting('app.edited_via', true), 'unknown')`
   - `subtask_id = NULLIF(current_setting('app.current_subtask_id', true), '')::uuid` (NULL se setting não definido ou vazio)
   - `proc_task_id` resolvido via lookup `SELECT proc_task_id FROM proc_subtasks WHERE id = <subtask_id>` (NULL se subtask_id é NULL ou subtask não existe)

3. Se `subtask_id` está definido E o lookup encontrou `proc_task_id`, INSERTar adicionalmente uma row em `proc_task_activities` com `activity_type='owner_field_edited'`, `metadata.field_name`, `metadata.owner_id`.

A função MUST ser tolerante a `auth.uid()=NULL` e `current_setting=NULL` — nunca deve lançar exceção que reverta o UPDATE em `owners`.

#### Scenario: UPDATE de coluna whitelist gera 1 audit row

- **WHEN** um UPDATE altera `owners.address` de `'Rua A'` para `'Rua B'`
- **THEN** uma row é criada em `owner_field_audit` com `field_name='address'`, `old_value='Rua A'`, `new_value='Rua B'`

#### Scenario: UPDATE de múltiplas colunas whitelist gera múltiplas audit rows

- **WHEN** um único UPDATE altera simultaneamente `naturality` e `marital_status`
- **THEN** duas rows são criadas em `owner_field_audit` (uma por coluna)
- **AND** ambas têm o mesmo `created_at` aproximado

#### Scenario: UPDATE de coluna não-whitelist não dispara trigger

- **WHEN** um UPDATE altera apenas `owners.email` (fora da whitelist)
- **THEN** nenhuma row é criada em `owner_field_audit`
- **AND** nenhuma activity é criada

#### Scenario: UPDATE com OLD = NEW não cria audit

- **WHEN** um UPDATE define `address = 'Rua A'` mas a coluna já era `'Rua A'`
- **THEN** `OLD.address IS DISTINCT FROM NEW.address` é falso
- **AND** nenhuma row é criada em `owner_field_audit`

#### Scenario: App cliente passa subtask_id via session setting

- **WHEN** o app cliente executa `SET LOCAL app.current_subtask_id = '<uuid>'` antes do UPDATE
- **THEN** a audit row tem `subtask_id=<uuid>`
- **AND** se `<uuid>` corresponde a uma `proc_subtasks` válida, `proc_task_id` é populado via lookup
- **AND** uma activity `owner_field_edited` é criada na `proc_task_activities` para esse `proc_task_id`

#### Scenario: Sem session setting, audit funciona sem subtask_id

- **WHEN** o UPDATE corre sem `app.current_subtask_id` definido (ou definido como string vazia)
- **THEN** a audit row é criada na mesma com `subtask_id=NULL` e `proc_task_id=NULL`
- **AND** nenhuma activity em `proc_task_activities` é criada

#### Scenario: auth.uid() é NULL (service role sem JWT)

- **WHEN** o UPDATE corre via service role sem JWT (caso ERP)
- **THEN** a audit row tem `edited_by_auth_user_id=NULL`
- **AND** o trigger não falha

---

### Requirement: Notificação ao consultor por edição de campo, com rate-limit de 5min por (subtask_id, field_name)

Quando o trigger `trg_owners_field_audit` cria uma audit row com `proc_task_id` resolvido, o sistema SHALL criar uma notificação `'owner_field_edited'` para o `assigned_to` da `proc_task`, COM rate-limit:

A notificação SHALL ser criada apenas se NÃO existir uma notificação `owner_field_edited` para o mesmo `(entity_id=proc_task_id, metadata.field_name, metadata.subtask_id)` nos últimos 5 minutos.

Quando `subtask_id` está NULL (app cliente sem session setting), o rate-limit MUST aplicar-se por `(entity_id=proc_task_id, metadata.field_name, metadata.owner_id)` em vez disso.

A notificação MUST conter:
- `notification_type='owner_field_edited'`
- `entity_type='proc_task'`
- `entity_id=<proc_task_id>`
- `recipient_id=<proc_tasks.assigned_to>`
- `title`: `<commercial_name do owner> editou <field_label PT>`
- `action_url`: `/dashboard/imoveis/{property_id}?tab=processos&subtask={subtask_id}` (ou tab "Proprietários" se `subtask_id=NULL`)
- `metadata`: `{ owner_id, field_name, subtask_id, audit_row_id }`

O mapping de `field_name → field_label PT` é:
- `naturality` → `Naturalidade`
- `address` → `Morada`
- `marital_status` → `Estado civil`
- `legal_rep_naturality` → `Naturalidade (Rep. legal)`
- `legal_rep_address` → `Morada (Rep. legal)`
- `legal_rep_marital_status` → `Estado civil (Rep. legal)`

#### Scenario: Primeira edição cria notificação

- **WHEN** o owner edita `address` pela primeira vez nos últimos 5min
- **THEN** uma notificação `owner_field_edited` é criada
- **AND** `metadata.field_name='address'`

#### Scenario: Segunda edição do mesmo campo dentro de 5min é silenciada

- **WHEN** o owner edita `address` 2 minutos depois da primeira edição
- **THEN** uma audit row é criada na mesma
- **AND** NENHUMA notificação adicional é criada (rate-limit hit)

#### Scenario: Edição de campo diferente dentro de 5min cria notificação

- **WHEN** o owner edita `address` e 1 minuto depois edita `marital_status`
- **THEN** duas notificações são criadas (campos diferentes contam como buckets independentes)

#### Scenario: Rate-limit por owner quando subtask_id é NULL

- **WHEN** o app cliente não passa `app.current_subtask_id` e o owner edita `address` duas vezes em 3 minutos
- **THEN** apenas a primeira edição cria notificação
- **AND** o rate-limit usa `metadata.owner_id` em vez de `metadata.subtask_id`

#### Scenario: Edição via ERP (auth.uid() é o consultor) não notifica consultor

- **WHEN** o consultor edita `address` directamente no ERP via `auth.uid() = <consultor.id>`
- **THEN** a audit row é criada na mesma com `edited_by_auth_user_id=<consultor.id>`, `edited_via='erp'`
- **AND** NENHUMA notificação é criada (não faz sentido notificar o próprio editor)

#### Scenario: Notificação `owner_field_edited` é despachada via cron de push

- **WHEN** o trigger cria uma notification `owner_field_edited` (rate-limit não atingido) com `push_dispatched=false`
- **AND** o cron `/api/cron/dispatch-pending-push` corre dentro de 1min
- **THEN** o cron chama `sendPushToUser(supabase, recipient_id, payload)` para o consultor
- **AND** marca `push_dispatched=true`
- **AND** o consultor recebe push no browser/PWA com título tipo `<owner_name> editou <field_label>`

#### Scenario: Rate-limit também silencia push (não só in-app)

- **WHEN** o owner edita `address` duas vezes em 3 minutos
- **THEN** apenas a primeira edição cria notificação (in-app + push)
- **AND** o segundo evento gera apenas audit row, sem notificação nem push

---

### Requirement: Timeline UI de audit no painel do owner

O sistema SHALL renderizar um componente `<OwnerFieldAuditTimeline ownerId>` no painel de detalhe do owner que:

1. Faz fetch a `GET /api/owners/[id]/audit?limit=50` retornando rows ordenadas por `created_at DESC`.
2. Agrupa rows com o mesmo `subtask_id` E `created_at` dentro de uma janela de 30 minutos num único item expandível ("3 alterações em 12min").
3. Para cada audit row mostra:
   - Ícone (`UserPen` para edição, com cor amber).
   - Linha 1: `<field_label PT>: <old_value or 'vazio'> → <new_value>`
   - Linha 2: `<edited_via PT> · <relative time PT>` (ex.: `Via app · há 2 horas`)
   - Linha 3 (se expandível): "Subtarefa: <subtask_title>" com link para o subtask.
4. Empty state PT-PT: "Sem alterações registadas neste proprietário."

Permissão: o endpoint `GET /api/owners/[id]/audit` MUST exigir o caller estar autenticado E ter pelo menos uma destas condições:
- Ser owner relacionado a um imóvel cujo `consultant_id = auth.uid()`.
- Ter permissão `properties` ou `processes` no role.

#### Scenario: Timeline mostra todas as edições do owner

- **WHEN** o painel do owner abre e existem 3 audit rows nos últimos 7 dias
- **THEN** as 3 rows são renderizadas com o agrupamento aplicado se aplicável
- **AND** ordenadas por `created_at DESC`

#### Scenario: Edições da mesma subtask em 30min agrupam

- **WHEN** existem 3 audit rows com mesmo `subtask_id` em 12min
- **THEN** o grupo aparece como um item expandível `"3 alterações em 12min"`
- **AND** ao expandir mostra os 3 campos individuais

#### Scenario: Edição via ERP mostra rótulo distinto

- **WHEN** uma audit row tem `edited_via='erp'`
- **THEN** a label da linha é `Via ERP` (não `Via app`)

#### Scenario: Sem permissão retorna 403

- **WHEN** o caller não está relacionado ao owner nem tem permissão `properties`/`processes`
- **THEN** o endpoint retorna 403
