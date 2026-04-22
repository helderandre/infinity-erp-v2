## Why

A página `/dashboard/consultores` (rotulada "Equipa" no sidebar) hoje só tem duas tabs ("Consultores" e "Staff") e o botão de criação assume sempre um consultor (`"Novo Consultor"` + dropdown de função limitado a `CONSULTANT_ROLES`). Na prática, a mesma página é usada para gerir **toda** a equipa da agência — consultores, staff operacional (Office Manager, Gestora Processual, Marketing, etc.) e brokerage — pelo que o UI actual esconde staff e força criação apenas de papéis comerciais. Além disso, o padding do container em desktop não acompanha o mobile (IMG3 está correcto, PC descontrolado).

## What Changes

- **Adicionar tab "Equipa"** como **primeira** tab da página `/dashboard/consultores`, listando **todos** os membros independentemente do role. As tabs passam a ser: `Equipa` (todos) · `Consultores` (roles comerciais) · `Staff` (restantes roles internos).
- **Renomear o botão "Novo Consultor" → "Novo Membro"** e actualizar `aria-label`, `title` e cabeçalho do diálogo (`CreateConsultantDialog`).
- **Remover o filtro `CONSULTANT_ROLES`** no dropdown "Função" do diálogo: passa a mostrar **todos os roles activos** obtidos de `/api/libraries/roles`. O tab em que o utilizador está quando carrega "Novo Membro" pré-selecciona um role sensato (ex.: tab Staff → role `Staff`; tab Consultores → `Consultor`; tab Equipa → sem pré-selecção).
- **Garantir a existência de um role `Staff`** no seed/migration (idempotente: `insert … on conflict (name) do nothing`). Este role fica com permissões mínimas (a definir em design) e é usado como default do tab Staff e como opção pré-seleccionada.
- **Reclassificar tabs por conjunto de roles** em `lib/auth/roles.ts`: exportar `CONSULTANT_ROLE_NAMES`, `STAFF_ROLE_NAMES` e um helper `classifyMember(role) → 'consultor' | 'staff'` partilhado entre a UI e (opcional) queries server-side de contagem por tab.
- **Corrigir padding desktop** da página: harmonizar o container interno com o padrão `p-4 md:p-6` usado pelo layout (`app/dashboard/layout.tsx`). O mobile IMG3 é a referência; desktop deve ter o mesmo respiro relativo sem adicionar `md:p-8` extra ou duplicar container.

## Capabilities

### New Capabilities
- `team-management`: gestão unificada de membros da equipa (consultores + staff) numa página com tabs, incluindo criação de membro com role livre e classificação consistente entre UI e servidor.

### Modified Capabilities
<!-- nenhuma — não existe spec prévio para este módulo -->

## Impact

- **UI**
  - [app/dashboard/consultores/page.tsx](app/dashboard/consultores/page.tsx) — adicionar 3ª tab "Equipa", mudar ordem, renomear botão, ajustar container/padding.
  - [components/consultants/create-consultant-dialog.tsx](components/consultants/create-consultant-dialog.tsx) — renomear header/texto para "Novo Membro", remover filtro de roles, aceitar `defaultRoleName` por props.
  - [components/layout/app-sidebar.tsx](components/layout/app-sidebar.tsx) — nenhum (URL mantém-se).
- **Lógica de roles**
  - [lib/auth/roles.ts](lib/auth/roles.ts) — nova taxonomia (`STAFF_ROLE_NAMES`, `classifyMember`).
  - [app/dashboard/consultores/page.tsx](app/dashboard/consultores/page.tsx) `loadRoles()` deixa de filtrar por `CONSULTANT_ROLES`.
- **API**
  - [app/api/consultants/route.ts](app/api/consultants/route.ts) — POST aceita qualquer `role_id` válido (já aceita hoje, mas o teste com roles não-consultor é novo). Auditoria inalterada.
  - [app/api/libraries/roles/route.ts](app/api/libraries/roles/route.ts) — inalterado (já devolve todos).
- **Base de dados**
  - Migration idempotente que garante `roles.name = 'Staff'` (insert `on conflict (name) do nothing`) com `permissions` jsonb mínimo.
- **Sem breaking changes** — consumers actuais (`useUser`, permissions) permanecem intactos; apenas se introduz um novo role.
