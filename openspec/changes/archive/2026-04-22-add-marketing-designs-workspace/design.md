## Context

### Estado actual

A tab **Marketing** em `/dashboard/documentos` é composta por dois componentes:

- **`TeamDesignsTab`** ([page.tsx:752-1110](app/dashboard/documentos/page.tsx)) — consome `marketing_design_templates` via `/api/marketing/design-templates?team=true` e renderiza cards agrupados por `DESIGN_CATEGORIES` hardcoded. Tem CRUD funcional mas só sobre 8 categorias congeladas.
- **`KitConsultorTab`** ([page.tsx:1140-1334](app/dashboard/documentos/page.tsx)) — consome `/api/consultants/[id]/materials` que devolve **joins server-side** entre `marketing_kit_templates` (catálogo fixo) e `agent_materials` (uploads reais). A UI mostra 8 cards numa grelha plana `grid-cols-2 sm:grid-cols-4`, com "Pendente" onde não há upload. O utilizador é apenas **leitor** — uploads são feitos por marketing admin.

Ambas as sub-tabs partilham conceitos (categoria visual, thumbnails, link Canva), mas têm schemas separados:

| Superfície | Tabela primária | Origem do upload | Categoria |
|---|---|---|---|
| Kit catálogo fixo | `marketing_kit_templates` + `agent_materials` | Marketing admin (não-UI) | CHECK 9 valores institucionais |
| Team designs | `marketing_design_templates` (is_team_design=true) | Qualquer autenticado, via UI | CHECK 8 valores |
| Personal (nova) | `agent_personal_designs` (nova) | O próprio consultor | FK partilhada |

### Padrão de referência

`add-company-document-categories` (concluído 2026-04-22) é o paradigma canónico para taxonomia dinâmica nesta base de código. Já entregou:
- Tabela genérica `company_document_categories` com slug imutável, is_system, soft-delete via is_active
- API permissionada por `settings` com auditoria (`log_audit`)
- Provider React + hook + 6 componentes UI reutilizáveis (dialogs, select, section header, icons, add button, delete dialog)
- Galeria de 10 ícones Lucide partilhável

**A decisão arquitectural principal desta change é: reaproveitar esse padrão quase integralmente em vez de inventar um novo.** A única variação é o scope (categorias de designs em vez de documentos) e a tabela-alvo, pelo que o código adapta-se por substituição directa dos nomes.

### Stakeholders e restrições

- **Consultores:** querem controlo sobre "Os meus designs" (upload próprio) e ver o seu kit organizado.
- **Marketing / Broker:** querem criar novas categorias de equipa sem deploy.
- **Compatibilidade:** slugs existentes (`placas`, `cartoes`, etc.) estão referenciados em dados históricos (`marketing_design_templates.category`). Não podem mudar.
- **Storage:** bucket `marketing-kit` já existe no Supabase com policies ajustadas. Reutilizar.

## Goals / Non-Goals

**Goals:**
- Administradores com permissão `settings` conseguem criar/editar/desactivar categorias de designs de marketing directamente da UI.
- Consultores conseguem adicionar designs pessoais (upload de ficheiro OU link Canva) categorizados pelas mesmas categorias da equipa.
- A sub-tab "Os meus designs" passa a mostrar o kit fixo **agrupado por categoria** (paridade visual com Team Designs), mantendo a barra de progresso "O Meu Kit — X de N materiais prontos".
- Mesma UX canónica (galeria de ícones, cores, section headers, add-button) usada no módulo de documentos da empresa.
- Compatibilidade total com dados existentes — slugs legados mantidos como `is_system=true`.

**Non-Goals:**
- Unificar `marketing_kit_templates` com `marketing_design_templates` numa só tabela. São conceitualmente diferentes (catálogo institucional vs. biblioteca aberta) e essa fusão é demasiado arriscada para o âmbito.
- Permitir ao consultor "adoptar" um kit template como design pessoal (link N:M). Consultor cria os seus do zero.
- Permitir categorias PER-USER em personal designs (tudo usa a taxonomia partilhada).
- Migrar as categorias do `marketing_kit_templates` (`cartao_visita`, `badge`, etc.) para `marketing_design_categories`. O agrupamento visual do kit é feito client-side via mapa estático `KIT_TO_DESIGN_CATEGORY`.
- Versionamento de designs, aprovação editorial, ou publicação cruzada para o website.

## Decisions

### Decisão 1 — Tabela `marketing_design_categories` partilhada entre Team e Personal

**Escolha:** uma única tabela de categorias serve `marketing_design_templates` (team) e `agent_personal_designs` (personal).

**Alternativas consideradas:**
- (A) Duas tabelas separadas (`marketing_team_design_categories` + `personal_design_categories`). Rejeitada: duplicação artificial; do ponto de vista do utilizador "Placas" significa a mesma coisa em ambas as sub-tabs.
- (B) Personal designs sem categorização. Rejeitada: impede o agrupamento visual pedido e fragmenta a UX.

**Rationale:** a taxonomia é uma propriedade do tenant (empresa), não do utilizador. Partilhar evita re-seed, simplifica UI (mesmo select em todos os dialogs) e garante que criar "Flyers" na Equipa disponibiliza também para designs pessoais.

### Decisão 2 — `marketing_kit_templates` mantém CHECK constraint legado

**Escolha:** NÃO alterar `marketing_kit_templates.category` (continua com os 9 valores CHECK: `cartao_visita`, `cartao_digital`, `badge`, etc.).

**Rationale:**
- O kit é um catálogo **institucional** — não faz sentido um consultor criar "Badge RE/MAX Gold" ad-hoc.
- Os slugs do kit (`cartao_visita`) não mapeiam 1:1 para os slugs de design (`cartoes`). "Badge RE/MAX" e "Badge RE/MAX Collection" ambos vivem em `marketing_kit_templates.category='badge'` mas no visual do utilizador devem aparecer sob "Badges" (categoria dinâmica).
- Fazer essa migração exige sincronização com `agent_materials.template_id` e processos externos do marketing — fora do âmbito.

**Trade-off:** temos de manter um mapa estático `KIT_CATEGORY_TO_DESIGN_SLUG` no client para agrupar o kit pelas categorias dinâmicas:
```ts
// lib/marketing/kit-category-map.ts
export const KIT_CATEGORY_TO_DESIGN_SLUG: Record<string, string> = {
  cartao_visita:      'cartoes',
  cartao_digital:     'cartoes',
  badge:              'badges',
  placa_venda:        'placas',
  placa_arrendamento: 'placas',
  assinatura_email:   'assinaturas',
  relatorio_imovel:   'relatorios',
  estudo_mercado:     'estudos',
  outro:              'outro',
}
```
Mitigação: mapa centralizado; testado; fallback para "outro" se o slug dinâmico for desactivado.

### Decisão 3 — Designs pessoais em tabela separada (`agent_personal_designs`) vs. reutilizar `marketing_design_templates`

**Escolha:** nova tabela `agent_personal_designs`.

**Alternativas consideradas:**
- Adicionar `agent_id UUID NULL` a `marketing_design_templates` e filtrar por `agent_id = null OR agent_id = userId`. Rejeitada porque:
  - Obrigaria a RLS complexa (ver só o próprio + partilhados).
  - `is_team_design` e `agent_id` sobrepõem-se conceptualmente (um design `is_team_design=false` com `agent_id=null` seria ambíguo).
  - CASCADE delete ao apagar um `dev_users` é mais limpo numa tabela dedicada.
  - Mistura uploads curados (team) com uploads pessoais (potencialmente many) no mesmo índice/query.

**Rationale:** separação clara de concerns. RLS simples (`agent_id = auth.uid()` OR service role). Scan plans previsíveis. Permite evoluir schemas independentemente (ex.: team designs podem ganhar `is_featured`, `approved_by` sem impactar pessoais).

### Decisão 4 — Upload de designs pessoais vai para Supabase Storage, não R2

**Escolha:** reusar o bucket `marketing-kit` do Supabase Storage (já usado por `agent_materials`), prefixo `personal/{agent_id}/{timestamp}-{sanitized-name}`.

**Alternativas consideradas:**
- R2 como resto do ERP (properties, leads). Rejeitada: o módulo de marketing kit **já tem** tudo no Supabase Storage, incluindo signed URLs em `/api/consultants/[id]/materials`. Introduzir R2 aqui força dois caminhos de storage para o mesmo módulo.

**Rationale:** coerência local do módulo. Signed URLs de 1h já usadas. RLS no bucket pode reaproveitar policies existentes. Se mais tarde se quiser migrar tudo para R2, faz-se como change separada.

### Decisão 5 — Componentes prefixados `marketing-design-category-*` vs. generalização

**Escolha:** novos componentes em `components/marketing/design-categories/` com nomes análogos (`MarketingDesignCategorySelect`, `MarketingDesignCategoryFormDialog`, etc.).

**Alternativas consideradas:**
- Generalizar `CompanyCategorySelect` para um `<DynamicCategorySelect api="..." />` que funciona para qualquer tabela de categorias. Rejeitada agora: over-engineering. Só temos duas instâncias (company-docs e marketing-designs), ambas com especificidades (company tem `allowed_extensions` nas categorias futuras? marketing não tem). Generalização prematura.

**Rationale:** copy+paste controlado (não apenas `git mv`) permite diferenças pequenas — ícones relevantes para marketing (ex.: podem acrescentar-se `Palette`, `Image`, `Layout` ao catálogo) sem alterar o módulo de documentos. Refactor para componente genérico pode acontecer numa terceira ocorrência.

**Reaproveitamento real:** a galeria de ícones (`company-category-icons.tsx`) é importada directamente — não se duplica.

### Decisão 6 — Soft-delete com reassign (igual a company-docs)

Mesma mecânica: `DELETE` sem `reassign_to` → 409 + `design_count`; com `reassign_to=<slug>` → transfere designs + desactiva.

Aplica-se a **ambas** as tabelas: `marketing_design_templates` E `agent_personal_designs`. O endpoint `DELETE /api/marketing/design-categories/[id]` recebe body `{ reassign_to?: string }` e actualiza os dois em transacção (ou via duas chamadas sequenciais service-role).

### Decisão 7 — RLS em `agent_personal_designs`

```sql
-- Ler: próprio OR admin settings
CREATE POLICY "Agents read own personal designs"
  ON agent_personal_designs FOR SELECT
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM dev_users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND (r.permissions->>'settings')::boolean = true
    )
  );

-- Mutar: próprio OR admin settings (API valida na camada de handler; RLS é segunda barreira)
CREATE POLICY "Service role manages personal designs"
  ON agent_personal_designs FOR ALL
  USING (true) WITH CHECK (true);  -- service-role bypass para API
```

A API faz a verificação primária (`agent_id === user.id` OR `hasPermissionServer(..., 'settings')`) via service-role client. RLS é defesa em profundidade.

## Risks / Trade-offs

- **[Risk] CHECK constraint drop em `marketing_design_templates.category`** → Mitigação: wrap em `BEGIN/COMMIT`, backfill `category_id` antes de dropar; validação passa para a API Zod + runtime query contra `marketing_design_categories.slug`. Rollback: `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)`.
- **[Risk] Mapa `KIT_CATEGORY_TO_DESIGN_SLUG` desalinhado** com as categorias dinâmicas (se o admin desactivar `assinaturas`, o kit item `assinatura_email` perde grupo) → Mitigação: fallback para `outro`; warning em dev log; `outro` é `is_system=true` e não pode ser desactivada.
- **[Risk] Upload de PDFs pesados pelo consultor** enche bucket → Mitigação: limites diferenciados por tipo — **imagens (PNG/JPG/WebP) 10MB**, **PDFs 100MB** (casos de uso reais: relatórios de mercado, dossiers comerciais com fotos embebidas, frequentemente >10MB). Toast com mensagem específica por tipo ("Imagem demasiado grande (máx. 10MB)" vs "PDF demasiado grande (máx. 100MB)"). Validação dupla: client-side antes de iniciar o upload (usa `file.type` + `file.size`) + server-side após multipart parse (`request.headers['content-length']` como guard inicial, `file.size` final). Se o bucket crescer muito, reavaliar quota per-agent numa change futura.
- **[Risk] Duplicação visual entre "O Meu Kit" e "Designs personalizados"** na mesma sub-tab → Mitigação: separador visual claro (título de secção + divisor). Kit mantém progress bar; Personal tem search/filter próprio.
- **[Risk] Signed URLs expiram durante sessão longa** (1h) → Mitigação: manter padrão de fetch+refresh existente em `KitConsultorTab`; nenhuma alteração. Se for problema real, refresh ao abrir preview.
- **[Risk] Permissão `settings` demasiado lata** (dá acesso a todas as categorias + muitas outras definições) → Mitigação: aceitável no curto prazo (consistente com company-docs); criar `marketing_admin` como permissão dedicada é trabalho para outra change.

## Migration Plan

1. **Migration SQL** (timestamp `20260423_marketing_design_categories.sql`):
   1. Criar tabela `marketing_design_categories` + índice + trigger `updated_at`.
   2. Seed 8 categorias `is_system=true` (`placas`, `cartoes`, `badges`, `assinaturas`, `relatorios`, `estudos`, `redes_sociais`, `outro`) com `sort_order` 10, 20, 30, ...
   3. `ALTER TABLE marketing_design_templates ADD COLUMN category_id UUID REFERENCES marketing_design_categories(id) ON DELETE SET NULL`.
   4. Backfill: `UPDATE marketing_design_templates SET category_id = c.id FROM marketing_design_categories c WHERE marketing_design_templates.category = c.slug`.
   5. `ALTER TABLE marketing_design_templates DROP CONSTRAINT marketing_design_templates_category_check`.
   6. `CREATE INDEX idx_mdt_category_id ON marketing_design_templates(category_id) WHERE is_active = true`.
   7. Criar tabela `agent_personal_designs` + índices (`agent_id`, `category_id`) + RLS + trigger `updated_at`.
   8. RLS SELECT policy usa `hasPermissionServer`-equivalente no SQL (join com `dev_users`+`roles`).

2. **Deploy ordem:**
   - Step 1: aplicar migration (categorias + tabela personal). Retrocompatível: `marketing_design_templates.category` ainda funciona.
   - Step 2: deploy APIs novas + refactor UI em paralelo. Validação server-side aceita tanto `category` (slug) como `category_id` no POST.
   - Step 3: feature ligada automaticamente — não há feature flag.

3. **Rollback:** reverter deploy (código), depois:
   - `ALTER TABLE marketing_design_templates ADD CONSTRAINT marketing_design_templates_category_check CHECK (...)`
   - `DROP TABLE agent_personal_designs CASCADE`
   - `DROP TABLE marketing_design_categories CASCADE` (só depois de reverter `category_id` FK em templates)

## Open Questions

- **Quota de storage por consultor:** limitar número de designs pessoais / MB total por agente? Proposta: começar sem quota. Monitorizar tamanho do bucket `marketing-kit` após 2 semanas e decidir.
- **Thumbnails automáticos para uploads pessoais:** gerar thumbnail server-side a partir de PDFs (primeira página) ou apenas aceitar imagem separada? Proposta MVP: aceitar thumbnail separada opcional; se não houver e for imagem, usar o próprio ficheiro; se for PDF, usar ícone genérico. Geração server-side fica para change futura.
- **Ordenação dentro da categoria** em "Designs personalizados": drag-to-reorder ou apenas `sort_order` por API? Proposta MVP: sem drag — apenas ordenação alfabética com `sort_order` como tiebreaker. Drag-to-reorder num follow-up se os utilizadores pedirem.
