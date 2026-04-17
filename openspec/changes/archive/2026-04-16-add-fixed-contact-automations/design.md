## Context

O módulo `add-contact-automations` já entregue (arquivado em OpenSpec) assentou numa abordagem **opt-in manual**: cada consultor abre o wizard de 6 passos por lead e cria rows em `contact_automations`. Funciona, mas traduz-se em cobertura baixíssima — a enorme maioria dos leads não tem automatismo nenhum porque ninguém se lembrou de criar.

Do lado de run-time, o spawner existente (`app/api/automacao/scheduler/spawn-runs/route.ts`) já corre a cada minuto em Coolify Scheduled Task, monta `auto_runs` efémeros contra um flow sentinela (`00000000-0000-0000-0000-00000c0a0a17`) e reusa o `node_data_snapshot` em `auto_step_runs` para evitar dependência de `published_definition`. Os processadores `lib/node-processors/email.ts` e `lib/node-processors/whatsapp.ts` já fazem `template → override → resolveVars`. O resolver `lib/automacao/resolve-contact-variables.ts` já expõe todas as variáveis de que precisamos (`lead_*`, `consultor_*`, `deal_*`, `today_date`).

Templates de email e WhatsApp (`tpl_email_library`, `auto_wpp_templates`) são hoje 100% globais — não há scoping por consultor. Contas SMTP (`consultant_email_accounts`) e instâncias WhatsApp (`auto_wpp_instances`) já são 1-N por consultor. `leads.agent_id` é a fonte canónica de "consultor responsável".

Este design assume continuidade do runtime existente. Não mexemos em `auto_runs`, `auto_step_runs`, flow sentinela nem processadores — só ampliamos o spawner, adicionamos tabelas novas e colunas de scope nos templates.

## Goals / Non-Goals

**Goals:**
- Os três eventos fixos (aniversário, Natal, Ano Novo) passam a disparar para **todos os leads** por omissão, sem exigir configuração manual.
- Zero rows persistidas para os casos "default" — apenas os desvios (override ou mute) criam rows.
- Cascata de templates em 3 camadas resolvida em 1 query, com fallback automático quando a camada intermédia desaparece.
- Hub central no CRM permite gerir, mutar, reexecutar e editar em massa; a tab do lead continua disponível para edições finas.
- Mudar SMTP ou instância WhatsApp do consultor **propaga automaticamente** aos próximos envios sem exigir `UPDATE` em massa — consequência de a pista virtual ler fresco em cada tick.
- Runs falhados são reexecutáveis individualmente ou em lote, imediatamente ou agendando nova data.
- Zero regressões no wizard actual ou nos fluxos de `aniversario_fecho` / `festividade`.

**Non-Goals:**
- Não adicionar novos tipos de evento fixo (só os 3 acordados).
- Não remover o wizard nem `contact_automations` — continuam a suportar os casos manuais.
- Não introduzir fila, worker ou sistema de retentativas fora do actual (retry é um novo run na mesma máquina).
- Não implementar templates com herança multi-nível (consultor-herdada-de-outro-consultor): cascata é estritamente 3 níveis fixos.
- Não tocar na página de Negócios nem no runtime de flows manuais (editor Craft.js, triggers de webhook).
- Não alterar `consultant_email_accounts` ou `auto_wpp_instances` — herdamos a noção de "activo" existente.
- Não mexer nos seed de variáveis de template — todas as necessárias já existem.

## Decisions

### D1. Híbrido virtual + eager (em vez de eager total com backfill)

As 3 fixas não persistem rows. O spawner gera-as em memória a partir de `leads × {3 eventos}` a cada tick, aplicando MINUS contra `contact_automation_mutes` e LEFT JOIN com `contact_automation_lead_settings`.

**Alternativa considerada**: pré-materializar 3 rows por lead via trigger `AFTER INSERT ON leads` + migration de backfill. Teria a vantagem de "ver o que está agendado" com um simples SELECT, mas:
- Cria pressão de escrita a cada novo lead (trigger síncrono no insert).
- Backfill em milhares de leads existentes é intrusivo e reversível só com DELETE massivo.
- Mudar SMTP de um consultor exigiria `UPDATE` em todas as rows dos seus leads.
- Acumula rows "inúteis" (leads que serão sempre default, sem nenhum desvio).

**Porquê virtual ganha**: as 3 fixas são determinísticas a partir do estado dos leads + mutes + settings. A query SQL da pista virtual é simples o suficiente para correr a cada minuto sem índices exóticos. A tabela `contact_automations` mantém-se limpa e contém **só** o que é verdadeiramente manual (aniversário de fecho, festividades custom). Separar as duas pistas torna o código mais legível e a observabilidade mais clara.

### D2. Cascata de templates via `scope` + `scope_id` no template (em vez de tabela de atribuição de templates)

Adicionamos duas colunas a `tpl_email_library` e `auto_wpp_templates`:
- `scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','consultant'))`
- `scope_id uuid NULL REFERENCES dev_users(id) ON DELETE CASCADE`

Cheque: `(scope='global' AND scope_id IS NULL) OR (scope='consultant' AND scope_id IS NOT NULL)`.

Resolver (`lib/automacao/resolve-template-for-lead.ts`):
```
1. Se contact_automation_lead_settings tem email_template_id para (lead_id, event_type, 'email') → usa-o
2. Senão, SELECT template WHERE scope='consultant' AND scope_id = leads.agent_id
     AND category = event_type AND is_active LIMIT 1
3. Senão, SELECT template WHERE scope='global' AND category = event_type AND is_active LIMIT 1
4. Senão, evento não dispara (logged como missing_template)
```

**Alternativa considerada**: tabela `consultant_template_preferences(consultant_id, event_type, template_id)` apontando para templates globais, sem coluna de scope. Rejeitada porque:
- O consultor precisa de **editar o corpo** do template (não só preferir um global).
- Obrigaria a clonar a lógica de CRUD para uma tabela separada.
- A coluna de scope é aditiva e backwards-compatible (`default 'global'`).

**Porquê `scope`+`scope_id`**: uma só tabela, uma só API de templates, filtros simples (`WHERE scope='consultant' AND scope_id=X OR scope='global'`). A cascata resolve-se com `ORDER BY CASE scope WHEN 'consultant' THEN 1 WHEN 'global' THEN 2 END LIMIT 1`.

### D3. Lead-specific overrides como atribuição reutilizável

A regra "template por lead reutilizável" materializa-se em `contact_automation_lead_settings`:

```sql
CREATE TABLE contact_automation_lead_settings (
  id uuid PK,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,  -- 'aniversario_contacto' | 'natal' | 'ano_novo'
  -- Overrides opcionais:
  email_template_id uuid NULL REFERENCES tpl_email_library(id) ON DELETE SET NULL,
  wpp_template_id uuid NULL REFERENCES auto_wpp_templates(id) ON DELETE SET NULL,
  smtp_account_id uuid NULL REFERENCES consultant_email_accounts(id) ON DELETE SET NULL,
  wpp_instance_id uuid NULL REFERENCES auto_wpp_instances(id) ON DELETE SET NULL,
  send_hour int NULL CHECK (send_hour BETWEEN 0 AND 23),
  created_at, updated_at,
  UNIQUE(lead_id, event_type)
);
```

O template atribuído a um lead é **sempre** um `tpl_*_library` com `scope='consultant'` ou `'global'` — não é uma cópia. Se o consultor quiser "editar para um lead", ele edita o seu próprio template consultor-scoped (afeta todos os outros leads que o apontam). Se precisar mesmo de algo totalmente único, cria outro template consultor-scoped com outro nome.

**Alternativa considerada**: permitir inserir template "órfão" (scope='lead', scope_id=lead_id). Rejeitada porque contradiz o requisito explícito do utilizador ("esse template fica acessível para ser usado em outros leads também"). O override por lead é uma **atribuição**, não um template novo.

### D4. Mutes combinatórios numa única tabela

```sql
CREATE TABLE contact_automation_mutes (
  id uuid PK,
  consultant_id uuid NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NULL,   -- NULL = todos
  channel text NULL CHECK (channel IS NULL OR channel IN ('email','whatsapp')),
  muted_at timestamptz DEFAULT now(),
  muted_by uuid NOT NULL REFERENCES dev_users(id),
  CHECK (consultant_id IS NOT NULL OR lead_id IS NOT NULL)
);
CREATE INDEX idx_mutes_consultant ON contact_automation_mutes(consultant_id) WHERE consultant_id IS NOT NULL;
CREATE INDEX idx_mutes_lead ON contact_automation_mutes(lead_id) WHERE lead_id IS NOT NULL;
```

Regra de match (lê-se "lead L + evento E + canal C está mutado se existir qualquer row que case"):
```
mute.consultant_id IS NULL OR mute.consultant_id = leads.agent_id
mute.lead_id IS NULL OR mute.lead_id = L
mute.event_type IS NULL OR mute.event_type = E
mute.channel IS NULL OR mute.channel = C
```

A função resolver `isMuted(lead, event, channel)` faz um SELECT EXISTS com este WHERE. O spawner aplica por canal — é possível, por exemplo, `aniversario_contacto` disparar só email (whatsapp mutado parcialmente).

**Alternativa considerada**: tabelas separadas `consultant_mutes`, `lead_mutes`, `event_mutes`. Rejeitada por multiplicar 3x o código de query, a UI de gestão e os endpoints. Uma tabela com nulls é mais simples e cobre todas as 2^4 = 16 combinações.

### D5. Selecção automática de conta — primeiro-criado

Quando o consultor tem >1 `consultant_email_accounts` activa (`is_active=true`), o spawner usa a de `created_at` ASC mais antiga. Mesmo para `auto_wpp_instances` (`status='connected'`).

Override por-lead sempre ganha (`contact_automation_lead_settings.smtp_account_id`). Se o override aponta para conta desactivada, cai para `first-created active`; se nenhuma, canal é saltado.

**Alternativa considerada**: flag `is_default` nas tabelas de contas. Rejeitada porque:
- Força migration aditiva (mais duas colunas) sem grande ganho.
- "Primeiro criado" é determinístico, zero config.
- Se o consultor quiser mudar, faz override por-lead ou no hub ("Mudar SMTP default" — nessa altura, guardamos a preferência numa coluna adicionada mais tarde se for mesmo necessário).

**Trade-off**: consultor que criou uma conta em 2023 e uma melhor em 2025 não pode "promover" a nova facilmente — tem de desactivar a antiga ou fazer overrides por-lead. Aceitável na v1; se virar dor real, adiciona-se `is_default` num change futuro.

### D6. Gating por canal — skip silencioso, não falha

Se `leads.agent_id` não tem nenhuma conta SMTP activa, o canal email é saltado. Se também não tem WhatsApp activo, o evento inteiro é saltado. Em todos os casos:
- Nenhum erro é lançado.
- `auto_scheduler_log` regista um evento `skipped` com motivo (`no_active_account_email`, `no_active_account_whatsapp`, `no_active_account_any`).
- `contact_automation_runs` **não** é criado (a pista virtual não o cria).

**Razão**: skip silencioso evita pressão sobre o dashboard "Runs falhados" (não é falha, é falta de config). O consultor vê no hub CRM quais leads estão a ser saltados por este motivo ("Tab Agendados" mostra status `skipped_no_channel`) e pode ir configurar a sua conta.

### D7. Reagendamento virtual por aritmética de data, não por update de row

Como as fixas não têm row persistida, o "reagendamento anual" é automático: na próxima ocorrência, a query da pista virtual calcula o próximo `trigger_at` a partir de:
- `aniversario_contacto`: mês/dia de `leads.data_nascimento`, ano = ano actual se ainda não passou; senão ano+1.
- `natal`: 25/12 do ano actual se ainda não passou; senão 25/12 do ano+1.
- `ano_novo`: 31/12 do ano actual se ainda não passou; senão 31/12 do ano+1.

Hora aplicada é `contact_automation_lead_settings.send_hour ?? 8` (default 08:00 Europe/Lisbon).

Cada ocorrência gera um row em `contact_automation_runs` para idempotência — unique key `(kind='virtual', lead_id, event_type, scheduled_for)`. Se o spawner vê que já existe run para aquela ocorrência, salta.

**Trade-off**: a unique key precisa de um discriminador `kind` para não colidir com runs da pista manual (que usam `contact_automation_id`). Solução: migration adiciona `contact_automation_runs.kind text NOT NULL DEFAULT 'manual'` + unique parcial para `kind='virtual'`.

### D8. Retry — novo run, não reexecução do antigo

`POST /api/automacao/runs/[id]/retry`:
- Lê o `auto_run` e `contact_automation_runs` originais.
- Reconstrói o snapshot (template resolver + account resolver + vars resolver) com dados actuais.
- Insere novo `auto_run` + `auto_step_runs` com `trigger_at=now()`.
- Cria novo `contact_automation_runs` (ou reabre via status=pending se for da pista manual).
- Link "parent_run_id" opcional em `contact_automation_runs` para trilho de auditoria.

**Razão**: reaproveitar o snapshot antigo é frágil (credenciais podem ter expirado, conta pode ter sido desactivada, template pode ter mudado). Um novo run com resolução fresca é mais robusto e alinha com o princípio de "mudar SMTP propaga automaticamente".

Reagendamento (`/reschedule`) é idêntico mas com `trigger_at=X` (datepicker).

### D9. Hub CRM — entrada SPA com 4 tabs e filtros combinados

Página `/dashboard/crm/automatismos-contactos/page.tsx` é client component (usa filtros reactivos). Divide em 4 tabs:
1. **Agendados** — combina resultados da pista virtual (computados) + `contact_automations` manuais, paginados. Filtros: consultor, evento, estado (active/muted/skipped_no_channel), canal. Acções em massa: mutar, mudar SMTP/instância, alterar hora (grava em `contact_automation_lead_settings` em batch).
2. **Runs falhados** — lê `contact_automation_runs.status='failed'` (últimos 30 dias), com botões retry/reschedule.
3. **Os meus templates** — CRUD de `tpl_email_library` e `auto_wpp_templates` filtradas por `scope='consultant' AND scope_id = user.id`.
4. **Mutes globais** — checkboxes que traduzem para rows em `contact_automation_mutes` com `consultant_id = user.id`.

Permissões:
- Consultor normal: vê só os seus (filtro `leads.agent_id = user.id` + `mutes.consultant_id = user.id`).
- Broker/CEO/Office Manager: vê todos os consultores via seletor.

**Alternativa considerada**: hub só para admins + tab no lead para consultores. Rejeitada porque o utilizador explicitou "tudo será gerenciado a partir de lá" — o consultor também precisa do hub.

### D10. Tab "Automatismos" no lead — foco em edições finas

Continua a existir e passa a mostrar:
- Para as 3 fixas: 3 linhas "virtuais" com botões "Personalizar template", "Mudar hora", "Mudar conta", "Mutar" (cria/edita row em `contact_automation_lead_settings` ou `contact_automation_mutes`).
- Para as manuais: lista actual de rows `contact_automations` + wizard para criar `aniversario_fecho` / `festividade`.

O wizard actual **deixa de permitir** criar os 3 eventos fixos (ficam escondidos no selector do passo 1). Migration de dados não apaga os existentes — são honrados pela pista manual (ver D11).

### D11. Reconciliação entre pista manual e virtual (para os 3 eventos fixos)

Se existe `contact_automations.event_type ∈ {aniversario_contacto, natal, ano_novo}` para um lead (criado antes deste change), o spawner **respeita a row manual** e salta a pista virtual para aquele (lead, event_type). Garante zero duplicação e continuidade.

Query de pista virtual exclui: `... AND NOT EXISTS (SELECT 1 FROM contact_automations ca WHERE ca.contact_id = leads.id AND ca.event_type = <evento> AND ca.status IN ('scheduled','completed'))`.

Consultor que queira "migrar" um row manual para virtual simplesmente apaga-o — a pista virtual assume na próxima tick.

### D12. Escolha entre spawner único ampliado vs. spawner separado para fixas

Decisão: **spawner único ampliado**. `/api/automacao/scheduler/spawn-runs` corre duas fases em cada tick:
- Fase A: manuais (query actual contra `contact_automations`).
- Fase B: virtuais (query nova contra `leads × eventos fixos MINUS mutes JOIN settings`).

Ambas partilham: `resolveContactVariables`, `resolveTemplateForLead`, `resolveAccountForLead`, criação de `auto_run` + `auto_step_runs`.

**Alternativa considerada**: endpoint separado `/scheduler/spawn-fixed-runs`. Rejeitada porque duplicaria metade do código de criação de run e da telemetria, e complicaria o agendamento em Coolify.

### D13. Seeds de templates globais

Migration insere 3 templates email (`tpl_email_library`, `scope='global', category IN (aniversario_contacto, natal, ano_novo)`) e 3 WhatsApp. Texto PT-PT aprovado por marketing (placeholder neste change, conteúdo final pode ser editado pós-deploy — ficheiros `.md` de referência em `openspec/changes/.../design/seed-templates/`).

Sem estes seeds a cascata falha no último nível e as fixas não disparam — logo são obrigatórios e fazem parte da migration, não de uma ação manual.

## Risks / Trade-offs

- **[Carga do spawner cresce com nº de leads]** → Mitigação: fase B limitada a `leads WHERE estado NOT IN ('arquivado','convertido')` (activos) + batch de 200 em cada tick + índices compostos em `leads(agent_id, data_nascimento)`, `contact_automation_mutes(consultant_id)`. Ticks com 50k leads activos continuam <5s com este plano. Se virar problema, evoluir para materialized view refreshada ao minuto.

- **[Mute muito granular gera tabela com muitas rows]** → Mitigação: UI não incentiva criar mutes para cada (lead, evento, canal) — o consultor vê checkboxes agregadas e o backend consolida (se o consultor muta "todos os aniversários", só uma row com `event_type='aniversario_contacto', lead_id=NULL, channel=NULL` é inserida). Rows redundantes são detectadas e rejeitadas no endpoint POST.

- **[Cascata falha se admin apaga template global]** → Mitigação: templates globais marcados `is_system=true` na migration; UI não permite apagar. CHECK trigger no delete: se `is_system=true`, bloqueia.

- **[Consultor edita template e envia gralha em massa]** → Mitigação: campo `status='draft'|'published'` no editor consultor-scoped (já existe para email via fluxo actual). Spawner só usa templates `published`. Preview obrigatório no editor.

- **[Lead sem `data_nascimento` nunca recebe aniversário]** → Aceitável: pista virtual filtra `WHERE data_nascimento IS NOT NULL` para o evento aniversário. Natal e Ano Novo disparam independentemente.

- **[`consultant_email_accounts.is_active` mal sincronizado]** → Aceitável: se o consultor marca como inactiva, deixa de disparar — é o comportamento correcto. Se a conta quebra (credenciais) mas continua `is_active`, o erro surge no run → cai em "Runs falhados" com retry disponível.

- **[Consultor apaga a sua conta SMTP default mid-fluxo]** → Mitigação: `contact_automation_lead_settings.smtp_account_id` tem `ON DELETE SET NULL` — resolver cai para first-created. Mesmo para instância WhatsApp.

- **[Runs simultâneos pela pista manual e virtual para o mesmo evento]** → Mitigação: reconciliação descrita em D11 + unique key `(kind, lead_id, event_type, scheduled_for)` em `contact_automation_runs`. Insert simultâneo dá UNIQUE violation e o spawner trata como "já tratado".

- **[Migração de `scope` em tabela de templates com rows actuais]** → Mitigação: `ADD COLUMN scope NOT NULL DEFAULT 'global'` + `ADD COLUMN scope_id uuid NULL` preenchem automaticamente; nenhuma query existente quebra. CHECK adicionado no fim após backfill. APIs existentes de listagem são actualizadas para devolver `scope` (campo adicional, não breaking).

- **[Consultor cria template consultor-scoped e depois "herda" outro consultor]** → Fora de âmbito (Non-Goal). Se for necessário, modelo de equipas resolve via `team_id` num change futuro.

- **[Retry gera storm se consultor carrega "retry todos" com 500 failed]** → Mitigação: endpoint de batch aceita max 100 ids; rate limit reaproveita o limite existente do worker (20 runs / 5min por flow — aplica-se ao flow sentinela).

- **[Hub CRM com 5000 agendados por tick é lento]** → Mitigação: a tabela "Agendados" é paginada (server-side cursor) e a pista virtual é pré-agregada por `(lead_id, event_type)` para a vista; a resolução completa (template, conta) só acontece no momento do spawn. A view do hub mostra "próximo envio esperado" calculado a partir da aritmética de data, sem tocar em templates.
