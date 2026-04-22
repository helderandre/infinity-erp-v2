## Why

A tab **Marketing** em [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) tem duas sub-tabs — **Os meus designs** e **Designs da Equipa** — e ambas estão bloqueadas por limitações estruturais:

1. **"Os meus designs"** mostra apenas o catálogo fixo do `marketing_kit_templates` (8 itens: Cartão de Visita, Badge, Placa…) numa grelha plana, onde cada item depende de uploads manuais feitos pelo marketing para `agent_materials`. O consultor **não tem qualquer botão** para adicionar designs pessoais e **não há agrupamento por categoria** — todos os 8 kit items aparecem numa fila indistinta.
2. **"Designs da Equipa"** tem CRUD funcional mas as categorias são **hardcoded** (`DESIGN_CATEGORIES` em [page.tsx:678-687](app/dashboard/documentos/page.tsx) — `placas`, `cartoes`, `badges`, `assinaturas`, `relatorios`, `estudos`, `redes_sociais`, `outro`). A tabela `marketing_design_templates` impõe um CHECK constraint no mesmo conjunto, pelo que criar uma nova categoria (ex.: "Flyers", "Outdoors", "Vídeos") exige migração + deploy.

Já existe padrão estabelecido e validado: `add-company-document-categories` (concluído 2026-04-22) fez exactamente isto para os documentos da empresa, com tabela `company_document_categories`, API CRUD permissionada por `settings`, provider + hook + dialogs reutilizáveis e galeria de ícones Lucide. Reutilizar o mesmo padrão mantém coerência e reduz risco.

## What Changes

### 1. Categorias dinâmicas de designs de marketing (ambas as sub-tabs)
- **DB:** nova tabela `marketing_design_categories` (`id`, `slug`, `label`, `icon`, `color`, `sort_order`, `is_system`, `is_active`, `created_by`, timestamps) — espelho exacto de `company_document_categories`. Seed das 8 categorias actuais como `is_system=true`. Partilhada entre designs da equipa E designs pessoais (taxonomia única por tenant).
- **DB:** `marketing_design_templates` — adicionar coluna `category_id uuid REFERENCES marketing_design_categories(id) ON DELETE SET NULL`, backfill a partir do slug actual, **dropar o CHECK constraint** legacy em `category` (a validação passa para a API). Slug continua `text` para retro-compatibilidade.
- **API:** novos endpoints `GET/POST /api/marketing/design-categories` + `PUT/DELETE /api/marketing/design-categories/[id]`. Listar = autenticado; criar/editar/desactivar = `settings`. Soft-delete com `reassign_to` (retorna 409 + `design_count` se categoria não-vazia e sem destino). Auditoria via `log_audit` (`entity_type='marketing_design_category'`).
- **UI — "Designs da Equipa":** substituir `<Select>` de categoria hardcoded pelo `<MarketingDesignCategorySelect>` (paridade visual com `CompanyCategorySelect`) + botão autónomo **"+ Nova categoria"** junto ao filtro e ao diálogo de adicionar/editar design. Cabeçalho de cada secção passa a mostrar ícone + cor + menu `…` com Editar/Eliminar (apenas para `settings`).

### 2. "Os meus designs" — Designs pessoais do consultor
- **DB:** nova tabela `agent_personal_designs` (`id`, `agent_id UUID NOT NULL REFERENCES dev_users ON DELETE CASCADE`, `name`, `description`, `category_id UUID REFERENCES marketing_design_categories`, `file_path`, `file_name`, `file_size`, `mime_type`, `thumbnail_path`, `canva_url`, `sort_order`, `created_at`, `updated_at`). RLS: cada consultor vê apenas os seus; admins com `settings` vêem todos. Ficheiros guardados no bucket Supabase Storage `marketing-kit` sob `personal/{agent_id}/{timestamp}-{name}` (reusa bucket existente).
- **API novos:** `GET/POST /api/consultants/[id]/personal-designs` (listar próprios + criar), `PUT/DELETE /api/consultants/[id]/personal-designs/[designId]` (editar / apagar). `POST /api/consultants/[id]/personal-designs/upload` — multipart (imagem/PDF → Supabase storage + insert row). Só o próprio utilizador ou admin com `settings` pode mutar.
- **UI — "Os meus designs":**
  1. **"O Meu Kit"** (catálogo fixo) passa a ser agrupado por categoria (ícone + cor + contagem), igual ao visual da sub-tab Equipa, eliminando a grelha plana actual. A barra de progresso "O Meu Kit — 0 de 8 materiais prontos" mantém-se no topo.
  2. Nova secção **"Designs personalizados"** abaixo do kit: grelha agrupada por categoria, com botão **"+ Adicionar design"** no filtro e **"+"** em cada cabeçalho de categoria. Card partilha layout com Team Designs (thumbnail + nome + hover-actions para Editar/Eliminar). Suporta upload de ficheiro (PNG/JPG/WebP/PDF) **OU** apenas URL Canva (thumbnail opcional).

### 3. Refactor partilhado
- Extrair provider + hook + dialogs + select + icons para `components/marketing/design-categories/` (`marketing-design-categories-provider.tsx`, `use-marketing-design-categories.ts`, `marketing-design-category-select.tsx`, `marketing-design-category-form-dialog.tsx`, `marketing-design-category-delete-dialog.tsx`, `marketing-design-category-icons.tsx`, `marketing-design-category-section-header.tsx`, `marketing-design-category-add-button.tsx`). Os 10 ícones Lucide do catálogo de company-docs (Folder, Scale, Shield, Building2, Users, BookOpen, Briefcase, Receipt, Megaphone, FileText) são reutilizados tal como estão (não criar novo ficheiro de ícones).
- Remover `DESIGN_CATEGORIES` e `DESIGN_CATEGORY_ICONS` hardcoded de [page.tsx:678-698](app/dashboard/documentos/page.tsx).

### Não inclui
- Migração do `marketing_kit_templates` para taxonomia dinâmica — o kit fixo **continua** a usar o CHECK constraint existente (`cartao_visita`, `badge`, etc.) porque representa um catálogo institucional gerido pelo marketing, não uma taxonomia livre. Só o agrupamento visual muda. O mapeamento slug → categoria dinâmica será feito no lado do client via tabela de correspondência estática.
- Alteração do fluxo de upload do kit (`agent_materials`) — continua gerido pelo marketing admin.
- Bibliotecas de email/documento (`tpl_email_library`, `tpl_doc_library`) — fora do âmbito.

## Capabilities

### New Capabilities
- `marketing-design-categories`: CRUD dinâmico de categorias de designs de marketing (`marketing_design_categories`), com seeds protegidos, permissão `settings`, soft-delete com reassign, auditoria e integração UI (filtros + cabeçalhos + dialogs) em `/dashboard/documentos` tab Marketing (ambas as sub-tabs).
- `agent-personal-designs`: workspace de designs pessoais por consultor (`agent_personal_designs`), com upload de ficheiro ou link Canva, CRUD per-agent, agrupamento por categoria partilhada com a equipa, e UI integrada em "Os meus designs".

### Modified Capabilities
<!-- Nenhuma capability existente em openspec/specs/ toca nas tabelas marketing_* ou na tab Marketing de /dashboard/documentos. -->

## Impact

- **Schema DB:**
  - Nova tabela `marketing_design_categories` + seed de 8 categorias `is_system=true`.
  - `marketing_design_templates`: adicionar `category_id UUID`, backfill, **dropar CHECK constraint** `marketing_design_templates_category_check`.
  - Nova tabela `agent_personal_designs` com RLS per-agent.
  - Trigger `updated_at` reutilizando `trg_company_docs_updated_at()` existente.
- **Páginas:** [app/dashboard/documentos/page.tsx](app/dashboard/documentos/page.tsx) — refactor do `MarketingTemplatesTab`, `TeamDesignsTab` e `KitConsultorTab` para consumir o novo provider; `KitConsultorTab` passa a ter duas sub-secções (Kit + Personal).
- **APIs novas:**
  - `app/api/marketing/design-categories/route.ts` + `[id]/route.ts`.
  - `app/api/consultants/[id]/personal-designs/route.ts` + `[designId]/route.ts` + `upload/route.ts`.
- **APIs existentes:** `app/api/marketing/design-templates/route.ts` e `[id]/route.ts` — passam a validar `category` contra `marketing_design_categories` (slug existe e `is_active=true`) e a gravar `category_id`.
- **Novos componentes:** 8 ficheiros em `components/marketing/design-categories/` + card pessoal `components/marketing/personal-design-card.tsx` + dialog `components/marketing/personal-design-form-dialog.tsx`.
- **Novo hook:** `hooks/use-marketing-design-categories.ts` + `hooks/use-personal-designs.ts`.
- **Storage:** bucket `marketing-kit` reutilizado; novo prefixo `personal/{agent_id}/`.
- **Permissões:** reusa `settings` (criar/editar categorias). Designs pessoais = próprio utilizador OR `settings`.
- **Sem breaking changes:** consumidores existentes da API `design-templates` que enviem `category=slug` continuam a funcionar (slugs legados mantidos como categorias `is_system=true`).
