## 1. Database migration

- [x] 1.1 Create migration `acessos_custom_sites_init`: table, CHECK constraint (`scope⇔owner_id`), indexes (`owner_id WHERE scope='personal'`, `(scope, is_active)`), `updated_at` trigger (reuse existing `set_updated_at()` or add inline)
- [x] 1.2 Enable RLS + policies (authenticated SELECT with `scope='global' OR owner_id=auth.uid()`, authenticated INSERT/UPDATE/DELETE — authorization enforced in API)
- [x] 1.3 Seed the 4 system-global rows (ChatGPT, Canva, WhatsApp Web, Monday.com) with `is_system=true, scope='global', owner_id=null`
- [x] 1.4 Apply migration via Supabase MCP and confirm `SELECT count(*) WHERE is_system=true` returns 4
- [x] 1.5 Regenerate `types/database.ts` with `npx supabase gen types typescript`

## 2. Validation + shared lib

- [x] 2.1 Create `lib/validations/acessos-custom-site.ts` with Zod schemas `createSiteSchema` (title, url, scope, icon?) and `updateSiteSchema` (partial of editable fields), including URL normalization helper that prepends `https://` when scheme is missing
- [x] 2.2 Add TypeScript type alias `AcessosCustomSite` (re-export from `types/database.ts`) + a `HydratedSite` view type for UI (adds `canEdit: boolean`, `canDelete: boolean` computed server-side — optional but preferred)

## 3. API — list + create

- [x] 3.1 Create `app/api/acessos/custom-sites/route.ts` GET handler: auth required (401), query `scope='global' OR owner_id=auth.uid()` with `is_active=true`, ordered by `scope DESC` (global first because `'global' > 'personal'` is false — use explicit CASE or prepend `scope='global'` sort), then `sort_order ASC`, `created_at ASC`
- [x] 3.2 Same file POST handler: parse Zod, if `scope='global'` call `hasPermissionServer(_, 'settings')` → 403 if false; force `owner_id=null|auth.uid()` based on scope; force `is_system=false`; insert; write `log_audit` with `entity_type='acessos_custom_site', action='acessos_custom_site.create'`

## 4. API — edit + delete

- [x] 4.1 Create `app/api/acessos/custom-sites/[id]/route.ts` PUT handler: fetch row, authorize (owner for personal / `settings` for global → else 403); whitelist editable fields (title, url, icon, sort_order); ignore scope/owner_id/is_system/created_by; update; `log_audit` `action='acessos_custom_site.update'`
- [x] 4.2 Same file DELETE handler: fetch row, reject 403 if `is_system=true`; authorize as in PUT; hard delete; `log_audit` `action='acessos_custom_site.delete'`
- [x] 4.3 Both handlers return `404` when the row does not exist; `401` when unauthenticated

## 5. Hook + types on client

- [x] 5.1 Create `hooks/use-acessos-custom-sites.ts`: exposes `{ sites, isLoading, refetch, canManageGlobal }`. `canManageGlobal` comes from `usePermissions()` checking `settings`
- [x] 5.2 Hook returns sites grouped as `{ global: AcessosCustomSite[], personal: AcessosCustomSite[] }` OR a flat sorted array + helper; pick whichever yields the simplest render

## 6. UI — dialog component

- [x] 6.1 Create `components/acessos/custom-site-dialog.tsx`: shadcn `Dialog` with `Input` title, `Input` url, conditional `ToggleGroup` scope (rendered only when `canManageGlobal`), "Cancelar" / "Guardar"; React Hook Form + Zod resolver
- [x] 6.2 Dialog supports create (`initialData=null`) and edit (`initialData=site`); submit calls POST or PUT; toast success/error; calls `onSaved()` which triggers `refetch()` on parent

## 7. UI — "Outros" sub-tab wiring

- [x] 7.1 In `app/dashboard/acessos/page.tsx`: remove `outros` key from `WEBSITES` constant (keep `microsir` and `casafari` untouched)
- [x] 7.2 In `WebsitesContent`, add branch: when `subTab === 'outros'` render a new `OutrosContent` subcomponent that uses `useAcessosCustomSites()` instead of `section.links`
- [x] 7.3 `OutrosContent`: header row with "+ Adicionar site" button → opens `CustomSiteDialog` in create mode; grid identical to current (3 cols) of enhanced `<LinkCard>` with actions; empty state with CTA when list is empty
- [x] 7.4 Extend `<LinkCard>` (or wrap it) to accept optional `actions?: ReactNode` rendered as a `DropdownMenu` trigger (`MoreHorizontal`) in the top-right; render `<Badge>Sistema</Badge>` when `is_system=true` instead of the menu
- [x] 7.5 Wire menu actions: "Editar" → opens `CustomSiteDialog` in edit mode; "Eliminar" → opens `AlertDialog` confirmation → DELETE + refetch
- [x] 7.6 Compute per-row `canEdit` / `canDelete` in the hook or inline: `site.scope==='personal' && site.owner_id===user.id` OR `site.scope==='global' && canManageGlobal && !site.is_system`

## 8. Verification

- [ ] 8.1 Manual smoke test (dev server): user without `settings` → vê 4 cards system + pode criar pessoal + não vê toggle Global + não vê menu em cards globais
- [ ] 8.2 Manual smoke test: admin com `settings` → pode criar global + editar globais não-system + NÃO consegue apagar system (UI não mostra Eliminar + API rejeita 403 se forçado)
- [ ] 8.3 Manual smoke test: tentar PUT com `{scope:'global'}` num site pessoal via `curl` ou DevTools → confirma que a response ignora o campo
- [ ] 8.4 Manual smoke test: apagar um consultor → confirma que sites pessoais dele desaparecem (CASCADE)
- [ ] 8.5 Confirmar que `log_audit` tem entradas para create/update/delete com `entity_type='acessos_custom_site'`
- [ ] 8.6 Confirmar que os sub-tabs **MicroSIR** e **Casafari** continuam visuais e funcionalmente idênticos (sem regressão)

## 9. Docs

- [x] 9.1 Actualizar `CLAUDE.md` na secção "Estado Actual do Projecto" com bullet "Custom websites no sub-tab Outros (ENTREGUE via `add-acessos-custom-websites`)"
- [ ] 9.2 Após merge, arquivar a change com `/opsx:archive add-acessos-custom-websites`
