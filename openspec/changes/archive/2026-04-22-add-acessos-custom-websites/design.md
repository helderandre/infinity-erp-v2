## Context

O tab **Websites** em `/dashboard/acessos` tem 3 sub-tabs (MicroSIR, Casafari, Outros). Hoje os 3 são arrays hardcoded em `WEBSITES` dentro de [app/dashboard/acessos/page.tsx](app/dashboard/acessos/page.tsx):

```ts
const WEBSITES = {
  microsir: { label, login, password, links: [{title, url}] },
  casafari: { label, links: [...] },
  outros:   { label, links: [{title:'ChatGPT', url}, {title:'Canva', ...}, ...] },
}
```

MicroSIR e Casafari são específicos do negócio (têm credenciais fixas partilhadas) e não precisam de CRUD. O sub-tab **Outros** junta ferramentas genéricas que os consultores usam no dia-a-dia — é aí que cada pessoa quer acrescentar as suas ferramentas sem pedir a um dev.

Já existe precedente na codebase para este padrão "global vs personal":
- `marketing_design_templates` (global, scope) vs `agent_personal_designs` (personal) — ambas documentadas no CLAUDE.md secção "Designs de Marketing".
- `tpl_email_library` com colunas `scope`/`scope_id`/`is_system` (cascata 3 camadas) — padrão das Contact Automations.
- `user_links` (tabela pessoal por `user_id`) + API `/api/user-links` — usado no tab "Os Meus Links" da própria página de acessos.

## Goals / Non-Goals

**Goals:**
- Consultor autenticado consegue adicionar/editar/remover os seus próprios sites no sub-tab Outros sem passar por um developer.
- Utilizador com `roles.permissions.settings=true` consegue curar a lista **global** visível a toda a equipa.
- Seed dos 4 sites actuais (ChatGPT, Canva, WhatsApp Web, Monday.com) fica protegido contra delete via `is_system=true`, garantindo que ninguém parte o estado inicial.
- Zero regressão visual: grid 3-colunas responsive continua igual; LinkCard mantém o mesmo look com ícone de link externo.

**Non-Goals:**
- Não mexer nos sub-tabs **MicroSIR** e **Casafari** — continuam hardcoded com credenciais (é uma abstracção diferente, justifica um change separado se alguma vez for preciso).
- Não adicionar categorias/tags nos sites custom — é uma lista plana ordenada.
- Não suportar upload de favicon custom — `icon` continua a ser o ícone genérico `ExternalLink` do Lucide (futuro: podemos ir buscar favicon via `https://www.google.com/s2/favicons?domain=…`, mas fora de escopo).
- Não unificar com `user_links` da tab "Os Meus Links" — essa tab tem um propósito distinto (bookmarks pessoais globais) e a sua UI já existe. Manter separado evita migração desnecessária.
- Não adicionar drag-and-drop para reordenar — `sort_order` existe no schema mas na v1 a ordem de inserção basta (ordenamos por `sort_order ASC, created_at ASC`).

## Decisions

### 1. Tabela única `acessos_custom_sites` com coluna `scope` discriminante

Alternativas consideradas:
- **A) Duas tabelas separadas** (`acessos_global_sites` + `acessos_personal_sites`) — mais explícito mas duplica colunas idênticas e obriga a UNION na API.
- **B) Tabela única com `scope` + `owner_id` nullable** ← escolhida.
- **C) Reutilizar `user_links` + adicionar coluna `is_global`** — mistura semântica (os "Os Meus Links" são bookmarks gerais, estes são sites do sub-tab Outros; também implicaria filtrar com um flag em dois sítios).

Porquê B: alinha com o padrão `tpl_email_library(scope, scope_id, is_system)` já existente no codebase, API é um único `SELECT … WHERE scope='global' OR (scope='personal' AND owner_id=$user)`, e o `CHECK` constraint garante consistência (`scope='global' → owner_id IS NULL`).

```sql
CREATE TABLE acessos_custom_sites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL CHECK (scope IN ('global','personal')),
  owner_id     uuid REFERENCES dev_users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  url          text NOT NULL,
  icon         text,
  sort_order   int NOT NULL DEFAULT 0,
  is_system    boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES dev_users(id) ON DELETE SET NULL,
  CHECK (
    (scope = 'global' AND owner_id IS NULL) OR
    (scope = 'personal' AND owner_id IS NOT NULL)
  )
);
CREATE INDEX idx_acessos_custom_sites_owner ON acessos_custom_sites(owner_id) WHERE scope = 'personal';
CREATE INDEX idx_acessos_custom_sites_scope_active ON acessos_custom_sites(scope, is_active);
```

### 2. Autorização server-side, sem RLS complexa

Alternativas:
- **A) RLS policies** para `SELECT`, `INSERT`, `UPDATE`, `DELETE` discriminando por `scope`.
- **B) RLS simples (auth only) + checks na API** ← escolhida.

Porquê B: o resto da codebase (ex.: `company_document_categories`) usa o mesmo helper `hasPermissionServer(supabase, userId, 'settings')` em vez de policies. Manter o padrão. RLS fica em "authenticated users can select/insert/update/delete" e a API faz:
- GET: `scope='global' OR (scope='personal' AND owner_id=$user)`.
- POST (scope=global): 403 se `!hasPermissionServer(_, 'settings')`.
- POST (scope=personal): força `owner_id = auth.uid()`.
- PUT/DELETE: busca o registo, 403 se `(scope='global' && !canSettings) || (scope='personal' && owner_id !== uid)`. DELETE bloqueia 403 se `is_system=true`.

### 3. Migração dos 4 sites hardcoded — seed `is_system=true`

Remover o array `WEBSITES.outros.links` do código e inserir via migração os 4 sites como `scope='global', is_system=true, created_by=NULL`. Se por algum motivo a migração falhar ou a tabela ficar vazia, a UI mostra apenas "Empty state" — **não** há fallback hardcoded. Justificação: evita dois códigos de verdade que ficam dessincronizados.

Rollback: a migração é reversível via `DROP TABLE`, mas após remover do código o fallback não existe. Se for preciso reverter, o PR que remove o array hardcoded tem de ser revertido em conjunto.

### 4. UI — reutilizar `LinkCard` + adicionar acção opcional

O `LinkCard` actual em `acessos/page.tsx` é um `<a target="_blank">` puro. Adicionar uma prop opcional `actions?: ReactNode` que renderiza um `DropdownMenu` com `MoreHorizontal` no canto superior direito do card (pattern já usado em `company-document-categories`). Quando `actions` não é passada, o card fica igual ao actual. Para sites `is_system=true` mostramos um `<Badge>Sistema</Badge>` em vez do menu.

### 5. Diálogo de criação/edição

Novo componente `components/acessos/custom-site-dialog.tsx`:
- Campos: `title` (obrigatório), `url` (obrigatório, valida começar por `http://`/`https://` — adiciona `https://` automaticamente se faltar, igual ao `/api/user-links`).
- Toggle `Scope`: `Pessoal | Global` (só aparece se `canManageGlobal`). Default: `Pessoal`.
- Reutilizado para edição passando `initialData` prop (quando null → create mode).
- Validação Zod partilhada com a API (lib/validations/acessos-custom-site.ts).

## Risks / Trade-offs

- **[Risco] Consultor apaga acidentalmente site pessoal** → Mitigação: `AlertDialog` de confirmação com "Tem a certeza?" antes do DELETE, idem ao padrão `company-document-categories`.
- **[Risco] Admin apaga site global que outros consultores achavam útil** → Mitigação: exigir `settings`, registar em `log_audit`, e impedir delete de `is_system=true`. Não impedimos delete de globais não-system — se for um problema real, podemos adicionar soft-delete (`is_active=false`) em vez de hard-delete num change futuro.
- **[Trade-off] Sem reordenação UI na v1** → `sort_order` fica como 0 por defeito e ordenamos por `created_at` como tie-breaker. Se os sites ficarem muitos e a ordem importar, adicionamos drag-and-drop (@dnd-kit já instalado) num follow-up.
- **[Trade-off] URL não é normalizado agressivamente** → só garantimos o prefixo `https://`. Não removemos tracking params nem validamos que o host resolve. Suficiente para MVP.

## Migration Plan

1. **Migração SQL** (reversível):
   - `CREATE TABLE acessos_custom_sites` + constraints + índices.
   - RLS: `ENABLE ROW LEVEL SECURITY` + 4 policies (SELECT authenticated: `scope='global' OR owner_id=auth.uid()`; INSERT/UPDATE/DELETE authenticated true — authorization fica na API).
   - Seed dos 4 sites globais `is_system=true`.
2. **API**: criar `app/api/acessos/custom-sites/route.ts` (GET, POST) + `[id]/route.ts` (PUT, DELETE) com Zod + `hasPermissionServer`.
3. **UI**: remover `WEBSITES.outros.links` hardcoded, criar hook `hooks/use-acessos-custom-sites.ts` (fetch + refetch), criar `CustomSiteDialog`, actualizar `WebsitesContent` para renderizar `section.links` para microsir/casafari (inalterado) e a lista dinâmica para outros.
4. **Types**: regenerar `types/database.ts` (`npx supabase gen types…`).
5. **Deploy**: sem downtime — a migração é aditiva, e enquanto o código antigo estiver em produção o array hardcoded continua a funcionar (o código novo só lê da DB).

**Rollback:** `DROP TABLE acessos_custom_sites CASCADE` + revert do PR do código.

## Open Questions

- Confirmação visual se o utilizador quiser **desactivar** (vs eliminar) um site global system — na v1 só é possível ocultar temporariamente no Supabase; UI não expõe toggle `is_active`. OK manter assim?
- Os "globais" devem ser visíveis mesmo para consultores inactivos (`dev_users.is_active=false`)? Actualmente sim, porque auth middleware já bloqueia esses logins.
