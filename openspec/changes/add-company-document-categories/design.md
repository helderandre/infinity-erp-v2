## Context

A biblioteca `company_documents` é usada em `/dashboard/documentos` como repositório partilhado de documentos da empresa (contratos-tipo, materiais institucionais, KYC, etc.). Hoje:

- **Taxonomia hardcoded** em [app/dashboard/documentos/page.tsx:52-62](app/dashboard/documentos/page.tsx#L52-L62) — objecto `CATEGORIES: Record<string, string>` com 9 entradas PT-PT.
- **Backend** ([app/api/company-documents/route.ts](app/api/company-documents/route.ts), [app/api/company-documents/upload/route.ts](app/api/company-documents/upload/route.ts)) aceita `category` como string livre — não valida contra enum ou tabela.
- **Storage R2**: chave inclui o slug da categoria — `documentos-empresa/{category}/{timestamp}-{sanitized}`.
- **Consumidores do mapa**: preview dialog (label), cabeçalhos agrupados, upload dialog, edit dialog. Todos lêem `CATEGORIES[slug]`.

A UI já suporta filtro por categoria, agrupamento por categoria na lista, upload com selector de categoria. Falta apenas o **CRUD de categorias** e tornar o mapa dinâmico. O utilizador final pretende adicionar categorias novas (ex.: "Jurídico", "RH") sem esperar por deploy, e criar documentos dentro dessas categorias novas.

Stakeholders: Broker/CEO, Office Manager (admins com `settings`), todos os consultores (leitura).

## Goals / Non-Goals

**Goals:**
- Admins com permissão `settings` podem criar, renomear, reordenar e desactivar categorias através da UI.
- Utilizadores sem `settings` vêem a nova taxonomia e carregam documentos em qualquer categoria activa.
- Categorias hardcoded actuais continuam a funcionar (seed com `is_system=true`, imutáveis em slug mas editáveis em label/ordem).
- Nenhum URL de R2 pré-existente deixa de resolver (slug R2 não muda se label mudar).
- Interacção idêntica à da dropdown actual (mesmo `<Select>` do shadcn) — só acrescenta rodapé **"+ Nova categoria…"** e, para admins, menu contextual `…` nos cabeçalhos de secção.
- Auditoria de todas as mutações (log_audit).

**Non-Goals:**
- Tornar dinâmicas as categorias de `doc_types` por domínio (properties/leads/negocios/processes) — essas já vivem em `components/documents/domain-configs.ts` e `doc_types.applies_to`, e têm outro fluxo (custom doc types).
- Permissões por categoria (ex.: só RH pode ver "RH"). Mantém-se o modelo actual: qualquer utilizador autenticado vê todos os documentos.
- Migrar categorias de `MarketingTemplatesTab` (templates de marketing têm taxonomia própria).
- Internacionalização — labels continuam PT-PT.
- Agrupamento hierárquico (subcategorias). Fica lista plana como hoje.

## Decisions

### 1. Tabela dedicada `company_document_categories` vs. enum vs. `doc_types`

**Escolha:** tabela nova `company_document_categories`.

**Alternativas consideradas:**
- **Enum Postgres.** Adicionar valor ao enum exige `ALTER TYPE`, que pesa e não é "user-editable" — falha o goal.
- **Reutilizar `doc_types`.** A tabela `doc_types` é per-documento (ex.: "CC Proprietário", "CPCV") com `applies_to` a domínios, não per-biblioteca. Misturar categorias de `company_documents` dilui a semântica e força `applies_to='company'` artificial. Além disso, `doc_types` já tem a sua coluna `category` (ex.: "Imóvel", "Proprietário") a que não queremos colidir.

Tabela nova mantém o modelo simples e isolado. Schema:

```sql
create table company_document_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  label       text not null,
  icon        text,                    -- nome Lucide opcional (ex.: 'FolderOpen')
  color       text,                    -- hex opcional (ex.: '#0ea5e9')
  sort_order  int  not null default 0,
  is_system   bool not null default false,
  is_active   bool not null default true,
  created_by  uuid references dev_users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on company_document_categories (sort_order) where is_active;
```

### 2. `company_documents.category` — FK rígida ou slug livre?

**Escolha:** manter `category text` (slug) + adicionar `category_id uuid` nullable com FK `on delete set null`. API valida slug contra tabela antes de insert.

**Porquê:**
- Chaves R2 já existentes (`documentos-empresa/angariacao/…`) não mudam.
- Soft-delete de categoria (`is_active=false`) não apaga documentos — continuam visíveis agrupados sob a label "arquivada" na UI até serem re-categorizados.
- `category_id` permite futura migração para FK rígida sem breaking.

**Backfill:** migration faz `update company_documents set category_id = c.id from company_document_categories c where company_documents.category = c.slug;`.

### 3. UI: onde entra o "+ Nova categoria…"?

**Escolha:** rodapé fixo dentro do `<SelectContent>` de ambos os dropdowns (filtro + upload). Item especial com `value="__new__"` que, ao ser seleccionado, abre `CategoryFormDialog` e mantém o valor anterior no `<Select>` até a categoria ser criada; em sucesso, selecciona a nova.

**Alternativas rejeitadas:**
- Botão `+` separado ao lado da dropdown: adiciona ruído visual e exige duplicar o componente nos dois sítios.
- Settings page global (`/dashboard/definicoes/categorias`): é onde também vai existir (fase 2 opcional), mas exigir navegação rompe o fluxo de upload. Mantemos ambos: atalho in-place + página dedicada remetida para futuro.

Para não depender de `AlertDialog` aninhado em `Select` (Radix fecha o portal), o diálogo é montado fora da árvore do Select, controlado por state (`categoryDialogOpen`).

### 4. Edição e eliminação de categorias

- **Editar:** admins vêem menu `…` no cabeçalho de cada grupo; abre o mesmo `CategoryFormDialog` pré-preenchido. Campos editáveis: `label`, `icon`, `color`, `sort_order`. **`slug` é imutável** para não quebrar URLs de R2 nem filtros bookmark-ados.
- **Eliminar:** soft delete (`is_active=false`). API bloqueia se houver documentos activos na categoria; resposta 409 com contagem e sugestão. UI mostra `AlertDialog` com opção "Re-categorizar X documentos para…" (select com categorias activas) antes de desactivar. Categorias `is_system=true` não podem ser eliminadas (nem via API).
- **Reordenar:** por agora, campo numérico `sort_order` no form. Drag-to-reorder fica para fase 2 (usaria `@dnd-kit` como a galeria de imóveis).

### 5. Permissões

- `GET /api/company-documents/categories` — qualquer utilizador autenticado.
- `POST`/`PUT`/`DELETE` — requer `roles.permissions.settings === true`. Hook `useUser()` já expõe; API valida server-side via `dev_users` join `roles`.
- UI esconde botões destrutivos quando `!canManage`, mas os *guards* reais estão na API.

### 6. Hook + invalidação de cache

`useCompanyDocumentCategories()` em `hooks/use-company-document-categories.ts`:

```ts
{ categories: Category[], loading, refetch, create(payload), update(id, payload), remove(id, { reassignTo? }) }
```

Fetch único no mount + revalidate após cada mutação (não usar SWR formal — o projecto não o tem; seguir o padrão de `use-property.ts`). Expor via Context em `app/dashboard/documentos/page.tsx` para partilhar entre os vários sub-componentes sem prop-drilling.

### 7. Listagem com categorias órfãs

Um documento pode ter `category='foo'` onde `foo` já foi desactivada ou renomeada para slug diferente. Regras:

- Se slug existe mas `is_active=false` → label resolvido, tag visual "arquivada".
- Se slug não existe em lado nenhum → grupo "Sem categoria" (ou mostra o slug bruto). Admin pode re-categorizar via "Editar documento".

## Risks / Trade-offs

- **[Risco] Race condition: dois admins criam categoria com mesmo label quase em simultâneo.** Slug colide → segundo request falha com 409. → **Mitigação:** API derive slug server-side via `slugify(label)` e retorna o erro específico; UI mostra "Já existe uma categoria com esse nome". Unique constraint no DB é a fonte da verdade.
- **[Risco] Slug imutável pode frustrar utilizadores que escreveram nome errado.** → **Mitigação:** editar `label` é suficiente para 99% dos casos (slug não é mostrado na UI). Se mesmo assim quiserem limpar, podem criar nova categoria + re-categorizar + desactivar antiga. Documentar no diálogo de edição.
- **[Risco] Soft delete vs. performance do `GET`.** Categorias inactivas aparecem apenas se houver documentos órfãos. → **Mitigação:** índice parcial `where is_active`.
- **[Trade-off] `category` manter-se text (não enum, não FK rígida).** Perde-se validação a nível de DB. → Validação API + futura migration para FK após backfill estabilizado.
- **[Risco] R2 key continua a conter slug — renomear slug implicaria copiar ficheiros.** → **Mitigação:** slug imutável por design; apenas `label` muda.
- **[Trade-off] 9 categorias actuais ficam marcadas `is_system`.** Admin não consegue apagar "Outros" mesmo que vazio. Aceitável — são fallback semântico.

## Migration Plan

1. **DB migration** (`supabase/migrations/YYYYMMDD_company_document_categories.sql`):
   - Create table `company_document_categories`.
   - Seed 9 categorias actuais com `is_system=true` e `sort_order` incremental.
   - Alter table `company_documents` add column `category_id uuid references company_document_categories(id) on delete set null`.
   - Backfill `category_id` a partir de `category` slug.
   - Trigger `updated_at` (reutilizar `set_updated_at()` do projecto se existir; caso contrário criar).
2. **Deploy API routes** (GET/POST + [id] PUT/DELETE + auditoria).
3. **Deploy UI** (hook + dropdown component + category dialog + menu contextual nos cabeçalhos).
4. **Remover `CATEGORIES` hardcoded** do page.tsx (último commit da feature para garantir que tudo consome o hook).

**Rollback:** manter `CATEGORIES` hardcoded num fallback no hook (`if (!data) return HARDCODED_FALLBACK`). Se a API falhar ou a tabela for dropada, a UI volta ao estado actual. Rollback DB: drop column `category_id` + drop table — sem perda de dados em `company_documents`.

## Open Questions

- Permitir múltiplas categorias por documento? — **Não** para este ciclo (mantém 1:1 via `category` + `category_id`). Se vier requisito, introduz-se tabela de junção.
- Página dedicada em `/dashboard/definicoes/documentos/categorias` com drag-to-reorder? — **Fora de âmbito.** Fase 2.
- Ícone e cor são expostas na UI? — **Sim**: ícone aparece à esquerda do nome em dropdown e cabeçalhos; cor tinge o ícone. Defaults: ícone `FolderOpen`, cor neutra (`text-muted-foreground`).
