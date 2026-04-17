## Why

O módulo `add-contact-automations` já entregue exige que cada consultor crie manualmente (via wizard de 6 passos) cada automatismo para cada lead. Isto significa que 90% dos envios óbvios — felicitar um contacto no aniversário, um "Feliz Natal" a 25/12, um "Bom Ano Novo" a 31/12 — ficam por fazer, porque depende da memória do consultor lembrar-se de abrir o wizard para cada um dos seus leads. Queremos inverter o modelo: estes três eventos fixos passam a valer **por omissão** assim que um lead entra na tabela `leads`, e o consultor só intervém para cancelar, afinar ou personalizar. Em simultâneo, introduzimos uma **cascata de templates** (global → consultor → lead) para que cada consultor possa imprimir a sua voz sem perder o fallback seguro do template global, e um **hub central no menu CRM** que torna possível a gestão em massa (ver, mutar, reexecutar, trocar de SMTP/instância) em vez de obrigar a navegar lead a lead.

## What Changes

- **Automatismos fixos implícitos (opt-out)**: assim que um lead existe na tabela `leads`, os três eventos `aniversario_contacto`, `natal` (25/12) e `ano_novo` (31/12) passam a ser agendados virtualmente pelo spawner — **zero rows** inseridas em `contact_automations` até haver override ou mute.
- **Gating por canal**: se o consultor responsável (`leads.agent_id`) não tiver nenhuma `consultant_email_accounts` activa, o canal email é silenciosamente saltado; idem para `auto_wpp_instances`. Se nenhum canal estiver disponível, o evento não dispara e fica registado em `auto_scheduler_log`.
- **Cascata de templates em 3 camadas**: resolver procura por esta ordem (first wins) — atribuição lead-specific → template consultor-scoped → template global. **BREAKING (suave)**: `tpl_email_library` e `auto_wpp_templates` ganham `scope enum('global','consultant')` + `scope_id uuid NULL`. Rows existentes recebem `scope='global'` via backfill. Listagens passam a filtrar por scope visível ao utilizador.
- **Templates consultor-scoped auto-fallback**: quando um template consultor é desactivado ou eliminado, a resolução cai automaticamente para o global — sem acção adicional do consultor.
- **Overrides por-lead reutilizáveis**: nova tabela `contact_automation_lead_settings` guarda a atribuição de template, hora de envio, conta SMTP ou instância WhatsApp específica daquele lead. O template atribuído é sempre consultor-scoped (reutilizável noutros leads).
- **Mutes combinatórios**: nova tabela `contact_automation_mutes` com colunas nullable `consultant_id`, `lead_id`, `event_type`, `channel` (NULL = "todos"). Cobre "silenciar tudo do consultor", "silenciar todos os Natais do consultor", "silenciar este lead todo", "silenciar só o WhatsApp do aniversário deste lead", etc.
- **Selecção automática de conta**: quando o consultor tem múltiplas contas SMTP ou instâncias WhatsApp activas, ganha a de `created_at` mais antigo. O consultor pode fixar outra como default a partir do hub ou fazer override por-lead.
- **Retry de runs falhados**: dois endpoints novos — `POST /api/automacao/runs/[id]/retry` (novo run com `trigger_at=now()`) e `POST /api/automacao/runs/[id]/reschedule` (datepicker). Ambos suportam modo em lote via array de ids.
- **Novo hub CRM** em `/dashboard/crm/automatismos-contactos` com 4 tabs: Agendados, Runs falhados, Os meus templates (consultor), Mutes globais. Substitui o wizard como superfície principal de gestão.
- **Tab "Automatismos" no lead** preserva-se para edições finas (override de template, hora, conta; mutes parciais daquele lead) e continua a ser o único sítio que corre o wizard existente para `aniversario_fecho` + `festividade` (manuais). Os três eventos fixos deixam de aparecer como "criáveis" no wizard.
- **Spawner actualizado**: passa a ter duas pistas — (1) manuais em `contact_automations` como hoje; (2) fixas virtuais calculadas por `leads × {3 eventos} MINUS contact_automation_mutes JOIN contact_automation_lead_settings`, reagendadas via aritmética de data (não via update de rows).
- **Seed obrigatório**: 3 templates email + 3 templates WhatsApp globais (um por evento fixo), activos de fábrica — sem eles, as fixas não disparam.

## Capabilities

### New Capabilities

- `fixed-contact-automations`: motor de automatismos fixos implícitos (aniversário, Natal, Ano Novo) resolvidos virtualmente pelo spawner a partir de `leads × eventos fixos`, sem rows persistidas por omissão. Inclui gating por canal activo do consultor e selecção automática da conta mais antiga.
- `contact-automation-template-cascade`: cascata de resolução de templates em 3 camadas (lead-assignment → consultor-scoped → global) com fallback automático e CRUD de templates consultor-scoped.
- `contact-automation-mutes`: modelo combinatório de mutes com granularidade (consultor, lead, evento, canal) — todas as colunas nullable, NULL significa "todos".
- `contact-automation-lead-overrides`: overrides por-lead de template atribuído, hora de envio, conta SMTP e instância WhatsApp, reutilizáveis e sempre opcionais.
- `contact-automation-run-retry`: reexecução imediata e reagendamento de runs falhados, individual ou em lote.
- `contact-automation-hub`: página CRM central com 4 tabs para gestão, filtros e acções em massa sobre automatismos agendados, runs falhados, templates próprios e mutes globais do consultor.

### Modified Capabilities

<!-- `add-contact-automations` já foi arquivado e não tem spec activa em openspec/specs/ — logo não há modificações a delta. As novas capabilities acima assumem a continuidade do runtime existente (auto_runs, auto_step_runs, flow sentinela, processadores), mas sem alterar os seus requisitos. -->

## Impact

- **BD (migrations novas)**:
  - `ALTER TABLE tpl_email_library ADD COLUMN scope text NOT NULL DEFAULT 'global'`, `ADD COLUMN scope_id uuid NULL REFERENCES dev_users(id)`, backfill, CHECK `(scope='global' AND scope_id IS NULL) OR (scope='consultant' AND scope_id IS NOT NULL)`.
  - Idem `auto_wpp_templates`.
  - `CREATE TABLE contact_automation_lead_settings` com FK para `leads`, `dev_users` (consultant_id desnormalizado para queries rápidas), `tpl_email_library`, `auto_wpp_templates`, `consultant_email_accounts`, `auto_wpp_instances`.
  - `CREATE TABLE contact_automation_mutes` com 4 colunas nullable (consultant_id, lead_id, event_type, channel) + índices parciais.
  - Seed: 6 templates globais (3 email + 3 whatsapp) para os 3 eventos fixos.
- **APIs novas**:
  - `GET/POST /api/crm/contact-automations` (listagem hub com filtros e agregação de próximo envio virtual)
  - `GET/POST/PATCH/DELETE /api/leads/[id]/automation-settings` (overrides por-lead)
  - `GET/POST/DELETE /api/contact-automation-mutes` (mutes combinatórios)
  - `GET/POST/PATCH/DELETE /api/templates/email` e `/api/templates/whatsapp` com filtro por scope (ou actualização das existentes para suportar `?scope=` e criação consultor-scoped)
  - `POST /api/automacao/runs/[id]/retry`
  - `POST /api/automacao/runs/[id]/reschedule`
  - `POST /api/automacao/runs/retry-batch` / `POST /api/automacao/runs/reschedule-batch`
- **APIs modificadas**:
  - `POST /api/automacao/scheduler/spawn-runs` (route existente) ganha a pista virtual de fixas — resolve `leads × eventos fixos MINUS mutes JOIN lead_settings` em cada tick e aplica gating por canal activo.
  - Listagens de templates passam a devolver `scope` e `scope_id`.
- **UI nova**:
  - Página `/dashboard/crm/automatismos-contactos/page.tsx` + 4 componentes de tab + hooks de fetch.
  - Tab "Automatismos" no lead simplificada (`components/crm/contact-automations-list.tsx` e adjacentes).
  - Editor de template consultor-scoped (reutiliza `email-editor` e editor de WhatsApp existentes; só muda o submit para incluir `scope='consultant'`).
- **Lógica partilhada nova** em `lib/automacao/`:
  - `resolve-template-for-lead.ts` (cascata 3 camadas)
  - `resolve-account-for-lead.ts` (override → primeiro-criado → null)
  - `resolve-fixed-automations.ts` (query SQL com LEFT JOINs para a pista virtual do spawner)
- **Permissões**: hub CRM requer `permissions.leads`; um broker/admin vê todos os consultores, um consultor só vê os seus (filtro por `leads.agent_id`). Mutes globais só afectam o próprio consultor.
- **Dependências**: nenhuma nova. Reutiliza `auto_runs`, `auto_step_runs`, flow sentinela, processadores email/whatsapp, `resolve-contact-variables`, Coolify Scheduled Task existente.
- **Migração de dados**: templates existentes recebem `scope='global'`. `contact_automations` existentes com `event_type ∈ {aniversario_contacto, natal, ano_novo}` mantêm-se e têm prioridade sobre a pista virtual (reconciliação: se houver row eager com aquele event_type+contact, o spawner respeita essa row e não duplica). Migration adiciona check anti-duplicação.
- **Zero impacto**: fluxos visuais de automações (editor Craft.js, flows manuais), envio de documentos, envio de negócio-properties, email editor actual.
