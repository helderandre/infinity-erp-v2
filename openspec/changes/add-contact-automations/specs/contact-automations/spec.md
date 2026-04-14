## ADDED Requirements

### Requirement: Tab "Automatismos" na página de contacto

A página de detalhe do contacto em `/dashboard/leads/[id]` SHALL expor uma tab "Automatismos" que lista todos os automatismos do contacto e permite criar novos, editar agendamentos pendentes e cancelar.

#### Scenario: Visualizar automatismos existentes
- **WHEN** o utilizador abre a tab "Automatismos" num contacto com automatismos configurados
- **THEN** o sistema apresenta uma lista com: tipo de evento (ex: "Aniversário do contacto"), canal (email, WhatsApp ou ambos), template, próxima execução (data+hora em `Europe/Lisbon`), recorrência ("Uma vez" ou "Todos os anos") e estado (`scheduled`, `sent`, `cancelled`, `failed`, `skipped`)

#### Scenario: Estado vazio
- **WHEN** o contacto não tem automatismos
- **THEN** o sistema apresenta um empty state com CTA "Criar automatismo"

#### Scenario: Acesso a histórico por automatismo
- **WHEN** o utilizador clica num automatismo da lista
- **THEN** o sistema mostra o histórico de execuções desse automatismo (tabela `contact_automation_runs`) com `scheduled_for`, `sent_at`, `status` e razão de erro/skip se aplicável

### Requirement: Wizard de criação em 6 passos

O sistema SHALL expor um botão "Criar automatismo" que abre um wizard sequencial com 6 passos. O utilizador MUST poder voltar a passos anteriores e MUST ver um resumo no passo final antes de confirmar.

#### Scenario: Passo 1 — tipo de evento
- **WHEN** o utilizador inicia o wizard
- **THEN** o sistema apresenta as opções: "Aniversário do contacto", "Aniversário de fecho de negócio", "Natal (25 Dez)", "Ano Novo (1 Jan)", "Festividade personalizada"
- **AND** se o contacto não tem `date_of_birth`, a opção "Aniversário do contacto" fica desactivada com tooltip explicativo
- **AND** se o contacto não tem negócios com `expected_close_date`, "Aniversário de fecho de negócio" fica desactivada
- **AND** se o utilizador escolher "Aniversário de fecho de negócio" e houver múltiplos negócios, apresenta sub-selector do negócio
- **AND** se o utilizador escolher "Festividade personalizada", o sistema pede label (texto livre) e data (mês+dia)

#### Scenario: Passo 2 — canal
- **WHEN** o utilizador avança do passo 1
- **THEN** o sistema pede selecção entre "Email", "WhatsApp" ou "Email + WhatsApp"

#### Scenario: Passo 3 — remetente
- **WHEN** o canal escolhido inclui email e existe mais do que uma conta SMTP activa para o utilizador
- **THEN** o sistema pede selecção da conta
- **AND** se só houver uma SMTP activa, o sistema pré-selecciona e permite confirmar
- **WHEN** o canal inclui WhatsApp e existe mais do que uma instância UAZAPI com `connection_status='connected'`
- **THEN** o sistema pede selecção da instância
- **AND** se só houver uma instância conectada, pré-selecciona

#### Scenario: Passo 4 — escolher ou editar template
- **WHEN** o utilizador chega ao passo 4
- **THEN** o sistema apresenta, para cada canal escolhido, um dropdown de templates filtrado pela categoria do evento (ex: evento `aniversario_contacto` → templates com `category='aniversario_contacto'` + `category='geral'`)
- **AND** o utilizador PODE clicar "Editar apenas para este contacto" para abrir um editor inline que guarda em `contact_automations.template_overrides`
- **AND** o utilizador PODE clicar "Criar novo template" que abre o editor padrão (fora do wizard) com a categoria pré-preenchida

#### Scenario: Passo 5 — recorrência
- **WHEN** o utilizador avança do passo 4
- **THEN** o sistema pede escolha entre "Apenas uma vez (próxima ocorrência)" e "Todos os anos"
- **AND** para eventos Natal/Ano Novo/Festividade personalizada, "Todos os anos" é a opção recomendada destacada

#### Scenario: Passo 6 — hora de envio e confirmação
- **WHEN** o utilizador avança do passo 5
- **THEN** o sistema pré-preenche hora `08:00` e timezone `Europe/Lisbon`
- **AND** o utilizador PODE ajustar ambos
- **AND** o sistema apresenta resumo com todos os passos e a próxima data+hora calculada
- **WHEN** o utilizador confirma
- **THEN** o sistema cria o registo em `contact_automations` com `status='scheduled'` e `trigger_at` calculado
- **AND** o sistema apresenta toast de sucesso e regressa à lista

### Requirement: Edição de automatismos agendados

O sistema SHALL permitir editar `template_overrides`, `email_template_id`, `wpp_template_id`, hora de envio, timezone e recorrência enquanto `contact_automations.status='scheduled'`.

#### Scenario: Editar template pendente
- **WHEN** o utilizador abre um automatismo com estado `scheduled` e edita o template
- **THEN** o sistema guarda as alterações e o próximo envio usa a versão actualizada

#### Scenario: Tentativa de edição após envio
- **WHEN** o automatismo tem estado `sent` ou `failed`
- **THEN** os campos de edição ficam desactivados e o sistema mostra "Este automatismo já foi executado"

### Requirement: Cancelamento individual e em lote

O sistema SHALL permitir cancelar um automatismo individual e também todos os automatismos pendentes de um contacto.

#### Scenario: Cancelar individualmente
- **WHEN** o utilizador clica "Cancelar" num automatismo com estado `scheduled`
- **THEN** o sistema pede confirmação via AlertDialog PT-PT
- **AND** ao confirmar, actualiza `status='cancelled'` e não cria novos runs

#### Scenario: Cancelar tudo
- **WHEN** o utilizador clica "Cancelar todos os agendamentos" no topo da tab
- **THEN** o sistema pede confirmação e, ao confirmar, actualiza `status='cancelled'` em todos os automatismos com `status='scheduled'` do contacto
- **AND** automatismos com estado `sent`, `completed` ou já `cancelled` não são afectados

### Requirement: Tabela `contact_automations`

O sistema SHALL persistir automatismos por-contacto numa tabela dedicada com os campos: `id` (uuid PK), `contact_id` (uuid FK → `leads_contacts.id` ON DELETE CASCADE), `deal_id` (uuid FK → `negocios.id` nullable ON DELETE SET NULL), `event_type` (text check: `aniversario_contacto | aniversario_fecho | natal | ano_novo | festividade`), `event_config` (jsonb — festividade: `{label, month, day}`), `channels` (text[] — `{email,whatsapp}`), `email_template_id` (uuid FK → `tpl_email_library.id` SET NULL), `wpp_template_id` (uuid FK → `auto_wpp_templates.id` SET NULL), `smtp_account_id` (uuid nullable), `wpp_instance_id` (uuid FK → `auto_wpp_instances.id` SET NULL), `template_overrides` (jsonb), `recurrence` (text check: `once | yearly`), `send_hour` (integer 0-23 default 8), `timezone` (text default `'Europe/Lisbon'`), `trigger_at` (timestamptz, próxima ocorrência calculada), `status` (text check: `scheduled | completed | cancelled | failed`), `created_by` (uuid FK → `dev_users.id`), `created_at`, `updated_at`.

#### Scenario: Criação valida canal com remetente
- **WHEN** o sistema tenta inserir com `channels` contendo `email` mas `smtp_account_id` null
- **THEN** a validação Zod na API recusa com 400

#### Scenario: FKs com delete seguro
- **WHEN** um template é eliminado
- **THEN** `email_template_id` ou `wpp_template_id` ficam NULL e o automatismo cai em fallback (overrides) ou falha graciosamente

### Requirement: Tabela `contact_automation_runs`

O sistema SHALL registar cada execução (sucesso, falha ou skip) em `contact_automation_runs` com: `id`, `contact_automation_id` (FK), `auto_run_id` (FK → `auto_runs.id` nullable), `scheduled_for` (timestamptz), `sent_at` (timestamptz nullable), `status` (text: `pending | sent | failed | skipped`), `skip_reason` (text nullable), `error` (text nullable), `delivery_log_ids` (uuid[] — refs a `auto_delivery_log`), `created_at`. Chave única `(contact_automation_id, scheduled_for)`.

#### Scenario: Idempotência
- **WHEN** o spawner corre duas vezes no mesmo minuto para a mesma ocorrência
- **THEN** a segunda tentativa falha com conflito de chave única e não cria run duplicado

#### Scenario: Histórico por automatismo
- **WHEN** o utilizador abre o detalhe de um automatismo com 3 execuções anuais
- **THEN** `contact_automation_runs` contém 3 registos visíveis ordenados por `scheduled_for` desc

### Requirement: APIs de contact automations

O sistema SHALL expor endpoints REST sob `/api/contacts/[id]/automations`:

- `POST /api/contacts/[id]/automations` — cria automatismo (valida Zod, calcula `trigger_at`, devolve 201 com o registo)
- `GET /api/contacts/[id]/automations` — lista automatismos do contacto
- `GET /api/contacts/[id]/automations/[automationId]` — detalhe com runs
- `PATCH /api/contacts/[id]/automations/[automationId]` — edita enquanto `status='scheduled'`; recalcula `trigger_at` se muda `send_hour`, `timezone` ou `event_config`
- `DELETE /api/contacts/[id]/automations/[automationId]` — marca `status='cancelled'`
- `DELETE /api/contacts/[id]/automations` — bulk cancel (cancela todos os `scheduled` do contacto)
- `GET /api/contacts/[id]/automations/[automationId]/runs` — lista de execuções

#### Scenario: Autenticação e permissões
- **WHEN** utilizador sem permissão `leads` invoca qualquer endpoint
- **THEN** o sistema responde 403

#### Scenario: PATCH após envio
- **WHEN** `PATCH` é invocado com `status!='scheduled'`
- **THEN** o sistema responde 409 Conflict com mensagem "Automatismo já executado — não pode ser editado"

#### Scenario: Validação de template contra categoria
- **WHEN** `POST` recebe `email_template_id` cujo template tem `category` incompatível com `event_type`
- **THEN** o sistema aceita mas regista aviso (categoria `geral` é sempre permitida; qualquer outra categoria é permitida mas recomendação visual na UI)
