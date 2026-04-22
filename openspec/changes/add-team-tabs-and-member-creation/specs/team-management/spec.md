## ADDED Requirements

### Requirement: Página de Equipa com três tabs

A página `/dashboard/consultores` SHALL apresentar exactamente três tabs pela seguinte ordem e significado:

1. **Equipa** — lista **todos** os membros com `dev_users.is_active = true` (ou togglable com filtro "inactivos"), independentemente do role.
2. **Consultores** — lista membros cujo role se classifica como consultor (conjunto `CONSULTANT_ROLE_NAMES` em `lib/auth/roles.ts`, ex.: `Consultor`, `Consultora Executiva`, `Team Leader`).
3. **Staff** — lista membros cujo role se classifica como staff (conjunto `STAFF_ROLE_NAMES`, ex.: `Office Manager`, `Gestora Processual`, `Marketing`, `recrutador`, `Staff`).

A tab "Equipa" MUST ser a tab inicial ao abrir a página sem parâmetro `tab` na URL. A contagem de cada tab SHALL ser calculada client-side a partir da lista já obtida (sem queries adicionais).

#### Scenario: Abertura inicial mostra Equipa completa
- **WHEN** o utilizador navega para `/dashboard/consultores` sem query `tab`
- **THEN** a tab "Equipa" aparece seleccionada e a tabela/grid lista todos os membros activos, incluindo consultores e staff, ordenados por nome comercial.

#### Scenario: Filtragem por tab Consultores
- **WHEN** o utilizador clica na tab "Consultores"
- **THEN** apenas membros cujo role.name ∈ `CONSULTANT_ROLE_NAMES` ficam visíveis e o contador do tab reflecte esse subset.

#### Scenario: Filtragem por tab Staff
- **WHEN** o utilizador clica na tab "Staff"
- **THEN** apenas membros cujo role.name ∈ `STAFF_ROLE_NAMES` ficam visíveis, incluindo quem tenha o novo role `Staff`.

#### Scenario: Membro sem role aparece só em Equipa
- **WHEN** existe um membro com `role_id` nulo
- **THEN** esse membro aparece na tab "Equipa" mas não aparece nas tabs "Consultores" nem "Staff".

### Requirement: Botão "Novo Membro" substitui "Novo Consultor"

O botão principal de criação na página de equipa SHALL apresentar o texto **"Novo Membro"**, com `aria-label="Novo Membro"` e `title="Novo Membro"`. O cabeçalho do diálogo de criação SHALL também mostrar "Novo Membro" como título (substituindo "Novo Consultor") mantendo o subtítulo contextual ("Dados Gerais", "Credenciais", etc.) por step.

#### Scenario: Label actualizada em desktop e mobile
- **WHEN** o utilizador observa o botão de criação em qualquer breakpoint
- **THEN** o texto visível e os atributos `aria-label`/`title` são `"Novo Membro"`.

#### Scenario: Título do diálogo reflecte a mudança
- **WHEN** o utilizador abre o diálogo clicando em "Novo Membro"
- **THEN** o header do diálogo mostra "Novo Membro" como título principal em todos os steps.

### Requirement: Dropdown de função no diálogo lista todos os roles activos

O selector de função (`Função`) dentro do step "Dados Gerais" do `CreateConsultantDialog` SHALL listar **todos os roles activos** devolvidos por `GET /api/libraries/roles`, sem filtragem por `CONSULTANT_ROLES`. Cada item mostra `role.name` como label. Roles inactivos (`is_active = false`, se a coluna existir) MUST ser omitidos.

O diálogo SHALL aceitar uma prop opcional `defaultRoleName: string` que, se recebida e se o role existir na lista, pré-selecciona esse role no dropdown.

#### Scenario: Todos os roles aparecem sem filtro
- **WHEN** o utilizador abre o diálogo "Novo Membro" e inspecciona o dropdown "Função"
- **THEN** são listados todos os roles existentes na tabela `roles` (incluindo Marketing, Office Manager, Staff, etc.), não apenas `Consultor`/`Consultora Executiva`/`Team Leader`.

#### Scenario: Pré-selecção a partir do tab activo
- **WHEN** o utilizador está no tab "Staff" e clica em "Novo Membro"
- **THEN** o dropdown "Função" abre com o role `Staff` pré-seleccionado.

#### Scenario: Pré-selecção para tab Consultores
- **WHEN** o utilizador está no tab "Consultores" e clica em "Novo Membro"
- **THEN** o dropdown abre com o role `Consultor` pré-seleccionado.

#### Scenario: Sem pré-selecção na tab Equipa
- **WHEN** o utilizador está no tab "Equipa" e clica em "Novo Membro"
- **THEN** o dropdown abre no placeholder "Seleccionar função" sem valor pré-escolhido.

### Requirement: Garantir existência do role `Staff`

O sistema SHALL garantir que existe um registo em `roles` com `name = 'Staff'` antes da página permitir criar um membro nesse role. A garantia MUST ser aplicada via migration SQL idempotente (`insert … on conflict (name) do nothing`) e NÃO por mutação ad-hoc na UI.

O role `Staff` criado MUST ter:
- `name = 'Staff'` (case-sensitive, label exibível).
- `description` preenchida (ex.: "Membro interno não-comercial").
- `permissions` jsonb mínimo coerente com os restantes módulos (sem acesso a `settings`, sem `commissions`; valores exactos definidos em `design.md`).

#### Scenario: Migration cria role se não existir
- **WHEN** a migration é aplicada numa base onde `roles.name = 'Staff'` não existe
- **THEN** uma nova linha é inserida com o `name`, `description` e `permissions` especificados.

#### Scenario: Migration é idempotente
- **WHEN** a migration é re-aplicada numa base onde `roles.name = 'Staff'` já existe
- **THEN** nenhuma linha duplicada é criada e nenhuma linha existente é modificada.

#### Scenario: Criação de membro com role Staff funciona end-to-end
- **WHEN** o utilizador cria um novo membro seleccionando `Staff` no dropdown
- **THEN** `POST /api/consultants` completa com sucesso, grava `user_roles.role_id` correspondente ao id do role `Staff`, e o novo membro aparece na tab "Staff".

### Requirement: Classificação partilhada de membros em roles.ts

O módulo `lib/auth/roles.ts` SHALL exportar:

- `CONSULTANT_ROLE_NAMES: readonly string[]` — roles classificados como consultor.
- `STAFF_ROLE_NAMES: readonly string[]` — roles classificados como staff (inclui `'Staff'`).
- `classifyMember(roleName: string | null | undefined): 'consultor' | 'staff' | 'other'` — devolve o bucket ao qual o role pertence; `'other'` se for nulo ou não estiver em nenhum conjunto (ex.: `Broker/CEO`, `cliente`).

O tab "Equipa" SHALL ignorar o bucket e mostrar tudo. Os tabs "Consultores" e "Staff" SHALL usar estritamente `classifyMember()` para filtrar, garantindo consistência entre UI e qualquer contador server-side futuro.

#### Scenario: Role Consultor classifica como consultor
- **WHEN** `classifyMember('Consultor')` é chamado
- **THEN** devolve `'consultor'`.

#### Scenario: Role Staff classifica como staff
- **WHEN** `classifyMember('Staff')` é chamado
- **THEN** devolve `'staff'`.

#### Scenario: Role desconhecido classifica como other
- **WHEN** `classifyMember('Broker/CEO')` é chamado (não pertencente a nenhum dos conjuntos)
- **THEN** devolve `'other'` e o membro só aparece na tab "Equipa".

### Requirement: Padding consistente entre mobile e desktop

A página `/dashboard/consultores` SHALL herdar o padding do `<main>` do layout do dashboard (`p-4 md:p-6`) sem adicionar container/padding redundante que dobre o espaçamento em desktop. O layout visível em mobile (IMG3 de referência) e em desktop MUST apresentar o mesmo respiro relativo ao conteúdo (card de tabs + tabela).

O contentor root da página MUST usar apenas utilitários de layout (`space-y-*`, `flex`, `gap-*`) e NÃO repetir `p-4`/`md:p-6`/`md:p-8` próprios.

#### Scenario: Mobile mantém layout actual
- **WHEN** o utilizador visualiza a página em viewport < `md` (< 768px)
- **THEN** o padding visual corresponde a `p-4` herdado do `<main>`, sem alterações em relação ao comportamento actual.

#### Scenario: Desktop usa o mesmo padding do main
- **WHEN** o utilizador visualiza a página em viewport ≥ `md`
- **THEN** o padding horizontal/vertical externo é exclusivamente `md:p-6` do `<main>`; o conteúdo não tem `padding` adicional nem recuo duplicado que cause "janela dentro de janela".

#### Scenario: Ausência de padding duplicado
- **WHEN** o HTML renderizado é inspeccionado
- **THEN** o primeiro descendente do `<main>` (o root da página) não contém classes `p-4`/`p-6`/`p-8` próprias — apenas `space-y-*`/`flex`/`gap-*`.
