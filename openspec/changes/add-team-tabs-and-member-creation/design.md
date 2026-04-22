## Context

A página `/dashboard/consultores` (rotulada "Equipa" no sidebar — [components/layout/app-sidebar.tsx:85](components/layout/app-sidebar.tsx)) já implementa uma pill-toggle com **dois** tabs (`Consultores` + `Staff`) e reusa o mesmo dataset: faz `GET /api/consultants` e divide client-side com base em `CONSULTANT_ROLES` (hardcoded em [lib/auth/roles.ts:16](lib/auth/roles.ts)). O diálogo [`CreateConsultantDialog`](components/consultants/create-consultant-dialog.tsx) é multi-step (Dados Gerais → Credenciais → …) e recebe `roles` já filtrados por esse mesmo `CONSULTANT_ROLES` em `loadRoles()` ([app/dashboard/consultores/page.tsx:120-137](app/dashboard/consultores/page.tsx)). O botão principal está rotulado `Novo Consultor` em três sítios: `aria-label`, `title` e span visível ([app/dashboard/consultores/page.tsx:241-245](app/dashboard/consultores/page.tsx)).

Isto tem três problemas: (1) não há uma vista "toda a gente" útil para RH/CEO; (2) o dropdown de role é incapaz de criar staff operacional (Office Manager, Marketing, Gestora Processual…), forçando SQL manual; (3) o dataset de staff depende de um role `Staff` que **não existe** em `roles` hoje — o tab "Staff" actual mostra "quem não é consultor", não quem tem o role dedicado. Quanto ao padding, o layout dashboard já aplica `p-4 md:p-6` no `<main>` ([app/dashboard/layout.tsx:170](app/dashboard/layout.tsx)) mas a página tem margens extras que soltam o conteúdo em desktop enquanto o mobile parece centrado (IMG3).

Constraints:
- Stack imutável: Next.js 16 App Router, Supabase Postgres, shadcn/ui, Tailwind v4.
- Não mexer no endpoint `POST /api/consultants` — já aceita qualquer `role_id` ([app/api/consultants/route.ts:177-184](app/api/consultants/route.ts)); apenas alargamos a lista de roles que a UI expõe.
- Evitar novo endpoint para classificação; a tab "Equipa" reusa o mesmo fetch que hoje serve "Staff" (`/api/consultants?consultant_only=false`).

## Goals / Non-Goals

**Goals:**
- Adicionar tab `Equipa` como default, mantendo `Consultores`/`Staff` como vistas filtradas do mesmo dataset.
- Renomear botão + header do diálogo para "Novo Membro" sem mudar o contrato do diálogo nem da API.
- Permitir criar membros com **qualquer** role activo; pré-seleccionar role coerente com o tab actual.
- Garantir via migration idempotente que `roles.name = 'Staff'` existe com `permissions` conservadoras.
- Centralizar classificação (`consultor` vs `staff` vs `other`) em `lib/auth/roles.ts` para ser reusada.
- Harmonizar padding: remover padding duplicado do root da página; o `<main>` é a única fonte.

**Non-Goals:**
- Reescrever o pipeline de permissões ou introduzir RBAC novo — o role `Staff` apenas adiciona um bucket; o que pode ou não fazer dentro do ERP é matéria de `roles.permissions` por módulo (sem mudanças nas páginas existentes).
- Criar/editar roles a partir da UI (fora do âmbito — a criação de roles continua via migration/admin DB).
- Alterar schema de `dev_users`, `user_roles`, ou `dev_consultant_profiles`.
- Mover `/dashboard/consultores` para `/dashboard/equipa`. O URL permanece — só muda o conteúdo e o label/botão.

## Decisions

### Decisão 1 — Adicionar tab `Equipa` como default (primeira posição)
A tab `Equipa` é puramente **client-side**: reusa o fetch já feito em `loadStaff()` (`/api/consultants?consultant_only=false&status=active&per_page=100`), renomeado para `loadAllMembers()`, e expõe a lista completa sem aplicar o filtro de `classifyMember`. As tabs `Consultores`/`Staff` passam a derivar desse mesmo array via `useMemo`. Isto evita um 3º fetch e mantém a página responsiva.

**Alternativa considerada:** fazer 3 fetches separados (um por tab). Rejeitada — triplica load, e o dataset cabe em memória (<1000 membros previsíveis).

### Decisão 2 — `lib/auth/roles.ts` ganha `STAFF_ROLE_NAMES` e `classifyMember()`
```ts
export const CONSULTANT_ROLE_NAMES = ['Consultor', 'Consultora Executiva', 'Team Leader'] as const

export const STAFF_ROLE_NAMES = [
  'Office Manager',
  'Gestora Processual',  // (alias de 'Gestor Processual' — ver Open Question)
  'Marketing',
  'recrutador',
  'intermediario_credito',
  'Staff',
] as const

export function classifyMember(roleName: string | null | undefined): 'consultor' | 'staff' | 'other' {
  if (!roleName) return 'other'
  if ((CONSULTANT_ROLE_NAMES as readonly string[]).includes(roleName)) return 'consultor'
  if ((STAFF_ROLE_NAMES as readonly string[]).includes(roleName)) return 'staff'
  return 'other'
}
```

`CONSULTANT_ROLES` (existente) é **mantido como alias** de `CONSULTANT_ROLE_NAMES` para não quebrar 10+ imports noutros módulos. `classifyMember` também é usado quando eventualmente quisermos contadores server-side.

**Alternativa considerada:** derivar `STAFF_ROLE_NAMES` como "tudo menos consultor e broker". Rejeitada — demasiado frouxo (iria incluir `cliente`, `Broker/CEO`, roles futuros desconhecidos na tab Staff).

### Decisão 3 — Pré-selecção de role no diálogo via prop `defaultRoleName`
O `CreateConsultantDialog` ganha uma prop opcional `defaultRoleName?: string`. A página passa:
- `'Consultor'` se `activeTab === 'consultores'`
- `'Staff'` se `activeTab === 'staff'`
- `undefined` se `activeTab === 'equipa'`

Dentro do diálogo, quando a lista de roles chega, se `defaultRoleName` existir, um `useEffect` corre `setValue('role_id', rolesList.find(r => r.name === defaultRoleName)?.id ?? '')`. Silencioso se não encontrar.

**Alternativa considerada:** passar `role_id` (uuid) directamente. Rejeitada — a página ainda não tem o mapa nome→id quando monta o botão; passar o nome é mais estável.

### Decisão 4 — Migration idempotente para o role `Staff`
Aplicada via `apply_migration` (Supabase MCP). SQL:

```sql
insert into public.roles (name, description, permissions)
values (
  'Staff',
  'Membro interno não-comercial (back-office, marketing, gestão).',
  jsonb_build_object(
    'dashboard', true,
    'properties', true,
    'leads', false,
    'processes', false,
    'documents', true,
    'consultants', false,
    'owners', false,
    'teams', false,
    'commissions', false,
    'marketing', true,
    'templates', false,
    'settings', false,
    'goals', false,
    'store', false,
    'users', false,
    'buyers', false,
    'credit', false,
    'calendar', true,
    'pipeline', false,
    'financial', false,
    'integration', false,
    'recruitment', false,
    'training', true
  )
)
on conflict (name) do nothing;
```

**Rationale das permissões:** staff interno precisa ver dashboard/calendar/training e ler documentos/properties; fica fora de leads, financial, settings, users. Os valores exactos podem ser afinados depois pelo CEO via SQL — a migration só **garante o registo existe**; não o substitui se já existir.

**Alternativa considerada:** `permissions = '{}'::jsonb`. Rejeitada — deixaria staff sem nada visível, UX péssimo no primeiro login.

### Decisão 5 — UI do tab `Equipa` reutiliza grid de consultores com badges de role
O tab `Equipa` usa o mesmo `ConsultantCard`/tabela do tab `Consultores`, mas **sempre** mostra um badge secundário com o `role.name` (já renderizado no tab Staff). Isto torna visível a heterogeneidade sem precisar de componente novo.

O toggle grid/tabela continua disponível em `equipa` + `consultores` e some no tab `staff` (comportamento actual preservado).

### Decisão 6 — Correção de padding
A auditoria mostra que `<main>` já aplica `p-4 md:p-6` ([app/dashboard/layout.tsx:170](app/dashboard/layout.tsx)) e o root da página é `<div>` sem padding — logo o problema visual em desktop não vem de **padding duplicado**, vem da **largura** do conteúdo: sem um `max-w-*`, os cards esticam horizontalmente e em monitores largos perdem proporção face ao mobile.

Solução: envolver o conteúdo da página em `<div className="w-full max-w-[1600px] mx-auto space-y-6">` (sem p-*) para obter consistência com a referência mobile em desktop sem adicionar padding extra. Em viewports < `md`, `max-w-[1600px] mx-auto` é inócuo.

**Alternativa considerada:** adicionar `md:p-8` no root. Rejeitada — duplica padding com o `<main>` e quebra a instrução da spec "root não pode ter `p-*` próprios".

## Risks / Trade-offs

- **[Risco]** Existe incoerência de nomes: CLAUDE.md cita role `Gestora Processual`, `roles.ts` usa `Gestor Processual` em `PROCESS_MANAGER_ROLES`. → **Mitigação**: `STAFF_ROLE_NAMES` inclui **ambas** as grafias (`'Gestor Processual'`, `'Gestora Processual'`) para cobrir bases de dev e prod até uma migration de normalização futura (fora do âmbito).
- **[Risco]** Ao mostrar todos os roles no dropdown, um utilizador pode criar um membro com role `Broker/CEO` ou `admin`, elevando privilégios inadvertidamente. → **Mitigação**: já hoje a página só está acessível a `PermissionGuard module="consultants"` ([app/dashboard/consultores/layout.tsx](app/dashboard/consultores/layout.tsx)); quem chega aqui já tem permissão de gestão. Não adicionamos restrição extra, mas registamos auditoria em `log_audit` (já existente em `POST /api/consultants` — confirmar). Follow-up opcional: esconder roles `admin`/`Broker/CEO` do dropdown excepto para quem também for admin (tracked em Open Questions).
- **[Trade-off]** A tab `Equipa` carrega até 100 membros num request — se a agência crescer > 100 pessoas, paginação terá de ser introduzida. Aceitável hoje (contagem actual < 40).
- **[Risco]** Pré-selecção de `Staff` quando o role ainda não existe (migration por aplicar) deixaria o dropdown vazio para esse tab. → **Mitigação**: tasks.md ordena migration **antes** da mudança UI; além disso, se o nome não existir na resposta de `/api/libraries/roles`, a pré-selecção é silenciosa (placeholder "Seleccionar função").

## Migration Plan

1. **Migration SQL** idempotente (Decisão 4) aplicada primeiro — zero risco mesmo sem o frontend mudar.
2. **`lib/auth/roles.ts`** — adicionar `CONSULTANT_ROLE_NAMES`/`STAFF_ROLE_NAMES`/`classifyMember`; manter `CONSULTANT_ROLES` como alias. Testes de regressão = `npm run build` + smoke de rotas que já usam `CONSULTANT_ROLES`.
3. **Página `/dashboard/consultores`** — adicionar tab `Equipa`, renomear botão, remover filtro em `loadRoles()`, wrap `max-w-[1600px] mx-auto`.
4. **`CreateConsultantDialog`** — header "Novo Membro", aceitar `defaultRoleName`, aplicar `useEffect` de pré-selecção.
5. **Smoke manual** — criar 1 membro Staff, verificar aparece só em Equipa+Staff; criar 1 consultor, verificar aparece em Equipa+Consultores.

**Rollback:** reverter commit da UI + commit de `roles.ts`; a migration fica (não destrutiva). Se o role `Staff` vier a ser indesejado, fica dormente sem utilizadores atribuídos.

## Open Questions

- **Normalização de `Gestor Processual` vs `Gestora Processual`?** CLAUDE.md e `roles.ts` discordam. Decidir e migrar num change separado.
- **Ocultar `admin`/`Broker/CEO` do dropdown?** Follow-up (ver Riscos).
- **Contador de tabs é client-side; queremos server-side eventualmente?** Desnecessário enquanto lista ≤ 100; reavaliar se crescer.
