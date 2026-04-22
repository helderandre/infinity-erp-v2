## 1. Base de Dados

- [x] 1.1 Escrever migration `supabase/migrations/20260422_company_document_categories.sql` com `create table company_document_categories` (colunas conforme `design.md` §1), unique em `slug`, check constraint `slug ~ '^[a-z0-9-]+$'`, índice parcial em `sort_order where is_active`.
- [x] 1.2 Na mesma migration, inserir seed das 9 categorias actuais com `is_system=true`, `is_active=true`, `sort_order` 10/20/…/90 e labels exactos do `CATEGORIES` actual (`Angariação`, `Institucionais`, `Cliente`, `Contratos`, `KYC`, `Fiscal`, `Marketing`, `Formação`, `Outros`).
- [x] 1.3 Na mesma migration, `alter table company_documents add column category_id uuid references company_document_categories(id) on delete set null` + backfill `update company_documents cd set category_id = c.id from company_document_categories c where cd.category = c.slug`. Também `drop constraint if exists company_documents_category_check` para destrancar o enum hardcoded.
- [x] 1.4 Criar trigger `trg_company_doc_categories_updated_at` em `company_document_categories` (novo; segue o mesmo padrão dos triggers existentes no módulo documentos).
- [x] 1.5 Aplicada via MCP Supabase (`apply_migration`). Confirmado: 9 categorias seed com `is_system=true` + 8/8 documentos com `category_id` preenchido pelo backfill.
- [x] 1.6 Types regenerados via `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts`. `company_document_categories` presente em `Row`/`Insert`/`Update`.

## 2. API — Listagem e CRUD

- [x] 2.1 `app/api/company-documents/categories/route.ts` criado com `GET` (auth-only, ordenado `sort_order` asc + `label` asc) e `POST` (requer `settings`, Zod valida `{ label, icon?, color?, sort_order? }`, server-side `slugifyCategory(label)`, 409 em conflito de slug, auditoria em `log_audit`).
- [x] 2.2 `app/api/company-documents/categories/[id]/route.ts` criado com `PUT` (payload parcial `strict`; `is_system=true` rejeita `is_active=false`; `slug` rejeita 400 se presente no payload) e `DELETE` (soft delete; bloqueia `is_system=true`; conta `company_documents` activos por `category_id` OR `category slug` e retorna 409 sem `reassign_to`; com `reassign_to` faz update + soft delete; auditoria).
- [x] 2.3 `lib/company-documents/slugify.ts` criado — `slugifyCategory()` normaliza acentos PT-PT (NFD + strip combining marks) e aplica `^[a-z0-9-]+$` com limite 64 chars.
- [x] 2.4 `app/api/company-documents/upload/route.ts` actualizado: valida slug contra `company_document_categories` (400 "Categoria inválida"/"Categoria inactiva") e grava `category_id` no insert.
- [x] 2.5 `app/api/company-documents/[id]/route.ts` (PUT) actualizado: valida `category` up-front (antes do upload a R2) via helper `resolveCategory()` e sincroniza `category_id`.
- [x] 2.6 `app/api/company-documents/route.ts` (GET) actualizado: aceita `category_id` query param alternativa a `category` (prioridade: `category_id` se presente).
- [x] 2.7 `lib/auth/check-permission-server.ts` criado — `hasPermissionServer()` verifica `user_roles.roles.permissions` com bypass para `ADMIN_ROLES`. Usado em POST/PUT/DELETE das categorias.

## 3. Hook e estado partilhado

- [x] 3.1 `hooks/use-company-document-categories.ts` criado: `{ categories, loading, error, refetch, create, update, remove }`, fetch no mount, cache `useState`, revalidate após cada mutação, fallback hardcoded das 9 categorias legadas em caso de erro da API.
- [x] 3.2 `components/documents/company-categories-provider.tsx` criado: Context com `activeCategories`, `canManage` (via `usePermissions('settings')`), `getLabel`, `getCategory` + mutações.
- [x] 3.3 `BibliotecaPage` em [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) envolvida em `<CompanyCategoriesProvider>` via novo wrapper `BibliotecaPageContent`.

## 4. Componentes reutilizáveis

- [x] 4.1 `components/documents/company-category-select.tsx` — `<Select>` do shadcn que lê do provider e mostra apenas categorias activas ordenadas. **Revisado após feedback do utilizador:** sem item "+ Nova categoria…" dentro da dropdown.
- [x] 4.2 `components/documents/company-category-form-dialog.tsx` — campos Nome + **galeria de 10 ícones Lucide** (Folder, Scale, Shield, Building2, Users, BookOpen, Briefcase, Receipt, Megaphone, FileText) via `components/documents/company-category-icons.tsx` + Cor (color input + botão Limpar). Modo `create`/`edit`. **`sort_order` removido do formulário** — auto-atribuído server-side como `max+10`. Slug continua imutável em edição.
- [x] 4.3 `components/documents/company-category-delete-dialog.tsx` — `AlertDialog` que, ao receber 409 com `document_count>0`, alterna para modo "transferir" com `<Select>` das categorias-alvo e re-submete `DELETE` com `reassign_to`. Reset por callback (sem `useEffect` com setState).
- [x] 4.4 `components/documents/company-category-section-header.tsx` — cabeçalho com ícone (`CategoryIcon` resolvido do `icon` e `color` da categoria), label, contador. **Novo:** botão `+` sempre visível para adicionar documento via `onAddDocument(category)`. Menu `…` (Editar/Eliminar) condicionado por `canManage` + protecção de `is_system` (não mostra Eliminar).
- [x] 4.5 **Novo (feedback do utilizador):** `components/documents/company-category-add-button.tsx` — botão dedicado `+ Nova categoria` fora da dropdown, visível só se `canManage`.

## 5. Refactor da página `/dashboard/documentos`

- [x] 5.1 `const CATEGORIES: Record<string, string>` removido. Todos os lookups passam por `getLabel(slug)` do provider.
- [x] 5.2 As duas `<Select>` de categoria (filtro + upload) substituídas por `<CompanyCategorySelect>` + `<CompanyCategoryAddButton>` lado-a-lado.
- [x] 5.3 `<h3>` de cabeçalho de grupo substituído por `<CompanyCategorySectionHeader>` com handlers para `onEdit`, `onDelete` e `onAddDocument` (este último abre o diálogo de upload com a categoria pré-seleccionada).
- [x] 5.4 Grupos órfãos: documentos cujo `category` não existe na tabela aparecem sob label "sem categoria · <slug>" via lookup `getCategory()` que retorna `undefined` + badge.
- [x] 5.5 No preview dialog: `CATEGORIES[doc.category]` → `getLabel(doc.category)`.
- [x] 5.6 Pré-selecção: `pendingCategoryTarget` ∈ `'filter' | 'upload' | 'edit'` — ao criar, o slug novo é aplicado ao target correcto. Adicionar documento via section header faz `setUploadCategory(slug); setUploadOpen(true)`.
- [x] 5.7 **Sincronização (feedback do utilizador):** `uploadCategory` passa a reagir a mudanças em `activeCategories` — se a categoria seleccionada deixar de existir (foi desactivada ou renomeada noutra sessão), é substituída pela primeira disponível.

## 6. Auditoria e permissões

- [x] 6.1 `log_audit` inserida em `POST`, `PUT`, `DELETE` com `entity_type='company_document_category'`, `old_data` + `new_data` (DELETE inclui `reassigned` count).
- [x] 6.2 Permissão `settings` validada server-side nos três handlers via `hasPermissionServer()` — 403 caso contrário.
- [x] 6.3 `canManage` exposto no provider. UI esconde botão `+ Nova categoria`, item "+" em dropdown antigas e menu `…` quando `!canManage`.

## 7. Testes manuais (para o utilizador)

- [ ] 7.1 Login como Broker/CEO: clicar **+ Nova categoria** ao lado do filtro → escolher ícone **Scale** + cor vermelha + nome "Jurídico" → confirmar que aparece no filtro com ícone colorido.
- [ ] 7.2 Clicar no `+` do cabeçalho "Jurídico" → diálogo de upload abre com "Jurídico" pré-seleccionado → carregar PDF → confirmar que aparece agrupado.
- [ ] 7.3 Renomear "Jurídico" → "Legal" via menu `…` do cabeçalho → confirmar que documentos existentes mantêm-se agrupados (slug inalterado) e a label nova aparece em todos os sítios (filtro, cabeçalho, preview, edit dialog).
- [ ] 7.4 Tentar eliminar "Legal" com documentos → confirmar `AlertDialog` com re-categorização; escolher "Outros" → confirmar 200 + re-categorização + soft delete.
- [ ] 7.5 Login como Consultor (sem `settings`): confirmar que o botão "+ Nova categoria" não aparece, cabeçalhos não têm menu `…`, o `+` para adicionar documento continua disponível (permissão `documents`), e endpoints de mutação retornam 403 via DevTools.
- [ ] 7.6 Tentar eliminar categoria `is_system=true` via DevTools (`DELETE /api/company-documents/categories/<id>`): confirmar 409.
- [ ] 7.7 Criar documento com `category='slug-inexistente'` via SQL directo → confirmar que aparece como "sem categoria · <slug>" e que o edit dialog permite re-categorizar.

## 8. Finalização

- [x] 8.1 ESLint limpo nos novos componentes (`components/documents/company-category-*`, `hooks/use-company-document-categories.ts`).
- [x] 8.2 `npx tsc --noEmit` sem erros nos ficheiros novos/tocados. (Existem 2 erros pré-existentes em `documentos/page.tsx` fora do âmbito desta change.)
- [x] 8.3 Actualizada [CLAUDE.md](CLAUDE.md) secção "Estado Actual" com bullet detalhado "Categorias dinâmicas em `company_documents` (ENTREGUE via `add-company-document-categories`)".
- [ ] 8.4 Arquivar change com `/opsx:archive` após validação do utilizador.
