## Context

O ERP Infinity tem um runtime de automações baseado em React Flow + Supabase com três peças já em produção:

- **Editor visual** de flows (`auto_flows.draft_definition` → `published_definition`).
- **Worker** em [app/api/automacao/worker/route.ts](app/api/automacao/worker/route.ts) invocado por cron que consome `auto_step_runs` via RPC `auto_claim_steps`, executa processadores de nó e encadeia os próximos steps.
- **Processadores** para `email` ([lib/node-processors/email.ts](lib/node-processors/email.ts)) e `whatsapp` ([lib/node-processors/whatsapp.ts](lib/node-processors/whatsapp.ts)) que resolvem `{{variaveis}}` e enviam via Edge Function Resend ou UAZAPI.

Lacuna crítica identificada: `auto_triggers` com `source_type='schedule'` guardam a expressão cron em `trigger_condition` mas **nenhum código cria `auto_runs` quando a hora bate**. Só webhooks e execução manual geram runs.

Os dados de interesse vivem em duas tabelas com nomes PT: `leads_contacts` (com `date_of_birth date`) e `negocios` (com `expected_close_date date`). Os consultores já gerem contactos e negócios por essa via.

A equipa quer avançar com uma UX focada no contacto (não no fluxo visual) para o caso de uso "enviar uma mensagem numa data especial". O fluxo visual continua a existir para orquestrações complexas, mas **automatismos por-contacto ganham uma entidade e wizard dedicados** que reusam o runtime.

**Stakeholders**: consultores (users primários), equipa de dev (manutenção do runtime), admins de templates (editam a biblioteca).

**Constraints**:
- Reutilizar `auto_runs`/`auto_step_runs` e os processadores existentes — evitar duplicar lógica de envio.
- Não exigir que o utilizador aprenda o editor visual para este caso de uso.
- Manter compatibilidade com flows visuais existentes.
- Timezone padrão `Europe/Lisbon`, 08:00 como hora default.
- Envios via instância UAZAPI activa do utilizador (WhatsApp) e conta SMTP activa (email) — já existentes no sistema.

## Goals / Non-Goals

**Goals:**
- Entregar tab "Automatismos" funcional na página de contacto com wizard de criação em 6 passos, listagem, edição de agendamentos pendentes, cancelamento individual e em lote, histórico de envios.
- Fechar a lacuna do spawner de schedule: endpoint cron que converte `contact_automations` (e opcionalmente `auto_triggers` de schedule no futuro) em `auto_runs` executáveis pelo worker existente.
- Resolver variáveis de template a partir de `leads_contacts` e `negocios` num helper único reutilizável.
- Formalizar categorias de templates para filtragem contextual no wizard.

**Non-Goals:**
- **Não** implementar spawner genérico para `auto_triggers.source_type='schedule'` neste ciclo — fica como extensão natural usando a mesma infra, mas fora de âmbito para não alargar blast radius.
- **Não** migrar templates existentes para forçar categoria (seed de valores canónicos + default `geral` cobre legado).
- **Não** criar novo editor visual de templates — usa-se a infra existente.
- **Não** adicionar novos tipos de mensagem WhatsApp (poll, contact, media) — wizard inicial só activa templates já existentes.
- **Não** suportar automatismos por-equipa, por-tag ou por-segmento — só por-contacto individual.
- **Não** substituir o runtime actual — é aditivo.

## Decisions

### D1. Entidade dedicada `contact_automations` em vez de `auto_triggers` genérico

`auto_triggers` está acoplado a `auto_flows.published_definition` (cron trigger é um nó dentro de um flow visual). Tentar reutilizá-lo para automatismos por-contacto obrigaria a gerar flows sintéticos, um por automatismo, poluindo o editor e complicando a UX.

**Decisão**: criar `contact_automations` como fonte de agendamento independente. O spawner constrói um `auto_run` "efémero" com `flow_id NULL` e `published_definition` inline no `context`, passando directamente ao worker.

**Alternativa considerada**: criar um flow visual template ("birthday-email-v1") e instanciá-lo por contacto. Rejeitada: acopla a UX a um template visual que o utilizador não desenha; versionamento desse flow torna-se um pesadelo.

### D2. Spawner dedicado `/api/automacao/scheduler/spawn-runs`, cron Vercel minute-level

O worker actual processa steps pendentes; não faz sentido misturar "spawn de novos runs" na mesma rota. Separar responsabilidades:

- **Spawner** (novo): lê `contact_automations` onde `status='scheduled' AND trigger_at <= now()`, cria `auto_runs` + `auto_step_runs` iniciais, reagenda ou conclui.
- **Worker** (existente): consome `auto_step_runs` pendentes e envia.

Cron Vercel invoca ambos a cada minuto com `CRON_SECRET`.

**Alternativa**: pg_cron + função SQL no Supabase. Rejeitada: lógica de reagendamento (aniversários, anos bissextos, fuso horário) fica mais legível em TS, e já temos Vercel Cron configurado.

### D3. Step dinâmico sem passar pelo fluxo visual

O spawner cria directamente registos em `auto_step_runs` com `node_id='inline-email'` ou `'inline-whatsapp'` e um `node_data_snapshot` (JSONB) embutido. O worker aprende a ler o snapshot quando `flow_id` é null ou quando o node não existe no `published_definition`.

**Alteração mínima no worker**: se `flow_id=null`, usar `step.node_data_snapshot` em vez de carregar flow. Processadores recebem o mesmo contrato (`node.data`).

**Alternativa**: criar um flow visual sintético por automatismo. Rejeitada (ver D1).

### D4. Recorrência "yearly" reagenda ao completar; "once" marca `completed`

Após o run concluir, o spawner (ou um trigger no `auto_runs` de status=completed com entity_type='contact_automation') recalcula `trigger_at` para o próximo ano e actualiza `contact_automations.status` para `scheduled`. Se `recurrence='once'`, fica `completed`.

**Implementação**: simplificar usando um step final implícito (`type='contact_automation_reschedule'`) ou, mais simples, um passo pós-envio no próprio spawner que processa runs concluídos das últimas 24h e reagenda.

**Decisão**: reagendamento feito no próprio spawner em cada tick — idempotente e evita triggers SQL.

### D5. Variáveis resolvidas no momento do spawn, não no envio

Motivação: se o contacto mudar de email/telemóvel entre o agendamento e o envio, queremos a versão mais recente. O spawner faz a resolução imediatamente antes de criar o step, mas **relê sempre no instante do spawn** (não no momento da criação do automatismo).

Helper único: `lib/automacao/resolve-contact-variables.ts` exporta `resolveContactVariables(supabase, contactId, dealId?)` que devolve `Record<string, string>`. Reutilizável também em envio manual futuro.

### D6. Overrides de template por-instância (JSONB)

O wizard permite editar subject/body do email ou `messages` do WhatsApp só para este contacto. Guardamos em `contact_automations.template_overrides` como `{ email?: {subject, body_html}, whatsapp?: {messages: WhatsAppMessage[]} }`. Quando o spawner construir o step, aplica overrides por cima do template base.

**Edição de agendamento pendente**: UI permite editar `template_overrides` e/ou trocar `email_template_id`/`wpp_template_id` enquanto `status='scheduled'`. Depois de enviado, imutável (histórico em `contact_automation_runs`).

### D7. Categorias via seed e UI enforcement (sem migration breaking)

Ambas as tabelas de template já têm coluna `category text`. Não há enforcement hoje. Decisão: popular seed com valores canónicos + validação Zod no POST/PUT de templates + dropdown obrigatório na UI. Templates existentes com `category=null` ficam visíveis sob o rótulo "Geral" até serem editados.

**Valores canónicos**: `aniversario_contacto`, `aniversario_fecho`, `natal`, `ano_novo`, `festividade`, `custom`, `geral`.

### D8. Idempotência: uma execução por (automation, trigger_at)

Índice único `contact_automation_runs (contact_automation_id, scheduled_for)` impede duplicação se o spawner correr duas vezes no mesmo minuto. Chave `(automation_id, trigger_at)` define a "ocorrência".

### D9. Rate limit: partilha com o worker actual

Partilhar o `auto_flow_rate_limiter` existente (max 20 runs por flow em 5 min). Como `flow_id=null` para automatismos por-contacto, usar `entity_type='contact_automation'` + `entity_id=automation.id` para rate limit por automatismo (defensivo: máx. 1 run por minuto por automatismo).

### D10. Cancelamento em lote ≠ eliminação

`DELETE /api/contacts/[id]/automations` (bulk) apenas marca `status='cancelled'` em todos os automatismos `scheduled` do contacto. Automatismos `completed` ou `sent` ficam intocados (histórico). Eliminação definitiva não é exposta na UI.

## Risks / Trade-offs

- **[Spawner falha silenciosamente e automatismos não disparam]** → Mitigação: logging estruturado em cada tick (`auto_scheduler_log` com `tick_at`, `evaluated_count`, `spawned_count`, `error`); alerta se `spawned=0` durante N ticks consecutivos onde `evaluated>0` (observabilidade em fase 2).
- **[Clock drift entre Vercel Cron e Supabase]** → Mitigação: aceitar janela de 5min (`trigger_at <= now() + interval '5 min'`) para garantir que pequenos atrasos de cron não saltam disparos; idempotência cobre duplicação.
- **[Timezone bugs em aniversários perto de meia-noite]** → Mitigação: armazenar `trigger_at` como `timestamptz` calculado a partir de `(month, day, send_hour, timezone)` usando `date_fns-tz`; testes unitários cobrem DST.
- **[Contacto sem email/telefone ao disparar]** → Mitigação: spawner valida presença antes de criar step; se falhar, marca `contact_automation_runs.status='skipped'` com razão, não cria step. UI mostra aviso na criação.
- **[Template apagado depois de agendado]** → Mitigação: FK `ON DELETE SET NULL` em `email_template_id`/`wpp_template_id`; spawner detecta e falha graciosamente marcando run `failed` com razão `template_deleted`. Se houver `template_overrides`, usa-os em vez do template apagado.
- **[Instância UAZAPI desconectada no momento do envio]** → Já coberto pelo processor WhatsApp (throw com mensagem clara). Run fica `failed`, contacto continua na próxima ocorrência anual.
- **[Blast radius de bug no spawner: envio duplicado a muitos contactos]** → Mitigação: índice único (D8), rate limit (D9), batch size máximo 50 por tick.
- **[Carga de leitura em `leads_contacts`/`negocios` no spawn]** → Baixa (só automatismos com `trigger_at <= now()`, tipicamente dezenas/centenas). Índice em `contact_automations(status, trigger_at)` e índice em `leads_contacts(date_of_birth)` para queries de listagem/filtro.
- **[Utilizador cria "Natal" e "Ano Novo" com recorrência anual mas eventualmente desactiva o contacto]** → Spawner verifica `leads_contacts.status != 'inactive'` (ou equivalente) antes de disparar; se inactivo, marca run `skipped`.

## Migration Plan

1. **Aplicar migration** criando `contact_automations`, `contact_automation_runs`, `auto_scheduler_log` e índices. Zero downtime.
2. **Deployar backend**: endpoints de CRUD, spawner, helper de variáveis. Spawner inactivo até configurar cron.
3. **Seed de categorias canónicas** em `tpl_email_library`/`auto_wpp_templates`: apenas catálogo de valores permitidos (não altera dados existentes). Templates legados ficam com `category=null` e aparecem como "Geral" no dropdown.
4. **Deployar frontend**: tab Automatismos, wizard, listagem.
5. **Adicionar entrada Vercel Cron** apontando para `/api/automacao/scheduler/spawn-runs` a cada minuto.
6. **Monitorizar `auto_scheduler_log`** durante 48h — verificar que ticks correm, automatismos disparam e runs completam.
7. **Rollback**: remover entrada Vercel Cron (pára disparos); flag `AUTOMACAO_SPAWNER_ENABLED=false` envolve o endpoint (retorna 200 no-op). Tabelas mantêm-se para preservar histórico.

## Open Questions

- **Festividades custom com expressão cron** — vale a pena instalar `cron-parser` agora ou limitamo-nos a "data única" + "recorrência anual a partir de data fixa"? Proposta: começar sem `cron-parser`, avaliar depois.
- **Envio em massa (ex: Natal para todos os contactos)** — fora de âmbito neste ciclo; wizard força selecção por-contacto. Próximo ciclo poderá introduzir "aplicar a todos os contactos com esta tag".
- **Notificação ao consultor após envio** — cria `tasks` entry, toast na próxima abertura do dashboard, ou nenhum? Proposta: nenhum por agora, histórico visível na tab Automatismos é suficiente.
- **Teste "Enviar agora" no wizard** — útil para validar template antes de agendar? Provavelmente sim, mas adiar para iteração seguinte.
