## ADDED Requirements

### Requirement: Endpoint cron `/api/automacao/scheduler/spawn-runs`

O sistema SHALL expor um endpoint HTTP (POST ou GET) em `/api/automacao/scheduler/spawn-runs` que, quando invocado com `Authorization: Bearer <CRON_SECRET>`, consulta automatismos agendados e cria `auto_runs` executáveis.

#### Scenario: Autenticação
- **WHEN** o endpoint é invocado sem bearer token ou com token inválido
- **THEN** o sistema responde 401

#### Scenario: Invocação autorizada
- **WHEN** o endpoint é invocado com `CRON_SECRET` válido
- **THEN** o sistema processa um tick e devolve JSON com `{ evaluated, spawned, skipped, errors, duration_ms }`

#### Scenario: Invocação periódica
- **WHEN** Vercel Cron invoca o endpoint a cada minuto
- **THEN** cada invocação é independente e idempotente — duas invocações concorrentes não causam disparos duplicados (garantido pela chave única em `contact_automation_runs`)

### Requirement: Selecção de automatismos elegíveis

O spawner SHALL seleccionar até 50 automatismos por tick onde `status='scheduled' AND trigger_at <= now() + interval '5 minutes'`, ordenados por `trigger_at asc`.

#### Scenario: Janela de 5 minutos
- **WHEN** um automatismo tem `trigger_at = now() + 3 minutes`
- **THEN** o spawner dispara-o neste tick (tolerância para clock drift entre Vercel Cron e Supabase)

#### Scenario: Batch máximo
- **WHEN** existem 200 automatismos elegíveis
- **THEN** o tick processa apenas os primeiros 50 (por `trigger_at asc`); os restantes serão processados nos ticks seguintes

#### Scenario: Automatismo cancelado
- **WHEN** um automatismo tem `status='cancelled'` e `trigger_at` no passado
- **THEN** o spawner ignora

### Requirement: Cálculo da próxima ocorrência (`trigger_at`)

O sistema SHALL calcular `trigger_at` com base em `event_type`, `event_config`, `send_hour`, `timezone` e a data actual.

#### Scenario: Aniversário do contacto
- **WHEN** `event_type='aniversario_contacto'` e `leads_contacts.date_of_birth` é 1985-04-20
- **AND** hoje é 2026-04-14 (antes do aniversário deste ano)
- **THEN** `trigger_at = 2026-04-20 08:00 Europe/Lisbon`

#### Scenario: Aniversário já passou este ano
- **WHEN** `event_type='aniversario_contacto'` e `date_of_birth` é 1985-02-10
- **AND** hoje é 2026-04-14
- **THEN** `trigger_at = 2027-02-10 08:00 Europe/Lisbon`

#### Scenario: Aniversário de fecho de negócio
- **WHEN** `event_type='aniversario_fecho'` e `negocios.expected_close_date` é 2024-06-15
- **AND** hoje é 2026-04-14
- **THEN** `trigger_at = 2026-06-15 08:00 Europe/Lisbon`

#### Scenario: Natal
- **WHEN** `event_type='natal'`
- **THEN** `trigger_at` é sempre 25 de Dezembro do ano corrente ou seguinte (se já passou) à hora e timezone configuradas

#### Scenario: Ano Novo
- **WHEN** `event_type='ano_novo'`
- **THEN** `trigger_at` é sempre 1 de Janeiro do próximo ano à hora e timezone configuradas

#### Scenario: Festividade personalizada
- **WHEN** `event_type='festividade'` e `event_config = {label: 'São João', month: 6, day: 24}`
- **THEN** `trigger_at` é o próximo 24 de Junho à hora e timezone configuradas

#### Scenario: Ano bissexto
- **WHEN** `date_of_birth` é 1992-02-29 e o próximo ano não é bissexto
- **THEN** `trigger_at` é 28-02 desse ano (fallback para 28-02)

### Requirement: Construção de run efémero

Para cada automatismo elegível, o spawner SHALL criar um `auto_run` com `flow_id=null`, `triggered_by='schedule'`, `entity_type='contact_automation'`, `entity_id=<automation.id>`, e inserir `auto_step_runs` com um `node_data_snapshot` (jsonb) embutido para cada canal activo.

#### Scenario: Canal email
- **WHEN** `channels=['email']`
- **THEN** o spawner cria um `auto_step_runs` com `node_type='email'`, `node_id='inline-email'`, `node_data_snapshot={ type: 'email', emailTemplateId, recipientVariable: 'contact_email', senderName, senderEmail, subject?, bodyHtml? (de overrides), ... }`, `status='pending'`, `scheduled_for=now()`

#### Scenario: Canal WhatsApp
- **WHEN** `channels=['whatsapp']`
- **THEN** o spawner cria um step análogo com `node_type='whatsapp'` e inclui `wppInstanceId` em `flowMeta`

#### Scenario: Dois canais
- **WHEN** `channels=['email','whatsapp']`
- **THEN** o spawner cria dois steps no mesmo run (um por canal), ambos `pending` e imediatamente executáveis pelo worker

### Requirement: Adaptação mínima do worker para runs efémeros

O worker em [app/api/automacao/worker/route.ts](app/api/automacao/worker/route.ts) SHALL, quando o step tem `node_data_snapshot` não-null, usar esse snapshot em vez de carregar `auto_flows.published_definition`.

#### Scenario: Step com snapshot
- **WHEN** o worker reclama um step com `node_data_snapshot` preenchido
- **THEN** constrói `node={ id: step.node_id, type: step.node_type, data: step.node_data_snapshot }` e passa ao processador correspondente

#### Scenario: Step com flow_id
- **WHEN** o step tem `flow_id` não-null e `node_data_snapshot` null
- **THEN** o worker mantém o comportamento actual (carregar published_definition)

### Requirement: Resolução de variáveis de contacto antes do envio

Imediatamente antes de criar os steps, o spawner SHALL invocar `resolveContactVariables(supabase, contact_id, deal_id?)` e colocar o resultado em `auto_runs.context.variables`.

#### Scenario: Contacto sem email e canal inclui email
- **WHEN** o contacto não tem `email` e `channels` inclui `email`
- **THEN** o spawner não cria step de email e regista `contact_automation_runs.status='skipped'` com `skip_reason='missing_email'`
- **AND** se o canal WhatsApp também estiver, o step de WhatsApp é criado normalmente (falha parcial ≠ falha total)

#### Scenario: Contacto sem telemóvel e canal inclui WhatsApp
- **WHEN** o contacto não tem `phone` e `channels` inclui `whatsapp`
- **THEN** o spawner não cria step de WhatsApp e marca skip análogo

#### Scenario: Todos os canais skipados
- **WHEN** nenhum step é criável
- **THEN** o `auto_run` não é criado (evita run órfão) e o `contact_automation_runs` é inserido com `status='skipped'` e o agendamento é reagendado ou concluído conforme recorrência

### Requirement: Reagendamento pós-execução

Após criar o run (ou skipar), o spawner SHALL actualizar `contact_automations`:

- Se `recurrence='yearly'`: recalcular `trigger_at` para o ano seguinte e manter `status='scheduled'`.
- Se `recurrence='once'`: actualizar `status='completed'` (ou `status='cancelled'` se skip por falta de dados fundamental, decisão documentada).

#### Scenario: Anual avança
- **WHEN** um automatismo `yearly` dispara em 2026-04-20
- **THEN** após o spawn `trigger_at=2027-04-20` e `status='scheduled'`

#### Scenario: Uma vez termina
- **WHEN** um automatismo `once` dispara
- **THEN** após o spawn `status='completed'` e não é seleccionado em ticks futuros

### Requirement: Logging de ticks em `auto_scheduler_log`

O sistema SHALL persistir cada tick do spawner em `auto_scheduler_log` com `id`, `tick_at` (timestamptz), `evaluated_count`, `spawned_count`, `skipped_count`, `error_count`, `error_detail` (text nullable), `duration_ms`, `created_at`.

#### Scenario: Tick normal
- **WHEN** um tick processa 5 automatismos com sucesso
- **THEN** `auto_scheduler_log` recebe 1 linha com `evaluated=5, spawned=5, errors=0`

#### Scenario: Erro no tick
- **WHEN** uma excepção não tratada ocorre a meio do tick
- **THEN** o endpoint captura, regista linha com `error_count>0` e `error_detail` preenchido, devolve 500 para a Vercel ver no log

### Requirement: Flag de desactivação de emergência

O sistema SHALL respeitar a variável de ambiente `AUTOMACAO_SPAWNER_ENABLED`. Quando `false`, o endpoint devolve 200 com `{ disabled: true }` sem processar nada.

#### Scenario: Desactivado
- **WHEN** `AUTOMACAO_SPAWNER_ENABLED=false`
- **THEN** o endpoint retorna imediatamente `{ disabled: true, evaluated: 0, spawned: 0 }`

### Requirement: Integração com Vercel Cron

O ficheiro `vercel.json` SHALL conter uma entrada em `crons` apontando para `/api/automacao/scheduler/spawn-runs` com schedule `* * * * *` (a cada minuto).

#### Scenario: Configuração presente
- **WHEN** `vercel.json` é lido
- **THEN** contém `{ "path": "/api/automacao/scheduler/spawn-runs", "schedule": "* * * * *" }`
