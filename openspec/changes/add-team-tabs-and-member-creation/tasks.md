## 1. Base de dados — role Staff

- [x] 1.1 Criar migration idempotente que insere `roles` com `name = 'Staff'`, `description`, e `permissions` conforme secção Decisão 4 do design; usar `on conflict (name) do nothing`.
- [x] 1.2 Aplicar migration via Supabase MCP (`apply_migration`) e confirmar com `select id, name from roles where name = 'Staff'`.
- [x] 1.3 Re-executar a mesma migration e verificar que não há duplicação nem mutação (idempotência).

## 2. Classificação central em `lib/auth/roles.ts`

- [x] 2.1 Exportar `CONSULTANT_ROLE_NAMES` (novo nome canónico) e manter `CONSULTANT_ROLES = CONSULTANT_ROLE_NAMES` como alias para não quebrar imports existentes.
- [x] 2.2 Exportar `STAFF_ROLE_NAMES` com `['Office Manager', 'Gestor Processual', 'Gestora Processual', 'Marketing', 'Recrutador', 'Intermediário de Crédito', 'Staff']` (nomes reais do DB — ver task 1.2 — em vez das grafias snake_case referidas no CLAUDE.md).
- [x] 2.3 Implementar e exportar `classifyMember(roleName: string | null | undefined): 'consultor' | 'staff' | 'other'`.
- [x] 2.4 `npm run build` — compilação OK em 63s, 376 static pages geradas; 0 erros de tipo (webpack); `CONSULTANT_ROLES` alias preservado mantém compatibilidade com os restantes imports.

## 3. Página `/dashboard/consultores` — tabs

- [x] 3.1 Em [app/dashboard/consultores/page.tsx](app/dashboard/consultores/page.tsx), actualizar `TABS` para `[{ key: 'equipa', label: 'Equipa', icon: Users }, { key: 'consultores', label: 'Consultores', icon: UserCircle }, { key: 'staff', label: 'Staff', icon: Briefcase }]`.
- [x] 3.2 Mudar estado inicial `useState<TabKey>('equipa')` para que a tab Equipa seja default.
- [x] 3.3 Renomear `loadStaff()` → `loadAllMembers()`; guardar resultado em `allMembers` em vez de `staffMembers`.
- [x] 3.4 Derivar `consultantMembers` e `staffMembers` via `useMemo(() => allMembers.filter(...), [allMembers])` usando `classifyMember(ur.roles?.name)` para cada `user_roles` do membro.
- [x] 3.5 No branch de renderização por tab, trocar `isLoadingStaff` por `isLoadingAll`; usar `allMembers`/`consultantMembers`/`staffMembers` conforme tab.
- [x] 3.6 No tab `Equipa`, mostrar sempre um badge secundário com `role.name` em cada card/linha (incluindo na vista grid e tabela).
- [x] 3.7 Manter o toggle grid/tabela visível em `equipa` e `consultores`; escondê-lo em `staff` (comportamento actual preservado).

## 4. Botão "Novo Membro" e diálogo

- [x] 4.1 Em [app/dashboard/consultores/page.tsx](app/dashboard/consultores/page.tsx), substituir `Novo Consultor` em: texto visível (`<span>`), `aria-label`, e `title` → `Novo Membro`.
- [x] 4.2 Remover o filtro `.filter((r) => CONSULTANT_ROLES.includes(r.name))` dentro de `loadRoles()` — passar a setRoles com todos os roles activos tal como a API devolver.
- [x] 4.3 Computar `defaultRoleName` com base em `activeTab`: `consultores → 'Consultor'`, `staff → 'Staff'`, `equipa → undefined`. Passar como prop ao `CreateConsultantDialog`.
- [x] 4.4 Em [components/consultants/create-consultant-dialog.tsx](components/consultants/create-consultant-dialog.tsx), aceitar prop `defaultRoleName?: string`.
- [x] 4.5 Adicionar `useEffect` de pré-selecção silenciosa (sem sobrepor selecções manuais) + reset de `role_id`/`step` ao fechar para permitir que a próxima abertura reaplique o default da tab actual.
- [x] 4.6 Substituir `Novo Consultor` pelo texto `Novo Membro` no título do header do diálogo + "Criar Consultor" → "Criar Membro" no botão final + mensagens de toast.
- [x] 4.7 Verificado: o submit envia `role_id: form.role_id || undefined` para `POST /api/consultants`, que já insere em `user_roles` (linhas 177-184 da route) — mudança não-intrusiva, o endpoint já suporta qualquer role_id válido.

## 5. Correcção de padding/largura em desktop

- [x] 5.1 Envolver o return da `ConsultoresPageContent` num `<div className="w-full max-w-[1600px] mx-auto">` substituindo o actual `<div>` sem classes, sem adicionar qualquer `p-*` próprio. (nota: `space-y-6` omitido aqui porque o layout interno já gere espaçamento entre toolbar e `<div className="mt-3 sm:mt-6 pb-6">`).
- [x] 5.2 Garantir que o skeleton (`ConsultoresPageSkeleton`) usa o mesmo wrapper para evitar "jumps" de largura entre loading e loaded.
- [ ] 5.3 **Manual (user)** — Validar visualmente em viewport `sm` (`< 768px`) que o layout mantém a aparência de IMG3 (padding herdado do `<main>`). Root da página agora é `<div className="w-full max-w-[1600px] mx-auto">` sem `p-*` próprio.
- [ ] 5.4 **Manual (user)** — Validar em viewport `≥ 1280px` que o conteúdo fica contido pelo `max-w-[1600px]` e não dispersa em monitores largos.

## 6. Smoke tests manuais

- [ ] 6.1 **Manual (user)** — Criar um novo membro com role `Consultor` a partir da tab Consultores; confirmar que aparece em Equipa + Consultores, ausente de Staff.
- [ ] 6.2 **Manual (user)** — Criar um novo membro com role `Staff` a partir da tab Staff (role já existe via migration task 1.1); confirmar que aparece em Equipa + Staff, ausente de Consultores.
- [ ] 6.3 **Manual (user)** — Criar um novo membro com role `Marketing` a partir da tab Equipa (sem pré-selecção); escolher manualmente `Marketing`. Confirmar que aparece em Equipa + Staff (porque `Marketing ∈ STAFF_ROLE_NAMES`).
- [ ] 6.4 **Manual (user)** — Verificar auditoria em `log_audit` após cada criação (entradas `entity_type='dev_user'` ou equivalente já existente). Nota: `POST /api/consultants` grava em `user_roles` — confirmar se já existe um insert em `log_audit` lá (fora do âmbito deste change adicionar auditoria nova).
- [x] 6.5 `npm run build` — compilação OK (ver 2.4); único warning é a pre-existente deprecação `middleware → proxy` (fora do âmbito deste change).
