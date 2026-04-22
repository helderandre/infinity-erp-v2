## ADDED Requirements

### Requirement: Tabela `company_document_categories`

O sistema SHALL manter a taxonomia de categorias da biblioteca `company_documents` na tabela `company_document_categories`, com slug único imutável por linha, label editável, `sort_order` numérico, flags `is_system` e `is_active`, e referência a `dev_users` em `created_by`.

#### Scenario: Criação da tabela com seed

- **WHEN** a migration `company_document_categories` é aplicada
- **THEN** a tabela existe com as colunas `id`, `slug`, `label`, `icon`, `color`, `sort_order`, `is_system`, `is_active`, `created_by`, `created_at`, `updated_at`
- **AND** as 9 categorias actuais (`angariacao`, `institucional`, `cliente`, `contratos`, `kyc`, `fiscal`, `marketing`, `formacao`, `outro`) existem como linhas com `is_system=true` e `sort_order` incremental 10, 20, …, 90
- **AND** a unique constraint em `slug` está aplicada
- **AND** a check constraint garante `slug ~ '^[a-z0-9-]+$'`

#### Scenario: Backfill de `category_id` em `company_documents`

- **WHEN** a migration aplica a coluna `category_id uuid` em `company_documents` e executa o backfill
- **THEN** todos os documentos cujo `category` corresponde a um `slug` da nova tabela têm `category_id` preenchido
- **AND** documentos com slug não mapeado mantêm `category_id=null`

### Requirement: Listagem de categorias

O sistema SHALL expor `GET /api/company-documents/categories` que retorna todas as categorias (activas e inactivas) ordenadas por `sort_order` ascendente, depois `label` ascendente. A listagem exige apenas autenticação válida.

#### Scenario: Utilizador autenticado lista categorias

- **WHEN** um utilizador autenticado faz `GET /api/company-documents/categories`
- **THEN** a resposta é `200` com JSON array de objectos `{ id, slug, label, icon, color, sort_order, is_system, is_active }`
- **AND** categorias inactivas aparecem com `is_active=false` (o cliente decide se mostra)

#### Scenario: Pedido sem autenticação

- **WHEN** o pedido não tem sessão Supabase válida
- **THEN** a resposta é `401` com `{ error: 'Não autenticado' }`

### Requirement: Criação de categoria

O sistema SHALL permitir `POST /api/company-documents/categories` com payload `{ label: string, icon?: string, color?: string, sort_order?: number }` apenas a utilizadores com `roles.permissions.settings === true`. O slug é derivado do label por `slugify` server-side. Categoria criada é `is_system=false`, `is_active=true`.

#### Scenario: Admin cria categoria nova

- **WHEN** um admin envia `POST` com `{ label: 'Jurídico' }`
- **THEN** a resposta é `201` com `{ id, slug: 'juridico', label: 'Jurídico', … }`
- **AND** é inserida uma linha em `log_audit` com `entity_type='company_document_category'`, `action='create'`, `new_data` contendo o payload criado

#### Scenario: Slug colide

- **WHEN** o admin envia `POST` com `{ label: 'Fiscal' }` e já existe categoria com `slug='fiscal'`
- **THEN** a resposta é `409` com `{ error: 'Já existe uma categoria com esse nome' }`
- **AND** nenhuma linha é inserida na tabela nem em `log_audit`

#### Scenario: Utilizador sem permissão `settings`

- **WHEN** um consultor sem `settings=true` envia `POST`
- **THEN** a resposta é `403` com `{ error: 'Sem permissão' }`

#### Scenario: Label vazio ou inválido

- **WHEN** o payload tem `label=''` ou `label` com apenas espaços
- **THEN** a resposta é `400` com mensagem de validação Zod

### Requirement: Edição de categoria

O sistema SHALL permitir `PUT /api/company-documents/categories/[id]` com payload parcial `{ label?, icon?, color?, sort_order?, is_active? }`. Admins com `settings=true` podem editar qualquer categoria. Categorias `is_system=true` podem ser editadas em `label`, `icon`, `color`, `sort_order` mas **não** em `slug` nem podem ser desactivadas.

#### Scenario: Renomear categoria system

- **WHEN** um admin envia `PUT` a uma categoria `is_system=true` com `{ label: 'Institucional' }`
- **THEN** a resposta é `200` com o objecto actualizado
- **AND** o `slug` permanece inalterado
- **AND** é registada linha em `log_audit` com `old_data` e `new_data`

#### Scenario: Tentar desactivar categoria system

- **WHEN** o payload inclui `{ is_active: false }` para uma categoria `is_system=true`
- **THEN** a resposta é `409` com `{ error: 'Categorias do sistema não podem ser desactivadas' }`

#### Scenario: Tentar alterar slug

- **WHEN** o payload inclui `{ slug: 'novo-slug' }`
- **THEN** o campo é ignorado e a resposta contém o slug original (ou a resposta é `400` — implementação escolhe uma; preferência: `400` para ser explícito)

#### Scenario: Categoria inexistente

- **WHEN** o `id` não corresponde a nenhuma linha
- **THEN** a resposta é `404`

### Requirement: Desactivação de categoria

O sistema SHALL permitir `DELETE /api/company-documents/categories/[id]` que efectua soft delete (`is_active=false`). Apenas categorias `is_system=false` podem ser desactivadas. Se houver documentos activos (`company_documents.is_active=true`) com esse `category_id` ou `category=slug`, a API SHALL retornar `409` com contagem, a menos que o payload inclua `{ reassign_to: <slug> }` — nesse caso, os documentos afectados são re-categorizados atomicamente antes da desactivação.

#### Scenario: Desactivar categoria vazia

- **WHEN** admin envia `DELETE` para categoria sem documentos
- **THEN** a resposta é `200` com `{ ok: true, reassigned: 0 }`
- **AND** a linha fica `is_active=false`
- **AND** é registado em `log_audit`

#### Scenario: Desactivar categoria com documentos sem `reassign_to`

- **WHEN** admin envia `DELETE` para categoria com 3 documentos activos
- **THEN** a resposta é `409` com `{ error: 'A categoria contém 3 documentos activos', document_count: 3 }`
- **AND** a linha não é alterada

#### Scenario: Desactivar categoria com `reassign_to`

- **WHEN** admin envia `DELETE` com `{ reassign_to: 'outro' }` e a categoria tem 3 documentos
- **THEN** os 3 documentos ficam com `category='outro'` e `category_id` da categoria `outro`
- **AND** a categoria original fica `is_active=false`
- **AND** a resposta é `200` com `{ ok: true, reassigned: 3 }`

#### Scenario: Tentar apagar categoria system

- **WHEN** admin envia `DELETE` para categoria `is_system=true`
- **THEN** a resposta é `409` com `{ error: 'Categorias do sistema não podem ser eliminadas' }`

### Requirement: Integração com upload e listagem de documentos

O sistema SHALL validar o valor de `category` recebido em `POST /api/company-documents/upload`, `PUT /api/company-documents/[id]` e `GET /api/company-documents?category=…` contra a tabela `company_document_categories`. Uploads só são aceites se o slug corresponder a uma categoria `is_active=true`. O upload SHALL também gravar `category_id` a partir do slug.

#### Scenario: Upload para categoria activa

- **WHEN** um utilizador autenticado faz `POST /api/company-documents/upload` com `category='kyc'`
- **THEN** a resposta é `201` e o documento criado tem `category='kyc'` e `category_id` igual ao `id` da categoria "KYC"

#### Scenario: Upload para categoria inactiva

- **WHEN** o slug pertence a uma categoria com `is_active=false`
- **THEN** a resposta é `400` com `{ error: 'Categoria inactiva' }`
- **AND** nenhum ficheiro é carregado para R2

#### Scenario: Upload para slug inexistente

- **WHEN** o slug não existe na tabela
- **THEN** a resposta é `400` com `{ error: 'Categoria inválida' }`

### Requirement: UI da página `/dashboard/documentos`

A página `/dashboard/documentos` (tab Documentos) SHALL consumir `useCompanyDocumentCategories()` como única fonte de categorias. O mapa hardcoded `CATEGORIES` em [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) SHALL ser removido.

#### Scenario: Dropdown de filtro inclui todas as categorias activas

- **WHEN** a página carrega e existem 10 categorias activas
- **THEN** a dropdown de filtro mostra "Todas as categorias" + as 10, ordenadas por `sort_order`
- **AND** o último item da dropdown é "+ Nova categoria…" visível apenas se o utilizador tiver `settings=true`

#### Scenario: Utilizador clica em "+ Nova categoria…"

- **WHEN** o utilizador selecciona "+ Nova categoria…" na dropdown
- **THEN** a dropdown fecha e abre `CategoryFormDialog` com campos vazios
- **AND** ao guardar com sucesso, a nova categoria aparece na dropdown e fica seleccionada como filtro activo

#### Scenario: Cabeçalho de grupo com acções de admin

- **WHEN** a listagem agrupa por categoria e o utilizador tem `settings=true`
- **THEN** cada cabeçalho mostra menu `…` com itens "Editar" e "Eliminar"
- **AND** admins sem `settings=true` não vêem o menu

#### Scenario: Documento com categoria órfã

- **WHEN** um documento tem `category='antigo-slug'` que já não existe na tabela
- **THEN** aparece num grupo com label "Sem categoria" (ou o slug bruto) e badge "arquivada"
- **AND** o menu de edição do documento permite re-categorizar

### Requirement: Hook `useCompanyDocumentCategories`

O sistema SHALL expor `hooks/use-company-document-categories.ts` com interface `{ categories, loading, error, refetch, create, update, remove }`. O hook SHALL fazer fetch no mount, cache em memória via `useState` e revalidar após cada mutação.

#### Scenario: Mutação bem-sucedida revalida cache

- **WHEN** o consumidor chama `create({ label: 'RH' })` e a API responde `201`
- **THEN** `categories` passa a incluir a nova entrada sem necessidade de refresh manual

#### Scenario: Fallback em caso de erro da API

- **WHEN** `GET /api/company-documents/categories` falha ou retorna 500
- **THEN** `error` é definido e `categories` retorna o array fallback com as 9 categorias hardcoded legadas
- **AND** a UI continua funcional em modo read-only
