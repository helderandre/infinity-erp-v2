## ADDED Requirements

### Requirement: Endpoint agregado de saúde de automatismos

O sistema SHALL expor `GET /api/automacao/custom-events/health-summary` que devolve, para um consultor, uma linha por `event_key` com o resumo dos últimos 30 dias de execuções. `event_key` SHALL ser `'aniversario_contacto' | 'natal' | 'ano_novo' | 'custom:<uuid>'`. O endpoint SHALL ser acessível a qualquer utilizador autenticado e SHALL escopar implicitamente ao `consultant_id` do chamador. Utilizadores com role `broker`/`CEO` PODEM passar `?consultant_id=<uuid>` para consultar outro consultor; outros roles SHALL receber 403 se o passarem.

O payload SHALL ter a forma:

```ts
type HealthSummaryRow = {
  event_key: string
  last_run_at: string | null          // ISO timestamp
  last_run_status: "sent" | "failed" | "skipped" | "pending" | null
  runs_last_30d: { sent: number; failed: number; skipped: number; pending: number }
  failed_unresolved: Array<{
    run_id: string
    lead_id: string
    lead_name: string | null
    error_short: string | null        // primeiros 80 chars de error ou skip_reason
  }>
  failed_unresolved_count: number     // pode ser > failed_unresolved.length (truncado em 5)
  completed_one_shot: boolean         // is_recurring=false E ≥1 run com status='sent'
}
```

O campo `failed_unresolved` SHALL conter APENAS runs com `status='failed'` cujo par `(lead_id, event_key)` NÃO tem nenhum run posterior com `status='sent'`. Runs falhados "resolvidos" por um retry bem-sucedido NÃO SHALL aparecer.

A resposta SHALL ter `Cache-Control: private, max-age=30` para mitigar thundering herd.

#### Scenario: Consultor consulta os seus próprios dados

- **GIVEN** um consultor autenticado `user.id = U`
- **AND** `contact_automation_runs` contém, para a última semana, 5 runs `status='sent'` com `event_type='natal'` ligados a leads de U, e 2 runs `status='failed'` com `event_type='natal'` para leads de U (sem retry posterior)
- **WHEN** o consultor faz `GET /api/automacao/custom-events/health-summary`
- **THEN** a resposta SHALL conter uma linha `event_key='natal'`
- **AND** `runs_last_30d.sent === 5`
- **AND** `runs_last_30d.failed === 2`
- **AND** `failed_unresolved_count === 2`
- **AND** `failed_unresolved.length <= 5`

#### Scenario: Broker consulta outro consultor

- **GIVEN** o caller tem role `broker`
- **WHEN** faz `GET /api/automacao/custom-events/health-summary?consultant_id=X`
- **THEN** o payload SHALL ser calculado com scope `consultant_id=X`
- **AND** o HTTP status SHALL ser 200

#### Scenario: Consultor tenta consultar outro consultor

- **GIVEN** o caller tem role `consultor` (não broker)
- **WHEN** faz `GET /api/automacao/custom-events/health-summary?consultant_id=X` com `X !== user.id`
- **THEN** o servidor SHALL devolver 403
- **AND** o corpo SHALL ser `{ error: "Sem permissão para consultar outro consultor" }`

#### Scenario: Retry bem-sucedido resolve a falha

- **GIVEN** para `(lead_id=L, event_key='natal')` existe um run `failed` em T1 e um run `sent` em T2 > T1
- **WHEN** o endpoint é chamado
- **THEN** a linha `event_key='natal'` NÃO SHALL incluir este lead em `failed_unresolved`
- **AND** `failed_unresolved_count` SHALL excluí-lo da contagem

#### Scenario: Evento one-shot concluído

- **GIVEN** um evento custom `is_recurring=false` (`custom_event_id=E`) com pelo menos um run `status='sent'`
- **WHEN** o endpoint é chamado
- **THEN** a linha `event_key='custom:E'` SHALL ter `completed_one_shot: true`

#### Scenario: Evento recorrente nunca é marcado como concluído

- **GIVEN** um evento com `is_recurring=true` e N runs `sent`
- **WHEN** o endpoint é chamado
- **THEN** `completed_one_shot` SHALL ser `false` na linha correspondente, independentemente de N

#### Scenario: Evento sem execuções recentes

- **GIVEN** um evento sem runs nos últimos 30 dias
- **WHEN** o endpoint é chamado
- **THEN** pode não aparecer no payload OU aparecer com `last_run_at=null`, `runs_last_30d` a zeros e `failed_unresolved=[]`
- **AND** a UI SHALL tratar ausência e zeros do mesmo modo (estado "idle")

### Requirement: Scoping por kind resolve consultant_id correctamente

A query interna SHALL resolver `consultant_id` de cada run via `CASE` sobre `kind`:
- `kind='manual'` → `contact_automations.consultant_id`
- `kind='virtual'` → `leads.agent_id` do `lead_id` do run
- `kind='custom_event'` → `custom_commemorative_events.consultant_id`

Runs que não caiam em nenhum destes três buckets SHALL ser ignorados (defensive default).

#### Scenario: Run virtual escopado via lead

- **GIVEN** um run `kind='virtual', lead_id=L, event_type='aniversario_contacto'`
- **AND** `leads.agent_id = U` para o lead L
- **WHEN** o endpoint é chamado por U
- **THEN** o run SHALL entrar no cálculo de `event_key='aniversario_contacto'`

#### Scenario: Run custom_event escopado via evento

- **GIVEN** um run `kind='custom_event', custom_event_id=E`
- **AND** `custom_commemorative_events.consultant_id=U` para E
- **WHEN** o endpoint é chamado por U
- **THEN** o run SHALL entrar no cálculo de `event_key='custom:E'`

#### Scenario: Run de outro consultor é excluído

- **GIVEN** um run cujo consultant_id resolvido é W !== U
- **WHEN** o endpoint é chamado por U (sem `?consultant_id`)
- **THEN** o run NÃO SHALL afectar nenhuma linha do payload
