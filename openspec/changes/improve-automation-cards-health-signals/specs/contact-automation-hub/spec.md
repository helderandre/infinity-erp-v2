## MODIFIED Requirements

### Requirement: Agendados tab combines virtual and manual tracks

A tab "Automatismos" (antiga "Agendados") SHALL apresentar a totalidade dos automatismos do consultor actual como uma **grelha de cards** (fixos + custom), sem tabela geral por baixo. Cada card SHALL comunicar visualmente o estado de saúde, última execução, falhas por resolver e — para one-shots — conclusão, com base no payload de `GET /api/automacao/custom-events/health-summary`.

A tabela `<Table>` de rows (`Lead | Consultor | Evento | Próximo envio | Canais | Estado | Origem`) que existia por baixo da grelha SHALL ser REMOVIDA. Os filtros `Todos os eventos` e `Todos os estados` que serviam essa tabela SHALL ser removidos também. O selector `Consultor` (visível apenas para role broker/CEO) SHALL ser MANTIDO acima da grelha e SHALL afectar o payload de saúde (`?consultant_id=<X>`) e dos contadores de fixos.

#### Scenario: Consultant sees own leads only

- **WHEN** um consultor carrega a tab Automatismos
- **THEN** a grelha SHALL mostrar os 3 cards fixos (aniversário/Natal/Ano Novo) + todos os cards custom criados pelo consultor
- **AND** o payload de saúde SHALL ser filtrado por `consultant_id = user.id`
- **AND** NÃO SHALL existir tabela de rows por baixo da grelha

#### Scenario: Broker sees all consultants

- **WHEN** um utilizador com role broker/CEO carrega a tab
- **THEN** o selector "Consultor" SHALL ser visível acima da grelha
- **AND** por defeito SHALL estar em "Os meus" (`user.id`)
- **AND** mudar para outro consultor re-carrega a grelha + o payload de saúde com esse consultant_id

#### Scenario: Broker seleciona outro consultor

- **WHEN** o broker selecciona `consultor Y` no selector
- **THEN** `useCustomEvents` e `useAutomationHealth` SHALL ser re-pedidos com `?consultant_id=Y`
- **AND** a grelha SHALL mostrar os cards custom de Y + os 3 fixos com contadores de Y

## ADDED Requirements

### Requirement: Card comunica estado de saúde via dot colorido

Cada `<AutomationEventCard>` SHALL receber prop opcional `health?: HealthSummaryRow` e SHALL calcular um dos quatro buckets visuais:

| Bucket                | Condição                                              | Dot         |
| --------------------- | ----------------------------------------------------- | ----------- |
| `completed_one_shot`  | `health.completed_one_shot === true`                  | emerald-600 |
| `failures_unresolved` | `health.failed_unresolved_count > 0`                  | red-500     |
| `ok`                  | `health.last_run_status === 'sent'` nos últimos 30d   | emerald-500 |
| `idle`                | sem runs nos últimos 30d OU sem `health`              | slate-400   |

A prioridade na tabela resolve empates: `failures_unresolved` vence `completed_one_shot`, que vence `ok`, que vence `idle`. O dot SHALL ser renderizado como um `<span>` de 8px posicionado no canto superior direito do card (ou inline junto ao título — decisão de design). O bucket `completed_one_shot` SHALL adicionalmente substituir a badge de status `Activo` por `Concluído` com fundo `bg-emerald-50 text-emerald-700`, e SHALL esconder o chip "Próximo envio" uma vez que o evento já não dispara novamente.

O bucket é ortogonal ao `status` do evento (`active`/`paused`/`archived`): um evento `paused` PODE ter `failures_unresolved` se os runs falharam antes do pause, e o card SHALL mostrar ambos os sinais.

#### Scenario: Card saudável com último envio recente

- **GIVEN** um evento custom com 4 runs `sent` nos últimos 7 dias, 0 falhas
- **WHEN** a grelha é renderizada
- **THEN** o card SHALL mostrar dot emerald-500
- **AND** SHALL mostrar linha "Último envio: há X dias"

#### Scenario: Card com falhas por resolver

- **GIVEN** um evento com `failed_unresolved_count=3`
- **WHEN** a grelha é renderizada
- **THEN** o dot SHALL ser red-500
- **AND** um pill vermelho `⚠ 3 falhas` SHALL aparecer no card

#### Scenario: One-shot concluído

- **GIVEN** um evento custom `is_recurring=false` com `completed_one_shot=true`
- **WHEN** a grelha é renderizada
- **THEN** o dot SHALL ser emerald-600
- **AND** a badge "Activo" no header SHALL ser substituída por "Concluído" com estilo emerald-suave
- **AND** o chip de "Próximo envio" (data/hora) NÃO SHALL aparecer
- **AND** o card SHALL ter opacidade 0.85

#### Scenario: Evento idle ainda sem execuções

- **GIVEN** um evento novo com `last_run_at=null` e zero runs
- **WHEN** a grelha é renderizada
- **THEN** o dot SHALL ser slate-400
- **AND** não SHALL aparecer linha "Último envio" — em vez disso "Próximo envio: <data>"

### Requirement: Badge de falhas expõe leads afectados e deep-link ao sheet

Quando `health.failed_unresolved_count > 0`, o card SHALL renderizar inline um badge clicável `⚠ {count} falha{s}` com fundo vermelho-suave. Hover (desktop) SHALL mostrar tooltip com os nomes dos primeiros até 5 leads (`health.failed_unresolved.map(f => f.lead_name).join(', ')`) + sufixo `, +N` quando `count > failed_unresolved.length`. Clique SHALL abrir o `AutomationDetailSheet` directamente na tab "Envios feitos" com filtro `Só falhados` activo (via prop `initialRunsFilter='failed'`).

Em touch devices (`matchMedia('(pointer: coarse)')`), o tooltip de hover SHALL ser suprimido; o primeiro tap SHALL abrir directamente o sheet filtrado.

#### Scenario: Hover no badge de falhas (desktop)

- **GIVEN** um card com `failed_unresolved=[{lead_name: 'Maria S.'}, {lead_name: 'João P.'}]` e `failed_unresolved_count=2`
- **WHEN** o utilizador faz hover no pill `⚠ 2 falhas`
- **THEN** um tooltip SHALL aparecer com texto "Maria S., João P."

#### Scenario: Contador excede cap de 5

- **GIVEN** `failed_unresolved_count=8` mas `failed_unresolved.length=5`
- **WHEN** o tooltip aparece
- **THEN** SHALL mostrar os 5 nomes seguidos de ", +3"

#### Scenario: Clique abre sheet filtrado

- **WHEN** o utilizador clica no pill `⚠ 2 falhas`
- **THEN** o `AutomationDetailSheet` SHALL abrir para esse evento
- **AND** a tab activa SHALL ser "Envios feitos"
- **AND** o chip "Só falhados" SHALL estar pré-seleccionado

#### Scenario: Touch device salta tooltip

- **GIVEN** um utilizador em dispositivo touch (`pointer: coarse`)
- **WHEN** faz tap no pill
- **THEN** o sheet abre imediatamente sem mostrar tooltip

### Requirement: Card mostra resumo de últimas execuções

Cada card SHALL ter uma linha dedicada ao resumo de execuções, apresentada abaixo dos chips de canal. Conteúdo varia por bucket:

- Bucket `ok` ou `failures_unresolved`: `Último envio: {relativeDate(last_run_at)}` (ex.: "Último envio: há 2 dias").
- Bucket `completed_one_shot`: `Concluído em {shortDate(last_run_at)}`.
- Bucket `idle`: `Sem envios ainda` (texto muted).

Adicionalmente, quando `runs_last_30d.failed > 0` OU o bucket é `failures_unresolved`, o texto SHALL incluir o contador `· ✓ {sent} · ✕ {failed}` (só a parte ✕ é visualmente destacada). Para `ok` com `failed=0`, o contador é suprimido para reduzir ruído visual.

#### Scenario: Card com sucessos e falhas

- **GIVEN** `runs_last_30d: {sent: 12, failed: 2, skipped: 0, pending: 0}`, último envio há 1 dia
- **WHEN** o card é renderizado
- **THEN** a linha de resumo SHALL mostrar "Último envio: há 1 dia · ✓ 12 · ✕ 2"

#### Scenario: Card saudável suprime contador

- **GIVEN** `runs_last_30d: {sent: 3, failed: 0, skipped: 0, pending: 0}`
- **WHEN** o card é renderizado
- **THEN** a linha SHALL mostrar apenas "Último envio: há X dias" (sem contador)

#### Scenario: Card idle sem execuções

- **GIVEN** `runs_last_30d` todos a zero e `last_run_at=null`
- **WHEN** o card é renderizado
- **THEN** a linha SHALL mostrar "Sem envios ainda" em texto muted
