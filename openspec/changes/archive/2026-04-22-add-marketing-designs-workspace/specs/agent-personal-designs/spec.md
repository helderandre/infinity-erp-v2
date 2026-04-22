## ADDED Requirements

### Requirement: Personal designs table per agent

The system SHALL store consultant-owned marketing designs in a dedicated `agent_personal_designs` table: `id UUID PK`, `agent_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `description TEXT NULL`, `category_id UUID NULL REFERENCES marketing_design_categories(id) ON DELETE SET NULL`, `file_path TEXT NULL`, `file_name TEXT NULL`, `file_size INTEGER NULL`, `mime_type TEXT NULL`, `thumbnail_path TEXT NULL`, `canva_url TEXT NULL`, `sort_order INTEGER NOT NULL DEFAULT 0`, `created_at`, `updated_at`. At least one of `file_path` or `canva_url` SHALL be non-null (enforced by CHECK). An `updated_at` trigger SHALL touch the row on every update.

Indexes SHALL be created on `agent_id` and on `(agent_id, category_id)`.

#### Scenario: Create design with file only
- **WHEN** a row is inserted with `file_path='personal/<uuid>/<file>'` and `canva_url=NULL`
- **THEN** the insert succeeds

#### Scenario: Create design with canva_url only
- **WHEN** a row is inserted with `canva_url='https://www.canva.com/...'` and `file_path=NULL`
- **THEN** the insert succeeds

#### Scenario: Both sources null
- **WHEN** a row is inserted with both `file_path=NULL` and `canva_url=NULL`
- **THEN** the CHECK constraint rejects the insert

### Requirement: RLS scopes personal designs per agent

Row Level Security SHALL be enabled. A SELECT policy SHALL permit reads when `agent_id = auth.uid()` OR when the caller has `settings` permission (via join to `dev_users`+`roles`). Service-role policies (FOR ALL) SHALL be present for the API to mutate under service-role client while the handler enforces the actor check.

#### Scenario: Agent reads own designs
- **WHEN** consultor A queries `agent_personal_designs` while `auth.uid()` returns their id
- **THEN** only rows where `agent_id = A.id` are visible

#### Scenario: Admin with settings reads all
- **WHEN** a user with `settings=true` queries the table
- **THEN** all rows are visible

#### Scenario: Other consultor blocked
- **WHEN** consultor B queries rows owned by consultor A
- **THEN** no rows are returned

### Requirement: List personal designs endpoint

The system SHALL expose `GET /api/consultants/[id]/personal-designs?category=<slug>`. The caller MUST be the agent themselves OR have `settings` permission; otherwise 403. Returns designs ordered by `category_id` then `sort_order ASC` then `name ASC`. For each row with a `file_path` or `thumbnail_path`, the API SHALL return a signed URL (`file_url`, `thumbnail_url`) valid for 1 hour, generated against the Supabase Storage bucket `marketing-kit`.

#### Scenario: Agent lists own designs
- **WHEN** consultor A calls GET `/api/consultants/<A.id>/personal-designs`
- **THEN** response 200 includes `file_url` signed URLs and response is filtered to A's rows

#### Scenario: Cross-agent blocked
- **WHEN** consultor A calls GET `/api/consultants/<B.id>/personal-designs` without `settings`
- **THEN** response is 403

#### Scenario: Category filter
- **WHEN** GET is called with `?category=placas`
- **THEN** only rows whose `category_id` matches the slug `placas` are returned

### Requirement: Upload personal design endpoint

The system SHALL expose `POST /api/consultants/[id]/personal-designs/upload` accepting multipart form data: `file` (required, allowed extensions `.png, .jpg, .jpeg, .webp, .pdf`), `name` (string), `category` (slug, must be active), `description?` (string), `thumbnail?` (image file, optional — max 10MB). Size limits depend on the file type: **images** (`.png, .jpg, .jpeg, .webp`) are capped at **10MB**; **PDFs** are capped at **100MB**. The caller MUST be the agent or have `settings`. The file is uploaded to Supabase Storage bucket `marketing-kit` under `personal/<agent_id>/<timestamp>-<sanitized-name>`. A row is inserted into `agent_personal_designs` with the paths and metadata. The response is 201 with the new row including signed URLs.

#### Scenario: Upload PNG as personal design
- **WHEN** consultor A POSTs multipart with `file=<200KB PNG>`, `name="Minha Placa"`, `category="placas"`
- **THEN** file is stored at `personal/<A.id>/<ts>-minha-placa.png`, row inserted, response 201

#### Scenario: Image upload exceeds 10MB limit
- **WHEN** the multipart file is a 12MB PNG
- **THEN** response is 413 (or 400) with "Imagem demasiado grande (máx. 10MB)"

#### Scenario: PDF upload exceeds 100MB limit
- **WHEN** the multipart file is a 110MB PDF
- **THEN** response is 413 (or 400) with "PDF demasiado grande (máx. 100MB)"

#### Scenario: PDF between 10MB and 100MB accepted
- **WHEN** the multipart file is a 50MB PDF
- **THEN** the upload succeeds (response 201) because only the PDF-specific 100MB cap applies

#### Scenario: Invalid category
- **WHEN** POST includes `category="flyers"` but no active category with that slug exists
- **THEN** response is 400 "Categoria inválida" and no file is stored

#### Scenario: Disallowed extension
- **WHEN** POST includes a `.exe` file
- **THEN** response is 400 "Tipo de ficheiro não permitido"

### Requirement: Create personal design with Canva URL only

The system SHALL expose `POST /api/consultants/[id]/personal-designs` (JSON body) accepting `{ name: string, category: slug, canva_url: string, description?: string, thumbnail_url?: string }` for designs that have no uploaded file (link-only). Validation: `canva_url` must be a valid URL; `category` must be an active slug.

#### Scenario: Create link-only design
- **WHEN** consultor A POSTs JSON `{ name: "Canva Flyer", category: "placas", canva_url: "https://canva.com/..." }`
- **THEN** row is inserted with `file_path=NULL, canva_url='https://canva.com/...'`, response 201

### Requirement: Update personal design endpoint

The system SHALL expose `PUT /api/consultants/[id]/personal-designs/[designId]` accepting `{ name?, description?, category?, canva_url?, sort_order? }`. Only the owner (or `settings`) MAY update. Returns 404 if the design does not exist or is not owned by `[id]`.

#### Scenario: Owner renames design
- **WHEN** consultor A PUTs `{ name: "Placa Actualizada" }` on their own design
- **THEN** response is 200 and the row reflects the new name

#### Scenario: Cross-owner update blocked
- **WHEN** consultor B PUTs on a design owned by consultor A without `settings`
- **THEN** response is 403

### Requirement: Delete personal design endpoint

The system SHALL expose `DELETE /api/consultants/[id]/personal-designs/[designId]` that removes the row and any stored files (`file_path`, `thumbnail_path`) from the `marketing-kit` bucket. Only owner or `settings`. Returns 404 if not found; 200 `{ ok: true }` on success.

#### Scenario: Owner deletes design with file
- **WHEN** consultor A DELETEs their own design which has `file_path='personal/A/a.png'`
- **THEN** the storage object is removed AND the DB row is deleted AND response is 200

#### Scenario: Delete non-existent
- **WHEN** DELETE targets an id that is not owned by `[id]` or does not exist
- **THEN** response is 404

### Requirement: "Os meus designs" renders Kit grouped by dynamic categories

The **Os meus designs** sub-tab SHALL render the existing `marketing_kit_templates` catalogue grouped by the dynamic `marketing_design_categories`, using a static mapping from kit slugs to design slugs (`cartao_visita → cartoes`, `badge → badges`, `placa_venda → placas`, `placa_arrendamento → placas`, `assinatura_email → assinaturas`, `relatorio_imovel → relatorios`, `estudo_mercado → estudos`, `cartao_digital → cartoes`, `outro → outro`). The existing **"O Meu Kit — X de N materiais prontos"** progress bar SHALL remain at the top of the section. Items without a matching active design category SHALL fall back to the `outro` group.

#### Scenario: Kit cards grouped by category
- **WHEN** a consultor opens the "Os meus designs" sub-tab
- **THEN** the kit items are rendered in sections titled by design category labels (Cartões, Badges, Placas, …) with icon + colour dot + item count per section

#### Scenario: Fallback to "outro"
- **WHEN** a kit item's design category has been deactivated by an admin
- **THEN** that item is rendered under the "outro" section (which is `is_system=true` and always active)

### Requirement: "Os meus designs" merges personal designs into Kit category groups

The **Os meus designs** sub-tab SHALL render a **single unified grouped view** where each dynamic category section contains BOTH the kit items AND the consultor's `agent_personal_designs` for that category. Kit items appear first in each group, followed by personal design cards — there is NO separate "Designs personalizados" section.

A single filter bar at the top SHALL provide: **search** (filters both kit and personal by name), **category filter** (`MarketingDesignCategorySelect includeAllOption`), **"+ Nova categoria"** (admins with `settings`), and **"+ Adicionar design"** (opens the personal-design form dialog with no pre-selected category).

Each category section header SHALL have a trailing **"+"** button that opens the personal-design form dialog with that category pre-selected (kit items are not user-creatable).

Personal design cards SHALL show hover-actions for **Editar** and **Eliminar** (owner only). Kit item cards SHALL retain their existing appearance (no edit/delete), including the "Pendente" state when no upload exists.

#### Scenario: Kit and personal mixed in same group
- **WHEN** the consultor has a kit "Badge RE/MAX" (mapped to `badges`) and a personal design with `category.slug="badges"`
- **THEN** both cards render inside a single "Badges" section, kit card first, personal card after

#### Scenario: Empty workspace
- **WHEN** consultor has zero kit items and zero personal designs
- **THEN** an empty state is shown inviting to "Adicionar design" (kit creation is out of the consultor's control and handled separately by marketing admin)

#### Scenario: Add personal design from category header
- **WHEN** consultor clicks the "+" on the "Badges" category header
- **THEN** the personal design dialog opens with category pre-set to `badges`

#### Scenario: Edit own personal design
- **WHEN** consultor hovers a personal-design card they own and clicks the edit icon
- **THEN** the dialog opens pre-filled with the current values

#### Scenario: Kit item shows no edit affordance
- **WHEN** consultor hovers a kit item card
- **THEN** no edit or delete actions are visible (kit items are institutional)

#### Scenario: Progress bar reflects kit only
- **WHEN** the consultor has N kit items (R ready) and X personal designs
- **THEN** the "O Meu Kit" progress bar shows `R de N materiais prontos` — personal design count is NOT included

### Requirement: Personal design form dialog

The create/edit dialog SHALL offer fields: **Name** (required), **Category** (dynamic select + "+ Nova categoria" button for `settings` admins), **Canva URL** (optional), **Ficheiro** (optional file picker with drag-and-drop, accepting PNG/JPG/WebP/PDF — **10MB max for images, 100MB max for PDFs**), **Imagem de capa** (optional thumbnail image picker — 10MB max). The dialog SHALL enforce the size cap client-side before starting the upload (showing a localized toast if exceeded). At submit time, the dialog SHALL call `/personal-designs/upload` when a `Ficheiro` is attached, OR the JSON `POST /personal-designs` endpoint when only a Canva URL is provided. Editing an existing design SHALL use PUT against the row id.

#### Scenario: Submit with file + thumbnail
- **WHEN** user submits `name="A"`, `category="placas"`, `file=<png>`, `thumbnail=<jpg>`
- **THEN** both files are uploaded and the row is created in a single request

#### Scenario: Submit link-only
- **WHEN** user submits `name="A"`, `category="placas"`, `canva_url="https://..."`, no file
- **THEN** JSON POST is called; row inserted with `file_path=NULL`

#### Scenario: Missing name
- **WHEN** user submits with empty name
- **THEN** client validation blocks submit with message "Nome é obrigatório"
