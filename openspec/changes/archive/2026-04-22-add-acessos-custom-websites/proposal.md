## Why

O sub-tab **Outros** em `/dashboard/acessos` → Websites mostra uma lista hardcoded (ChatGPT, Canva, WhatsApp Web, Monday.com) que só pode ser alterada editando código. Cada consultor tem as suas próprias ferramentas (Notion, Miro, Figma, CRMs pessoais, etc.) e hoje não existe forma de adicioná-las sem pedir a um developer. Ao mesmo tempo, a direcção quer continuar a curar um conjunto **global** de ferramentas visíveis para toda a equipa.

## What Changes

- Substituir o array hardcoded `WEBSITES.outros.links` por uma lista dinâmica carregada de uma nova tabela `acessos_custom_sites`, com dois *scopes*: **global** (visível para todos) e **personal** (visível apenas ao owner).
- Seed inicial: ChatGPT, Canva, WhatsApp Web, Monday.com como global + `is_system=true` (protegidos contra delete, mantêm o comportamento actual).
- Nova API `GET/POST /api/acessos/custom-sites` + `PUT/DELETE /api/acessos/custom-sites/[id]`. GET devolve a união de globais + personais do utilizador autenticado, ordenada por scope (global primeiro) e `sort_order`.
- Permissões:
  - Criar/editar/eliminar sites **globais** → apenas utilizadores com `roles.permissions.settings=true`.
  - Criar/editar/eliminar sites **personal** → apenas o `owner_id` do registo.
  - Sites com `is_system=true` não podem ser eliminados por ninguém (só desactivados via `is_active=false`).
- UI no sub-tab **Outros**: botão "+ Adicionar site" sempre visível, diálogo com toggle `Global / Pessoal` (toggle só aparece se `canManageGlobal`). Cada card ganha menu `…` Editar/Eliminar quando o utilizador pode gerir (owner para pessoal, `settings` para global não-system; system apenas mostra badge "Sistema" sem menu).
- Auditoria: cada mutação regista em `log_audit` com `entity_type='acessos_custom_site'`.

## Capabilities

### New Capabilities
- `acessos-custom-websites`: gestão CRUD de websites custom no sub-tab Outros da página de acessos, com dois scopes (global partilhado pela equipa vs pessoal por utilizador) e protecção dos sites seed do sistema.

### Modified Capabilities
<!-- nenhuma — o sub-tab MicroSIR/Casafari e os restantes tabs (Atalhos, Os Meus Links, Estrutura) ficam inalterados -->

## Impact

- **DB**: nova tabela `acessos_custom_sites` + RLS + seed de 4 sites globais system.
- **API**: 2 novas routes em `app/api/acessos/custom-sites/`.
- **UI**: [app/dashboard/acessos/page.tsx](app/dashboard/acessos/page.tsx) — remove hardcoded array `WEBSITES.outros.links`, substitui por hook `useAcessosCustomSites()`, adiciona diálogo de criação/edição e menu de contexto nos cards.
- **Componentes**: novo `components/acessos/custom-site-dialog.tsx` (criação/edição) e actualização do `<LinkCard>` existente para suportar acções opcionais.
- **Permissões**: depende do helper existente [lib/auth/check-permission-server.ts](lib/auth/check-permission-server.ts) (mesmo padrão usado em `company-document-categories`).
- **Out of scope**: MicroSIR e Casafari mantêm links hardcoded (são específicos da agência com credenciais fixas). Os tabs Atalhos, Os Meus Links e Estrutura ficam inalterados.
