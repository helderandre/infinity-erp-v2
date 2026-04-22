## 1. Database migration

- [x] 1.1 Create migration file `supabase/migrations/20260423_marketing_design_categories.sql`
- [x] 1.2 Add `CREATE TABLE marketing_design_categories` (id, slug UNIQUE CHECK, label, icon, color, sort_order, is_system, is_active, created_by FK, timestamps) + `CREATE INDEX idx_mkt_design_cats_order ON (sort_order) WHERE is_active` — CHECK relaxed to `^[a-z0-9_-]+$` so the legacy `redes_sociais` slug passes
- [x] 1.3 Add `updated_at` BEFORE UPDATE trigger reusing `trg_company_docs_updated_at()`
- [x] 1.4 Seed 8 system categories: placas (10), cartoes (20), badges (30), assinaturas (40), relatorios (50), estudos (60), redes_sociais (70), outro (80) with `is_system=true`
- [x] 1.5 `ALTER TABLE marketing_design_templates ADD COLUMN category_id UUID REFERENCES marketing_design_categories(id) ON DELETE SET NULL`
- [x] 1.6 Backfill: 17/17 template rows linked (`category_id` non-null for all existing rows)
- [x] 1.7 `ALTER TABLE marketing_design_templates DROP CONSTRAINT marketing_design_templates_category_check`
- [x] 1.8 `CREATE INDEX idx_mdt_category_id ON marketing_design_templates(category_id) WHERE is_active = true`
- [x] 1.9 `CREATE TABLE agent_personal_designs` with CHECK `(file_path IS NOT NULL OR canva_url IS NOT NULL)`
- [x] 1.10 Add indexes on `agent_id` and `(agent_id, category_id)` + `updated_at` trigger
- [x] 1.11 Enable RLS on both new tables; add SELECT policies (authenticated for categories; `agent_id = auth.uid()` OR admin role / `settings` permission for personal designs) + service-role ALL policies
- [x] 1.12 Run migration via Supabase MCP and confirmed `SELECT count(*) FROM marketing_design_categories WHERE is_system=true` returns 8

## 2. Shared lib helpers

- [x] 2.1 `slugifyCategory` imported directly from `@/lib/company-documents/slugify` in API handlers (no wrapper — task 2.1's "or" branch)
- [x] 2.2 `lib/marketing/kit-category-map.ts` created with `KIT_CATEGORY_TO_DESIGN_SLUG` + TypeScript union types (`KitCategorySlug` / `DesignCategorySlug`) + `resolveKitDesignSlug()` helper with `outro` fallback
- [x] 2.3 Skipped — project has no test framework (no vitest/jest). Correctness enforced at compile time via exhaustive `Record<KitCategorySlug, DesignCategorySlug>` typing

## 3. API — marketing design categories CRUD

- [x] 3.1 Created `app/api/marketing/design-categories/route.ts` with `GET` + `POST` (settings perm, slug auto via `slugifyCategory`, `sort_order = max+10`, 409 on dup, audit log)
- [x] 3.2 Created `app/api/marketing/design-categories/[id]/route.ts` with `PUT` + `DELETE`. DELETE counts designs across both `marketing_design_templates` AND `agent_personal_designs`; reassign updates both (templates get `category`+`category_id`, personal get `category_id` only)
- [x] 3.3 Zod schemas identical shape to company-docs (label 1..80, icon ≤40, hex color, strict on update)
- [ ] 3.4 Manual test via `curl` — deferred to Stage 12 dev-server run-through

## 4. API — design templates validation update

- [x] 4.1 `POST /api/marketing/design-templates` now validates via `resolveActiveDesignCategory()` — 400 "Categoria inválida" on unknown/inactive slug
- [x] 4.2 Handler resolves the category and writes both `category` (slug) and `category_id` (UUID) columns
- [x] 4.3 `PUT /api/marketing/design-templates/[id]` applies the same validation + dual-write when `category` is present in body
- [x] 4.4 GET handler unchanged (already returns `category` slug)

## 5. API — personal designs

- [x] 5.1 `GET` lists (joined with category) + signs URLs; `POST` (JSON) creates link-only design via `resolveActiveDesignCategory`. Actor check: owner OR `settings`
- [x] 5.2 `/upload` multipart: size caps by mime (10MB images / 100MB PDF / 10MB thumb), disallowed extensions rejected 400, storage rollback on DB failure. Image files reuse themselves as `thumbnail_path` when no separate thumbnail is provided
- [x] 5.3 `[designId]/route.ts` PUT (partial) + DELETE (remove bucket paths then row) with 404 when not owned
- [x] 5.4 `lib/marketing/personal-designs-storage.ts` with `uploadToBucket`, `signUrls`, `removeFromBucket`, mime whitelist, size limits, `sizeErrorForMime`, `sanitizeName`

## 6. Shared hooks & provider

- [x] 6.1 `hooks/use-marketing-design-categories.ts` with fallback seed + create/update/remove (surfaces `design_count` on 409)
- [x] 6.2 `components/marketing/design-categories/marketing-design-categories-provider.tsx` exposes `canManage`, `getLabel`, `getCategory`, `getCategoryById`, `activeCategories`, plus CRUD
- [x] 6.3 `hooks/use-personal-designs.ts` with `uploadDesign` (multipart), `createLinkDesign` (JSON), `updateDesign`, `deleteDesign`, refetch

## 7. Shared UI components — categories

- [x] 7.1 `MarketingDesignCategorySelect` — identical API to `CompanyCategorySelect`
- [x] 7.2 `MarketingDesignCategoryAddButton` — identical API to `CompanyCategoryAddButton`
- [x] 7.3 `MarketingDesignCategoryFormDialog` — reuses `CATEGORY_ICON_PRESETS` + `CategoryIcon` directly from `components/documents/company-category-icons.tsx`
- [x] 7.4 `MarketingDesignCategoryDeleteDialog` — 409 → reassign flow (error surfaces `designCount`)
- [x] 7.5 `MarketingDesignCategorySectionHeader` — icon + colour + count + optional add-button + admin dropdown

## 8. UI — personal design components

- [x] 8.1 `components/marketing/personal-design-card.tsx` with hover Edit/Delete + thumbnail fallback
- [x] 8.2 `components/marketing/personal-design-form-dialog.tsx` with client-side cap enforcement (10MB image / 100MB PDF / 10MB thumb, localized toasts) + inline category creation
- [x] 8.3 `components/marketing/personal-design-preview-dialog.tsx` with iframe/PDF, image, fallback to Canva link, download button

## 9. UI — integrate into /dashboard/documentos

- [x] 9.1 `<MarketingDesignCategoriesProvider>` wraps `<MarketingTemplatesTab />` in the tab-switch branch
- [x] 9.2 `TeamDesignsTab` refactored: hardcoded maps removed, dynamic `MarketingDesignCategorySelect` + `MarketingDesignCategoryAddButton` in filter bar AND form dialog, `MarketingDesignCategorySectionHeader` replaces `<h3>`, `MarketingDesignCategoryFormDialog` + `MarketingDesignCategoryDeleteDialog` hooked with `pendingCategoryTarget` state
- [x] 9.3 `KitConsultorTab` now merges kit items + personal designs in the same grouped view: single filter bar (search + category filter + "+ Nova categoria" + "+ Adicionar design"), `MarketingDesignCategorySectionHeader` per group with `+` to add a personal design in that category, kit cards first then personal cards. Progress bar kept (kit-only). Personal form/preview/delete + category-create dialogs wired inline.
- [x] 9.4 `components/marketing/personal-designs-section.tsx` removed — its behaviour was folded into `KitConsultorTab`. Personal-design primitives (`PersonalDesignCard`, `PersonalDesignFormDialog`, `PersonalDesignPreviewDialog`, `usePersonalDesigns`) are consumed directly.

## 10. Permissions helper reuse

- [x] 10.1 `hasPermissionServer` exported from `lib/auth/check-permission-server.ts` already covers `'settings'` (PermissionKey union includes it); reused in both design-categories and personal-designs handlers

## 11. Audit & logging

- [x] 11.1 `log_audit` writes with `entity_type='marketing_design_category'` in all three mutation routes (POST/PUT/DELETE) — old_data/new_data populated on update, `new_data.reassigned` + `reassign_to` on delete
- [x] 11.2 Personal designs CRUD skips audit logging by design (user-owned workspace, noise concern)

## 12. Testing — manual dev-server run-through (user-executed)

- [ ] 12.1 Admin → Marketing > Designs da Equipa → create "Flyers" with Briefcase icon + colour → assign a design → rename → delete with reassign to `outro`
- [ ] 12.2 Non-admin consultor → no "+ Nova categoria"; no edit/delete menus on section headers
- [ ] 12.3 Consultor → Os meus designs → Kit grouped by dynamic categories, progress bar intact
- [ ] 12.4 Upload personal design (PNG) + create link-only (Canva); cross-agent cannot list (sign in as a second consultor)
- [ ] 12.5 Delete a personal design with file — verify bucket object gone via Supabase dashboard
- [ ] 12.6 12MB PNG → rejected ("Imagem demasiado grande (máx. 10MB)")
- [ ] 12.6.1 50MB PDF → accepted
- [ ] 12.6.2 110MB PDF → rejected ("PDF demasiado grande (máx. 100MB)")
- [ ] 12.7 POST design-template with `category="inexistente"` → 400 "Categoria inválida"

## 13. Docs & cleanup

- [x] 13.1 Added entry to `CLAUDE.md` under "Estado Actual do Projecto" (first section) documenting tables, APIs, storage paths, size limits, UI changes
- [x] 13.2 Removed from `app/dashboard/documentos/page.tsx`: `DESIGN_CATEGORIES`, `DESIGN_CATEGORY_ICONS`, unused shadcn `Select*` imports, unused `Filter` icon, unused `useRouter` import. Retained `KIT_CATEGORY_LABELS` (still used inside the Kit preview modal).
- [ ] 13.3 Archive this change via `/opsx:archive add-marketing-designs-workspace` once shipped and verified in production — user-triggered
