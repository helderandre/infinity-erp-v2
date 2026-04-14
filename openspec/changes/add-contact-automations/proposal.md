## Why

Hoje o módulo de automações só dispara a partir de webhooks ou execução manual. Triggers agendados (`source_type='schedule'`) são guardados em `auto_triggers`, mas não existe nenhum spawner que os converta em `auto_runs` — o cron ficheiro é "letra morta". Consequentemente não há forma de enviar email ou WhatsApp em datas relevantes para um contacto específico (aniversário do contacto, aniversário do fecho do negócio, Natal, Ano Novo ou festividades personalizadas). Os consultores querem esta capacidade para manter proximidade com leads e clientes sem depender de memória ou lembretes manuais.

Esta proposta resolve em conjunto as **lacunas críticas do runtime de agendamento** e entrega uma **UX simples e orientada ao contacto**: uma tab "Automatismos" na página de cada contacto onde se cria, lista, edita e cancela estes envios recorrentes.

## What Changes

- **Nova tab "Automatismos" em `/dashboard/leads/[id]`** (página de contacto) com listagem dos automatismos do contacto, estado de execução e acções (editar template agendado, cancelar individualmente, cancelar tudo).
- **Wizard "Criar automatismo"** em 6 passos:
  1. Tipo de evento: aniversário do contacto, aniversário de fecho de negócio, Natal, Ano Novo, festividade personalizada (data única ou recorrente).
  2. Canal: email, WhatsApp ou ambos.
  3. Remetente: se >1 SMTP/instância UAZAPI activos, perguntar qual; se só um, assumir automaticamente.
  4. Template: escolher existente (filtrado por categoria do evento) ou criar um override ad-hoc só para este contacto; categorias passam a ser um campo obrigatório em templates.
  5. Recorrência: apenas uma vez (próxima ocorrência) ou todos os anos.
  6. Hora de envio (default 08:00 `Europe/Lisbon`, editável).
- **Novas tabelas**: `contact_automations` (fonte de agendamento por-contacto) e `contact_automation_runs` (histórico e ligação ao `auto_delivery_log`).
- **Novo endpoint `/api/automacao/scheduler/spawn-runs`** invocado por Vercel Cron a cada minuto. Lê `contact_automations` com `status='scheduled'` e `trigger_at <= now()`, constrói um `auto_run` efémero com um step `email` e/ou `whatsapp` (usando os processadores existentes), popula variáveis via `resolveContactVariables(contactId, dealId?)`, e reagenda ou conclui conforme a recorrência.
- **BREAKING (suave)**: templates em `tpl_email_library` e `auto_wpp_templates` passam a requerer `category` no formulário de criação/edição (UI apenas — coluna já existe). Valores canónicos: `aniversario_contacto`, `aniversario_fecho`, `natal`, `ano_novo`, `festividade`, `custom`, `geral`.
- **Novas variáveis de template** resolvidas pelo spawner: `{{contact_name}}`, `{{contact_email}}`, `{{contact_phone}}`, `{{contact_birthday}}`, `{{deal_name}}`, `{{deal_closing_date}}`, `{{deal_years_since_close}}`, `{{deal_value}}`, `{{today_date}}`, `{{current_year}}`.
- **Cancelamento em lote** do contacto e **edição de template** só enquanto o run está `scheduled` (nunca após envio).
- **Resolve lacunas A–E** listadas na descrição: spawner de schedule, trigger por campo-data, variáveis contextuais, categorias de templates e logging por-automatismo.

## Capabilities

### New Capabilities

- `contact-automations`: automatismos por-contacto configurados via wizard — CRUD, wizard de 6 passos, listagem, edição de agendamento, cancelamento individual e em lote, histórico de envios por automatismo.
- `schedule-spawner`: worker cron `/api/automacao/scheduler/spawn-runs` que converte `contact_automations` e `auto_triggers` do tipo `schedule` em `auto_runs`, cálculo da próxima ocorrência (aniversário contacto, aniversário fecho, datas fixas, festividade custom), reagendamento anual, rate limiting e idempotência.
- `contact-template-variables`: resolver reutilizável `resolveContactVariables(contactId, dealId?)` que popula o contexto do run com campos de `leads_contacts` e `negocios` e variáveis derivadas (`deal_years_since_close`, `current_year`, `today_date`).
- `template-categories`: categoria obrigatória em `tpl_email_library` e `auto_wpp_templates` com valores canónicos, filtro na listagem de templates e no wizard, seed dos valores base.

### Modified Capabilities

<!-- Nenhuma modificação de specs existentes — openspec/specs/ só contém document-folders-ui, lead-attachments-folders e negocio-documents, que não têm requisitos afectados por esta mudança. -->

## Impact

- **BD (Supabase migrations)**: novas tabelas `contact_automations`, `contact_automation_runs`; não altera `tpl_email_library.category` nem `auto_wpp_templates.category` (já existem) — apenas seed de valores canónicos e índices.
- **APIs novas**: `POST/GET /api/contacts/[id]/automations`, `GET/PATCH/DELETE /api/contacts/[id]/automations/[automationId]`, `DELETE /api/contacts/[id]/automations` (bulk cancel), `GET /api/contacts/[id]/automations/[automationId]/runs`, `POST /api/automacao/scheduler/spawn-runs` (cron).
- **APIs modificadas**: `POST/PUT` de templates passa a validar `category`.
- **Reutilização**: `auto_runs`, `auto_step_runs`, processadores em [lib/node-processors/email.ts](lib/node-processors/email.ts) e [lib/node-processors/whatsapp.ts](lib/node-processors/whatsapp.ts), worker em [app/api/automacao/worker/route.ts](app/api/automacao/worker/route.ts), `auto_delivery_log`, `auto_wpp_instances`, contas SMTP.
- **Vercel Cron**: nova entrada cron a cada minuto apontando para o spawner, autenticada com `CRON_SECRET`.
- **Dependência nova**: `cron-parser` para validar festividades personalizadas com expressão cron (opcional — pode ser evitado se festividades custom forem só data única ou recorrência anual por data fixa).
- **Permissões**: tab e wizard respeitam `permissions.leads` (visualizar/editar contactos). Worker usa service role.
- **Zero impacto em fluxos visuais existentes** — o spawner é aditivo e os processadores são reutilizados sem alteração.
