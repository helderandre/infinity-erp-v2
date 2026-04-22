## ADDED Requirements

### Requirement: Dynamic marketing design categories table

The system SHALL store marketing design categories in a dedicated `marketing_design_categories` table with the following shape: `id UUID PK`, `slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$')`, `label TEXT NOT NULL`, `icon TEXT NULL`, `color TEXT NULL`, `sort_order INTEGER NOT NULL DEFAULT 0`, `is_system BOOLEAN NOT NULL DEFAULT false`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_by UUID REFERENCES dev_users(id) ON DELETE SET NULL`, `created_at`, `updated_at`. An `updated_at` trigger SHALL touch the row on every update.

Eight system categories SHALL be seeded on migration with `is_system=true`: `placas` (Placas), `cartoes` (Cartões), `badges` (Badges), `assinaturas` (Assinaturas), `relatorios` (Relatórios), `estudos` (Estudos de Mercado), `redes_sociais` (Redes Sociais), `outro` (Outros).

#### Scenario: Seed on fresh migration
- **WHEN** the migration runs on a new database
- **THEN** the eight system categories exist with `is_system=true`, `is_active=true`, and `sort_order` values 10, 20, 30, 40, 50, 60, 70, 80

#### Scenario: Slug is immutable
- **WHEN** any update is attempted on the `slug` column of an existing row
- **THEN** the API rejects the change with 400 and the underlying column value remains unchanged

### Requirement: GET categories endpoint

The system SHALL expose `GET /api/marketing/design-categories` that returns all categories ordered by `sort_order ASC, label ASC`. Authentication is required; no special permission.

#### Scenario: Authenticated user lists categories
- **WHEN** an authenticated user calls GET `/api/marketing/design-categories`
- **THEN** the response is 200 with an array of category objects including `id, slug, label, icon, color, sort_order, is_system, is_active`

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid session calls GET `/api/marketing/design-categories`
- **THEN** the response is 401

### Requirement: POST create category endpoint

The system SHALL expose `POST /api/marketing/design-categories` that creates a new category. Body: `{ label: string (1..80), icon?: string, color?: hex #RRGGBB, sort_order?: integer }`. Requires permission `settings`. The `slug` is derived server-side via `slugifyCategory(label)` — clients MUST NOT send a slug. When `sort_order` is not provided, the server sets it to `max(sort_order) + 10`. A `log_audit` row SHALL be written with `entity_type='marketing_design_category'`, `action='create'`.

#### Scenario: Admin creates new category with icon and color
- **WHEN** a user with `settings` permission POSTs `{ label: "Flyers", icon: "FileText", color: "#EF4444" }`
- **THEN** a row is inserted with `slug='flyers'`, `is_system=false`, `is_active=true`, and the response is 201 with the new row

#### Scenario: Non-admin denied
- **WHEN** a user without `settings` permission POSTs a valid body
- **THEN** the response is 403 and no row is inserted

#### Scenario: Duplicate slug rejected
- **WHEN** a POST attempts a label whose slug collides with an existing category
- **THEN** the response is 409 with message "Já existe uma categoria com esse nome"

#### Scenario: Invalid label
- **WHEN** a POST sends `{ label: "   " }` or a label containing only non-alphanumeric characters
- **THEN** the response is 400

### Requirement: PUT edit category endpoint

The system SHALL expose `PUT /api/marketing/design-categories/[id]` accepting partial `{ label?, icon?, color?, sort_order?, is_active? }`. Requires `settings`. The slug SHALL NOT be editable — any `slug` key in the body causes a 400. System categories (`is_system=true`) MUST NOT be deactivated (`is_active=false`) — the API SHALL return 409. Writes a `log_audit` update row.

#### Scenario: Rename a custom category
- **WHEN** admin PUTs `{ label: "Flyers e Panfletos" }` on a `is_system=false` category
- **THEN** the label updates, the slug stays the same, and response is 200

#### Scenario: Attempt to deactivate system category
- **WHEN** admin PUTs `{ is_active: false }` on a category with `is_system=true`
- **THEN** the response is 409 with message "Categorias do sistema não podem ser desactivadas"

#### Scenario: Attempt to change slug
- **WHEN** any PUT body includes a `slug` key
- **THEN** the response is 400 with message "O identificador (slug) não pode ser alterado"

### Requirement: DELETE soft-delete with reassign

The system SHALL expose `DELETE /api/marketing/design-categories/[id]` that soft-deletes a category by setting `is_active=false`. Requires `settings`. System categories (`is_system=true`) MUST NOT be deleted (409). When the category has associated active designs (across `marketing_design_templates` AND `agent_personal_designs`) and no `reassign_to` is provided in the body, the API SHALL return 409 with `{ error, design_count }`. When `reassign_to=<target_slug>` is provided, the API SHALL move all active designs to that target (must exist and `is_active=true` and not be the same category) and only then deactivate. Reassign is atomic — both tables updated before setting `is_active=false`. Audit log entry with `action='delete'` and `new_data.reassigned` count.

#### Scenario: Delete unused category
- **WHEN** admin DELETEs a non-system category with zero associated designs
- **THEN** `is_active=false`, response 200 `{ ok: true, reassigned: 0 }`

#### Scenario: Delete used category without reassign
- **WHEN** admin DELETEs a non-system category that has 5 team designs and 2 personal designs
- **THEN** response is 409 with `{ error, document_count: 7 }` (or `design_count: 7`), category unchanged

#### Scenario: Delete with reassign
- **WHEN** admin DELETEs a category that has 3 team + 4 personal designs with body `{ reassign_to: "outro" }`
- **THEN** all 7 designs are moved to `outro` (both `category` slug and `category_id` updated), then the source category is deactivated, response 200 `{ ok: true, reassigned: 7 }`

#### Scenario: Reassign to inactive target
- **WHEN** DELETE includes `{ reassign_to: "<slug of inactive category>" }`
- **THEN** response is 400 with "Categoria de destino inválida ou inactiva"

#### Scenario: Delete system category
- **WHEN** admin DELETEs a category with `is_system=true`
- **THEN** response is 409 "Categorias do sistema não podem ser eliminadas"

### Requirement: Legacy CHECK constraint removed and `category_id` FK added on `marketing_design_templates`

The migration SHALL drop the existing `marketing_design_templates_category_check` CHECK constraint and add a nullable `category_id UUID REFERENCES marketing_design_categories(id) ON DELETE SET NULL`. All existing rows SHALL be backfilled to set `category_id` from the matching slug in `marketing_design_categories`. The `category` text column SHALL be retained for backward compatibility.

#### Scenario: Post-migration integrity
- **WHEN** the migration completes
- **THEN** every row in `marketing_design_templates` where `category IN (<seeded slugs>)` has a non-null `category_id` matching the category with that slug

#### Scenario: API validates category on create
- **WHEN** `POST /api/marketing/design-templates` receives `{ category: "flyers" }` and no category with slug `flyers` exists as `is_active=true`
- **THEN** the response is 400 "Categoria inválida" and no row is inserted

#### Scenario: API stores category_id on create
- **WHEN** `POST /api/marketing/design-templates` succeeds with a valid active slug
- **THEN** both `category` (slug) and `category_id` (UUID) columns are populated with matching values

### Requirement: Team designs UI groups by dynamic categories

The **Designs da Equipa** sub-tab in `/dashboard/documentos` SHALL replace the hardcoded `DESIGN_CATEGORIES` map with a consumer of the dynamic categories provider. The category filter SHALL show active categories ordered by `sort_order`. A dedicated **"+ Nova categoria"** button SHALL be rendered next to the filter and, for users with `settings`, next to the category select inside the "Adicionar/Editar Design" dialog. Each category section header SHALL display the icon (from the 10-icon Lucide gallery) + colour dot + label + design count, and — for `settings` users — a trailing `…` menu with **Editar** and **Eliminar**.

#### Scenario: Admin opens filter dropdown
- **WHEN** an admin opens the category filter
- **THEN** the dropdown lists every `is_active=true` category with icon + label, including any custom ones created via the API

#### Scenario: Non-admin sees no edit affordances
- **WHEN** a consultor without `settings` views a category section header
- **THEN** the `…` menu with Editar/Eliminar is not rendered, only the icon + label + count

#### Scenario: Add category from filter bar
- **WHEN** an admin clicks "+ Nova categoria" next to the filter
- **THEN** a dialog opens with the icon gallery + colour picker; on save the category is created via `POST /api/marketing/design-categories` and is auto-selected in the filter

### Requirement: Icon gallery reused from company-docs module

The category create/edit dialog SHALL render the existing 10-icon Lucide gallery from `components/documents/company-category-icons.tsx` (Folder, Scale, Shield, Building2, Users, BookOpen, Briefcase, Receipt, Megaphone, FileText). No new icon file SHALL be introduced for this change.

#### Scenario: Icon selection stores Lucide name
- **WHEN** user picks the "Briefcase" icon in the create dialog
- **THEN** the category row is stored with `icon='Briefcase'`

### Requirement: Audit logging for category mutations

Every create, update, and delete operation on `marketing_design_categories` SHALL insert a row into `log_audit` with `entity_type='marketing_design_category'`, `user_id=<actor>`, `action IN ('create','update','delete')`, and `old_data` / `new_data` as appropriate.

#### Scenario: Create produces audit entry
- **WHEN** `POST /api/marketing/design-categories` succeeds
- **THEN** exactly one `log_audit` row exists with `entity_type='marketing_design_category'`, `action='create'`, `new_data` equal to the created row

### Requirement: RLS on marketing_design_categories

The table SHALL have RLS enabled. A SELECT policy SHALL permit `auth.role() = 'authenticated'`. A service-role policy (FOR ALL USING true WITH CHECK true) SHALL permit API mutations (which already enforce the `settings` permission in the handler).

#### Scenario: Authenticated SELECT allowed
- **WHEN** any authenticated client (browser or server with user session) selects from the table
- **THEN** all rows are visible

#### Scenario: Anon SELECT blocked
- **WHEN** an anonymous client queries the table
- **THEN** no rows are returned and RLS blocks the read
