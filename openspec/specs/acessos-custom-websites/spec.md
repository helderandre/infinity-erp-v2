# Acessos Custom Websites

CRUD of user- and team-curated websites rendered inside the "Outros" sub-tab of `/dashboard/acessos` → Websites. Supports two scopes: `global` (curated by admins with `settings` permission, visible to the whole team) and `personal` (owned by a single user). Seed rows are protected with `is_system=true`.

### Requirement: Persistent storage of custom websites

The system SHALL persist custom websites in a table `acessos_custom_sites` with the columns `id`, `scope` (`'global' | 'personal'`), `owner_id` (nullable, FK → `dev_users.id`), `title`, `url`, `icon`, `sort_order`, `is_system`, `is_active`, `created_at`, `updated_at`, `created_by`. A CHECK constraint MUST enforce that `scope='global' ⇔ owner_id IS NULL` and `scope='personal' ⇔ owner_id IS NOT NULL`.

#### Scenario: Global row has null owner
- **WHEN** a row is inserted with `scope='global'` and a non-null `owner_id`
- **THEN** the database rejects the insert with a CHECK violation

#### Scenario: Personal row requires owner
- **WHEN** a row is inserted with `scope='personal'` and `owner_id` null
- **THEN** the database rejects the insert with a CHECK violation

#### Scenario: Owner deletion cascades
- **WHEN** a `dev_users` row referenced by `owner_id` is deleted
- **THEN** all `acessos_custom_sites` rows owned by that user are deleted (ON DELETE CASCADE)

### Requirement: Seed of system-protected global sites

The migration that creates `acessos_custom_sites` SHALL insert 4 global rows with `is_system=true` for the sites previously hardcoded: ChatGPT (`https://chat.openai.com`), Canva (`https://www.canva.com`), WhatsApp Web (`https://web.whatsapp.com`), Monday.com (`https://monday.com`). Rows with `is_system=true` MUST be protected from deletion by any user.

#### Scenario: System seed is present after migration
- **WHEN** the migration completes on a fresh database
- **THEN** `SELECT count(*) FROM acessos_custom_sites WHERE is_system=true AND scope='global'` returns 4

#### Scenario: Deleting a system row is blocked
- **WHEN** any authenticated user calls `DELETE /api/acessos/custom-sites/[id]` for a row with `is_system=true`
- **THEN** the API responds with `403 Forbidden` and the row remains in the database

### Requirement: Listing custom websites for the current user

The API `GET /api/acessos/custom-sites` SHALL return, for the authenticated user, the union of all rows where `is_active=true` AND (`scope='global'` OR (`scope='personal'` AND `owner_id = auth.uid()`)), ordered by `scope` (global first), then `sort_order ASC`, then `created_at ASC`. Unauthenticated requests MUST receive `401`.

#### Scenario: User sees global sites plus their own
- **GIVEN** 4 system-global sites exist and user A has 2 personal sites and user B has 3 personal sites
- **WHEN** user A calls `GET /api/acessos/custom-sites`
- **THEN** the response contains exactly 6 items (4 globals + A's 2 personal) and none of B's personal sites

#### Scenario: Inactive rows are hidden
- **GIVEN** a global site with `is_active=false`
- **WHEN** any user calls `GET /api/acessos/custom-sites`
- **THEN** the inactive row is NOT included in the response

#### Scenario: Unauthenticated request is rejected
- **WHEN** a caller without a valid session calls `GET /api/acessos/custom-sites`
- **THEN** the API responds with `401 Unauthorized`

### Requirement: Creating a personal custom website

The API `POST /api/acessos/custom-sites` with `scope='personal'` SHALL require authentication, validate `title` (non-empty, ≤ 80 chars) and `url` (valid URL; if missing `http://`/`https://` prefix, the server MUST prepend `https://`), force `owner_id = auth.uid()` regardless of what the client sends, set `is_system=false`, and persist `created_by = auth.uid()`. No permission check beyond authentication is required.

#### Scenario: Personal site created with forced owner
- **WHEN** an authenticated user POSTs `{scope:'personal', title:'Notion', url:'notion.so', owner_id:'<another-user-uuid>'}`
- **THEN** the row is inserted with `owner_id = auth.uid()` (not the value the client supplied), `url='https://notion.so'`, `is_system=false`, and the response is `201`

#### Scenario: Invalid URL is rejected
- **WHEN** an authenticated user POSTs `{scope:'personal', title:'X', url:'not a url'}`
- **THEN** the API responds with `400 Bad Request` and no row is created

#### Scenario: Empty title is rejected
- **WHEN** an authenticated user POSTs `{scope:'personal', title:'', url:'https://x.com'}`
- **THEN** the API responds with `400 Bad Request`

### Requirement: Creating a global custom website

The API `POST /api/acessos/custom-sites` with `scope='global'` SHALL require authentication AND `roles.permissions.settings=true` (via `hasPermissionServer`). The server MUST force `owner_id=null` and `is_system=false`, and MUST write an entry in `log_audit` with `entity_type='acessos_custom_site'`, `action='acessos_custom_site.create'`.

#### Scenario: User without settings permission is forbidden
- **WHEN** an authenticated user without `settings` permission POSTs `{scope:'global', title:'X', url:'https://x.com'}`
- **THEN** the API responds with `403 Forbidden` and no row is created

#### Scenario: Admin creates global site
- **WHEN** a user with `settings` permission POSTs `{scope:'global', title:'Loom', url:'https://loom.com'}`
- **THEN** the row is inserted with `scope='global'`, `owner_id=null`, `is_system=false`, and a `log_audit` entry is written

### Requirement: Editing a custom website

The API `PUT /api/acessos/custom-sites/[id]` SHALL allow editing `title`, `url`, `icon`, and `sort_order`. The caller MUST be either (a) the `owner_id` of a `scope='personal'` row, or (b) a user with `settings` permission for a `scope='global'` row. The fields `scope`, `owner_id`, `is_system`, and `created_by` MUST NOT be mutable. Mutations MUST bump `updated_at`.

#### Scenario: Owner edits their personal site
- **GIVEN** user A owns a personal site
- **WHEN** user A PUTs `{title:'New'}` to that site
- **THEN** the row's `title` is updated and `updated_at` is newer than `created_at`

#### Scenario: Non-owner cannot edit personal site
- **GIVEN** user B owns a personal site
- **WHEN** user A (not B) PUTs to that site
- **THEN** the API responds with `403 Forbidden`

#### Scenario: Non-settings user cannot edit global site
- **WHEN** a user without `settings` permission PUTs any field to a `scope='global'` row
- **THEN** the API responds with `403 Forbidden`

#### Scenario: Scope cannot be promoted
- **WHEN** an owner PUTs `{scope:'global'}` to their personal site
- **THEN** the API ignores the `scope` field and the row remains `scope='personal'`

### Requirement: Deleting a custom website

The API `DELETE /api/acessos/custom-sites/[id]` SHALL perform a hard delete. It MUST reject (403) if `is_system=true`. Otherwise, authorization follows the edit rules: owner for personal, `settings` permission for global. Every delete MUST write an entry in `log_audit` with `entity_type='acessos_custom_site'`, `action='acessos_custom_site.delete'`.

#### Scenario: Owner deletes their personal site
- **GIVEN** user A owns a personal site with `is_system=false`
- **WHEN** user A DELETEs that site
- **THEN** the row is removed and a `log_audit` entry is written

#### Scenario: System row cannot be deleted even by admin
- **GIVEN** a `scope='global', is_system=true` row
- **WHEN** a user with `settings` permission DELETEs it
- **THEN** the API responds with `403 Forbidden` and the row remains

### Requirement: "Outros" sub-tab UI renders dynamic list

The "Outros" sub-tab inside `/dashboard/acessos` → Websites tab SHALL render its site cards from the dynamic API (not from a hardcoded array). The cards MUST preserve the existing visual layout (responsive 3-column grid of `LinkCard`). The MicroSIR and Casafari sub-tabs MUST remain visually and behaviourally unchanged.

#### Scenario: Outros shows only dynamic sites
- **WHEN** the Outros sub-tab renders
- **THEN** its cards are sourced from `GET /api/acessos/custom-sites`, with zero references to the previous hardcoded array

#### Scenario: Empty state when database is empty
- **GIVEN** no rows exist in `acessos_custom_sites`
- **WHEN** the Outros sub-tab renders
- **THEN** an empty state is shown with a CTA "Adicionar site"

### Requirement: Add / edit / delete controls in the UI

The "Outros" sub-tab SHALL show an "+ Adicionar site" button visible to every authenticated user. Each non-system card MUST expose a `…` dropdown with "Editar" and "Eliminar" actions when the viewer is authorized (owner for personal, `settings` permission for global). System cards (`is_system=true`) MUST show a "Sistema" badge and no action menu. The delete action MUST be gated by an `AlertDialog` confirmation.

#### Scenario: Create personal site from UI
- **WHEN** an authenticated user clicks "+ Adicionar site", fills `title` and `url`, leaves scope default ("Pessoal"), and submits
- **THEN** the site is created via POST and appears in the Outros grid without a full page refresh

#### Scenario: Scope toggle visibility
- **WHEN** the dialog opens for a user WITHOUT `settings` permission
- **THEN** the `Global | Pessoal` toggle is NOT rendered and the scope is forced to `personal`

#### Scenario: Scope toggle for admin
- **WHEN** the dialog opens for a user WITH `settings` permission
- **THEN** the `Global | Pessoal` toggle is visible with `Pessoal` selected by default

#### Scenario: System card shows badge
- **WHEN** a site with `is_system=true` renders
- **THEN** a "Sistema" badge is visible in the card and no `…` menu is rendered

#### Scenario: Delete confirmation
- **WHEN** a user clicks "Eliminar" from the card menu
- **THEN** an `AlertDialog` asks "Tem a certeza?" and the delete only proceeds if "Eliminar" is clicked
