## Why

A biblioteca em `/dashboard/documentos` usa um dicionário **hardcoded** de categorias (`CATEGORIES` em [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) — `angariacao`, `institucional`, `cliente`, `contratos`, `kyc`, `fiscal`, `marketing`, `formacao`, `outro`). Para adicionar/renomear/reordenar uma categoria, um developer precisa de editar o código e fazer deploy. Administradores (Broker/CEO, Office Manager) não têm forma de ajustar a taxonomia da empresa à medida que novos domínios documentais aparecem (ex.: "Jurídico", "RH", "Compliance").

A UI já tem uma *dropdown* de categorias (capturada no screenshot do utilizador) e botões por linha de documento (download / `…`), mas não há ponto de entrada para **criar nova categoria** nem para **criar documento dentro de uma categoria nova**. O objectivo é eliminar o hardcode e dar aos admins controlo total sobre a taxonomia sem tocar no código.

## What Changes

- **DB:** nova tabela `company_document_categories` (`id`, `slug`, `label`, `icon`, `color`, `sort_order`, `is_system`, `is_active`, `created_by`, `created_at`, `updated_at`). Seed das 9 categorias actuais com `is_system=true` (protegidas contra delete).
- **DB:** `company_documents.category` continua `text` (slug), mas passa a ter FK lógica validada via API (sem constraint rígida para permitir soft-delete de categorias legadas). Nova coluna `category_id uuid` nullable preenchida por migration a partir do slug.
- **API novo:** `GET/POST /api/company-documents/categories` — listar (ordenadas por `sort_order`) e criar. `PUT/DELETE /api/company-documents/categories/[id]` — editar/desactivar. Criar/editar/eliminar exige permissão `settings` (admin). Listar exige apenas autenticação.
- **UI:** botão dedicado **"+ Nova categoria"** (com ícone) ao lado do dropdown de categoria (no filtro e no diálogo de upload) que abre `CategoryFormDialog`. Campos: Nome + **galeria de 10 ícones Lucide** predefinidos (Folder, Scale, Shield, Building2, Users, BookOpen, Briefcase, Receipt, Megaphone, FileText) + Cor. Após guardar, a categoria fica seleccionada automaticamente. Sem campo de ordem de apresentação (auto-atribuída server-side).
- **UI:** junto ao cabeçalho de cada categoria na listagem agrupada, adicionar botão **"+"** (sempre visível) para criar documento nessa categoria — abre o diálogo de upload com a categoria pré-seleccionada. Admins com `settings` vêem adicionalmente menu `…` com **Editar** e **Eliminar** (soft delete — bloqueia se tiver documentos; sugere re-categorizar).
- **Refactor:** `CATEGORIES` hardcoded removido — substituído por hook `useCompanyDocumentCategories()` com cache + SWR-style revalidate. `MarketingTemplatesTab` e outras superfícies que importassem o mapa passam a consumir o hook.
- **Permissões:** criar/editar/eliminar categoria requer `roles.permissions.settings === true`. Consultores vêem mas não editam.
- **Auditoria:** cada CRUD em `company_document_categories` gera linha em `log_audit` (`entity_type='company_document_category'`).

Não inclui: categorização por domínio (properties/leads/negocios — essas já têm `doc_types` + `domain-configs.ts` dinâmicos), nem migração da biblioteca de templates de email/documento (`tpl_email_library`, `tpl_doc_library` — âmbito diferente).

## Capabilities

### New Capabilities
- `company-document-categories`: CRUD de categorias de documentos da empresa (`company_document_categories`), com sistema de seeds protegidos, permissões, auditoria e integração com a página `/dashboard/documentos` (filtros, upload, listagem agrupada, edição inline).

### Modified Capabilities
<!-- Nenhuma capability existente tem requisitos afectados — `document-folders-ui` e `document-send` tratam de pastas por doc_type ao nível de domínio (imóveis/leads/negócios), não da biblioteca `company_documents`. -->

## Impact

- **Schema DB:** nova tabela `company_document_categories` + coluna `category_id` em `company_documents` + seed + backfill.
- **Páginas:** [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) — refactor substancial do `DocumentosTab` (dropdowns + cabeçalhos de secção + diálogo de upload + novo diálogo de categoria).
- **API novas:** `app/api/company-documents/categories/route.ts`, `app/api/company-documents/categories/[id]/route.ts`.
- **API existentes:** `app/api/company-documents/route.ts` (filtro aceita também `category_id`), `app/api/company-documents/upload/route.ts` (validar slug contra tabela), `app/api/company-documents/[id]/route.ts` (editar aceita novo slug).
- **Novos componentes:** `components/documents/company-category-select.tsx` (dropdown limpo), `components/documents/company-category-add-button.tsx` (botão "+ Nova categoria" autónomo), `components/documents/company-category-icons.tsx` (catálogo de 10 ícones Lucide), `components/documents/company-category-form-dialog.tsx` (galeria de ícones + cor), `components/documents/company-category-delete-dialog.tsx`, `components/documents/company-category-section-header.tsx` (com botão `+` para adicionar documento + menu `…` editar/eliminar).
- **Novo hook:** `hooks/use-company-document-categories.ts`.
- **Permissões:** reutiliza `settings` de `roles.permissions` — nenhuma nova chave.
- **Sem breaking changes externos:** consumidores da API que passam `category=slug` continuam a funcionar (slugs legados mantidos).
