# SPEC-M20 — Modulo de Recrutamento

**Ultima actualizacao:** 2026-03-16
**Estado:** Em desenvolvimento
**Modulo:** M20 — Recrutamento CRM

---

## Visao Geral

Modulo de CRM de recrutamento para gestao completa do pipeline de captacao de novos consultores imobiliarios para a Infinity Group. Inclui pipeline Kanban com 7 fases, ficha detalhada do candidato com 9 tabs, extraccao automatica de dados de documento de identificacao via IA (GPT-4o), formulario publico de entrada, sistema de scoring (0-100), rastreamento de comunicacoes, gestao de periodo de experiencia, alertas automaticos e relatorios de desempenho.

O modulo utiliza **Server Actions** (em vez de API Route Handlers) como padrao de backend, centralizadas no ficheiro `app/dashboard/recrutamento/actions.ts`.

---

## Sub-Paginas

### 1. Dashboard — `/dashboard/recrutamento`

Pagina principal do modulo de recrutamento com visao geral do estado do pipeline.

**KPIs (cards superiores):**
- Total de candidatos activos
- Novos candidatos este mes
- Taxa de conversao (aderiu / total processado)
- Tempo medio no pipeline (dias entre criacao e decisao)

**Graficos:**
- Candidatos por mes (barras — ultimos 12 meses)
- Eficacia por fonte (barras horizontais — LinkedIn, Referencia, Campanha, etc.)
- Funil de conversao (Prospecto → Em Contacto → Em Processo → Decisao → Aderiu)
- Distribuicao por estado (donut chart)

**Feed de actividade recente:**
- Ultimas 10 accoes (novos candidatos, mudancas de estado, entrevistas)
- Cada entrada com timestamp relativo ("ha 2 horas")

**Resumo de alertas:**
- Contagem de alertas por severidade (info, aviso, urgente)
- Link directo para a pagina de alertas

**Server actions utilizadas:** `getRecruitmentKPIs()`, `getCandidates()`, `getRecruitmentAlerts()`

---

### 2. Pipeline — `/dashboard/recrutamento/pipeline`

Quadro Kanban com 7 colunas representando as fases do pipeline de recrutamento.

**Colunas (por ordem):**

| Fase | Status DB | Cor |
|---|---|---|
| Prospecto | `prospect` | `bg-slate-100 text-slate-700` |
| Em Contacto | `in_contact` | `bg-blue-100 text-blue-700` |
| Em Processo | `in_process` | `bg-purple-100 text-purple-700` |
| Decisao Pendente | `decision_pending` | `bg-amber-100 text-amber-700` |
| Aderiu | `joined` | `bg-emerald-100 text-emerald-700` |
| Recusou | `declined` | `bg-red-100 text-red-700` |
| Em Espera | `on_hold` | `bg-orange-100 text-orange-700` |

**Card do candidato no Kanban:**
- Nome completo
- Badge da fonte (LinkedIn, Referencia, etc.)
- Avatar do recrutador atribuido
- Score badge (0-100) com cor condicional
- Indicador de tempo sem interaccao (amarelo >7d, vermelho >14d)
- Icones de contacto (telefone, email) se preenchidos

**Funcionalidade de drag-and-drop:**
- Arrastar candidato entre colunas altera o `status`
- Regista automaticamente no `recruitment_stage_log`
- Trigger de toast com confirmacao
- Animacao suave na transicao

**Filtros (toolbar superior):**
- Recrutador atribuido
- Fonte
- Pesquisa por nome

**Server actions utilizadas:** `getCandidates()`, `updateCandidate()`, `getRecruiters()`

---

### 3. Candidatos — `/dashboard/recrutamento/candidatos`

Vista em tabela com funcionalidades avancadas de pesquisa, filtragem e accoes em massa.

**Tabela (colunas):**
- Checkbox de seleccao (multi-select)
- Nome completo (link para detalhe)
- Telefone
- Email
- Fonte
- Estado (badge com cor)
- Recrutador (avatar + nome)
- Score (badge numerico)
- Ultima interaccao (data relativa)
- Data de criacao
- Accoes (editar, eliminar)

**Filtros:**
- Estado (select)
- Fonte (select)
- Recrutador (select)
- Pesquisa livre (nome, email, telefone)

**Accoes em massa (toolbar que aparece com seleccao):**
- Alterar estado de multiplos candidatos → `bulkUpdateStatus()`
- Atribuir recrutador a multiplos candidatos → `bulkAssignRecruiter()`
- Exportar CSV com dados completos → `exportCandidatesCsv()`

**Paginacao:**
- Offset-based com 25 resultados por pagina
- Contagem total visivel

**Server actions utilizadas:** `getCandidates()`, `deleteCandidate()`, `bulkUpdateStatus()`, `bulkAssignRecruiter()`, `exportCandidatesCsv()`, `getRecruiters()`

---

### 4. Calendario — `/dashboard/recrutamento/calendario`

Mini calendario mensal com visualizacao de entrevistas, follow-ups e alertas de inactividade.

**Eventos exibidos:**
- Entrevistas agendadas (azul) — de `recruitment_interviews.interview_date`
- Follow-ups (amarelo) — de `recruitment_interviews.follow_up_date`
- Alertas de sem contacto (vermelho) — candidatos com `last_interaction_date` > 7 dias

**Interaccao:**
- Clicar num dia mostra lista de eventos desse dia
- Clicar num evento navega para o detalhe do candidato
- Navegacao mes a mes

**Server actions utilizadas:** `getCandidates()`, server action dedicada para buscar entrevistas com follow-up (a criar)

---

### 5. Alertas — `/dashboard/recrutamento/alertas`

Pagina centralizada de tarefas pendentes e alertas automaticos.

**Tipos de alerta:**

| Tipo | Condicao | Severidade |
|---|---|---|
| Sem Contacto | `last_interaction_date` > 7 dias | warning |
| Sem Contacto (urgente) | `last_interaction_date` > 14 dias | urgent |
| Follow-up Hoje | `recruitment_interviews.follow_up_date` = hoje | warning |
| Entrevista Amanha | `recruitment_interviews.interview_date` = amanha | info |
| Onboarding Incompleto | Status `joined` + onboarding incompleto ha > 15 dias | warning |
| Marco de Experiencia | `temp_recruitment_probation` milestone a 3 dias | info |

**UI:**
- Lista agrupada por severidade (urgente primeiro)
- Cada alerta com: icone, nome do candidato (link), mensagem, data
- Filtro por tipo de alerta
- Badge de contagem por severidade

**Server actions utilizadas:** `getRecruitmentAlerts()`

---

### 6. Relatorios — `/dashboard/recrutamento/relatorios`

Pagina de relatorios e analise de desempenho do recrutamento.

**Relatorios disponiveis:**

1. **Funil de Conversao** — Grafico de funil com candidatos por fase e taxa de conversao entre fases
2. **Eficacia por Fonte** — Barras horizontais com numero de candidatos e taxa de adesao por fonte
3. **Desempenho por Recrutador** — Tabela com: candidatos atribuidos, entrevistas realizadas, adesoes, taxa de sucesso
4. **Tempo Medio por Fase** — Barras com media de dias gastos em cada fase do pipeline
5. **Tendencias Mensais** — Grafico de linhas com novos candidatos, adesoes e recusas por mes

**Filtros globais:**
- Periodo (data inicio / data fim)
- Recrutador

**Exportacao:**
- Botao para exportar dados em CSV

**Server actions utilizadas:** `getRecruitmentReportData()`

---

### 7. Templates — `/dashboard/recrutamento/templates`

Gestao de templates de comunicacao pre-configurados por fase do pipeline.

**Campos do template:**
- Nome (texto)
- Fase do pipeline (select — `CandidateStatus`)
- Canal (select — Email, WhatsApp, SMS)
- Assunto (apenas para email)
- Corpo da mensagem (textarea com suporte a variaveis)
- Variaveis utilizadas (tags visuais)
- Activo/Inactivo (toggle)

**Variaveis disponiveis:**
- `{{nome}}` — Nome completo do candidato
- `{{recrutador}}` — Nome do recrutador atribuido
- `{{empresa}}` — "Infinity Group"
- `{{data}}` — Data actual formatada
- `{{fase}}` — Nome da fase actual do pipeline
- `{{telefone}}` — Telefone do candidato
- `{{email}}` — Email do candidato

**UI:**
- Listagem em tabela com filtros por fase e canal
- Dialog de criacao/edicao
- Preview do template com dados de exemplo
- Toggle de activacao inline

**Server actions utilizadas:** `getCommTemplates()`, `createCommTemplate()`, `updateCommTemplate()`, `deleteCommTemplate()`

---

### 8. Formulario — `/dashboard/recrutamento/formulario`

Gestao do formulario publico de entrada de candidatos e revisao de submissoes.

**Duas sub-tabs:**

#### 8a. Submissoes
- Listagem de submissoes do formulario publico (`recruitment_entry_submissions`)
- Filtro por estado: `submitted` | `reviewed` | `approved` | `rejected`
- Accoes: aprovar (cria candidato), rejeitar, ver detalhes
- Dados exibidos: nome, CC, NIF, data de nascimento, email, telefone, foto, docs ID
- Extraccao automatica via IA dos campos do documento de identificacao (frente + verso)

#### 8b. Editor de Campos
- Configuracao dos campos do formulario publico (`recruitment_form_fields`)
- Campos: field_key, label, section, field_type, placeholder, is_visible, is_required, is_ai_extractable
- Drag-to-reorder dos campos
- Toggle de visibilidade e obrigatoriedade

**Dados da submissao (`recruitment_entry_submissions`):**
- Dados pessoais: full_name, date_of_birth, naturalidade, estado_civil
- Documento: cc_number, cc_expiry, cc_issue_date, nif, niss
- Contacto: personal_email, professional_phone, emergency_contact_name, emergency_contact_phone
- Profissional: display_name, email_suggestion_1/2/3, has_sales_experience, has_real_estate_experience, previous_agency
- Redes sociais: instagram_handle, facebook_page
- Morada: full_address
- Ficheiros: id_document_front_url, id_document_back_url, professional_photo_url

**Extraccao IA de documento de identificacao:**
- Upload de frente e verso do CC/BI
- GPT-4o analisa as imagens e extrai: nome, numero CC, data de nascimento, validade, NIF, NISS, naturalidade, estado civil
- Campos pre-preenchidos no formulario (is_ai_extractable = true)

**Server actions utilizadas:** `getFormFields()`, `updateFormField()`, `reorderFormFields()`, `getEntrySubmissions()`, `updateEntrySubmission()`

---

## Detalhe do Candidato — `/dashboard/recrutamento/[id]`

Pagina de detalhe com 9 tabs, cada uma dedicada a um aspecto do candidato.

### Cabecalho (fixo em todas as tabs)
- Nome completo (editavel inline)
- Badge de estado com cor
- Score badge (0-100) com breakdown em tooltip
- Recrutador atribuido (avatar + nome, editavel)
- Data de criacao
- Ultima interaccao (data relativa com alerta visual se > 7 dias)
- Botoes de accao rapida: alterar estado, eliminar

---

### Tab 1 — Dados Pessoais

Informacoes basicas do candidato.

**Campos:**
- Nome completo (`full_name`) — obrigatorio
- Telefone (`phone`)
- Email (`email`)
- Fonte (`source`) — select: LinkedIn, Redes Sociais, Referencia, Inbound, Campanha Paga, Evento, Outro
- Detalhe da fonte (`source_detail`) — texto livre
- Estado (`status`) — select com as 7 fases
- Recrutador (`assigned_recruiter_id`) — select de recrutadores
- Data do primeiro contacto (`first_contact_date`)
- Data da ultima interaccao (`last_interaction_date`) — automatico
- Notas (`notes`) — textarea

**Tabela:** `recruitment_candidates`
**Server actions:** `getCandidate()`, `updateCandidate()`

---

### Tab 2 — Perfil de Origem

Informacoes sobre a experiencia anterior do candidato no imobiliario.

**Campos:**
- Activo no imobiliario actualmente (`currently_active_real_estate`) — toggle
- Marca de origem (`origin_brand`) — select: RE/MAX, Century 21, ERA, Keller Williams, Realty One, Independente, Outra
- Marca personalizada (`origin_brand_custom`) — se "Outra" seleccionada
- Tempo na marca anterior (`time_at_origin_months`) — meses
- Motivo de saida (`reason_for_leaving`) — textarea
- Facturacao media mensal (`billing_avg_month`) — EUR
- Facturacao media anual (`billing_avg_year`) — EUR

**Tabela:** `recruitment_origin_profiles` (1:1 com candidato)
**Server actions:** `getOriginProfile()`, `upsertOriginProfile()`

---

### Tab 3 — Pain & Pitch

Registo das dores identificadas, solucoes apresentadas e objecoes do candidato. Permite multiplos registos (1:N) para rastrear evolucao ao longo das interaccoes.

**Campos (por registo):**
- Dores identificadas (`identified_pains`) — textarea
- Solucoes apresentadas (`solutions_presented`) — textarea
- Objecoes do candidato (`candidate_objections`) — textarea
- Fit Score (`fit_score`) — 1 a 5 (estrelas ou slider)
- Data de criacao (automatico)

**UI:**
- Lista de registos ordenados por data (mais recente primeiro)
- Botao "Adicionar registo"
- Cada registo com opcao de editar/eliminar
- Media do fit_score visivel no cabecalho da tab

**Tabela:** `recruitment_pain_pitch` (1:N com candidato)
**Server actions:** `getPainPitchRecords()`, `upsertPainPitch()`, `deletePainPitch()`

---

### Tab 4 — Entrevistas

Registo de todas as entrevistas realizadas com o candidato.

**Campos (por entrevista):**
- Numero da entrevista (`interview_number`) — auto-incremento
- Data e hora (`interview_date`) — datetime picker
- Formato (`format`) — select: Presencial, Videochamada, Telefone
- Conduzida por (`conducted_by`) — select de recrutadores
- Notas (`notes`) — textarea (rich text)
- Proximo passo (`next_step`) — texto
- Data de follow-up (`follow_up_date`) — date picker

**UI:**
- Timeline vertical com entrevistas ordenadas por numero
- Cada entrevista como card expandivel
- Badge de formato (Presencial, Videochamada, Telefone)
- Indicador visual de follow-up pendente/atrasado
- Botao "Agendar nova entrevista"

**Tabela:** `recruitment_interviews` (1:N com candidato)
**Server actions:** `getInterviews()`, `createInterview()`, `updateInterview()`, `deleteInterview()`

---

### Tab 5 — Comunicacoes

Timeline completa de todas as interaccoes com o candidato — chamadas, emails, WhatsApp, SMS, reunioes e notas internas.

**Campos (por comunicacao):**
- Tipo (`type`) — select: Chamada, Email, WhatsApp, SMS, Reuniao, Nota
- Assunto (`subject`) — texto (opcional)
- Conteudo (`content`) — textarea
- Direccao (`direction`) — Recebida (inbound) / Enviada (outbound)
- Registado por (`logged_by`) — automatico (utilizador actual)
- Data de criacao — automatico

**UI:**
- Timeline vertical cronologica (mais recente primeiro)
- Cada entrada com icone do tipo, direccao (seta entrada/saida), utilizador e timestamp
- Filtro por tipo de comunicacao
- Botao "Registar comunicacao" com dialog
- Opcao de usar template de comunicacao (pre-preenche assunto e conteudo)

**Icones por tipo:**

| Tipo | Icone Lucide |
|---|---|
| Chamada | `Phone` |
| Email | `Mail` |
| WhatsApp | `MessageCircle` |
| SMS | `MessageSquare` |
| Reuniao | `Users` |
| Nota | `StickyNote` |

**Tabela:** `temp_recruitment_communications` (1:N com candidato)
**Server actions:** `getCommunications()`, `createCommunication()`

---

### Tab 6 — Evolucao Financeira

Acompanhamento da facturacao do candidato apos entrada na Infinity Group.

**Campos:**
- Facturacao mes 1 (`billing_month_1`) — EUR
- Facturacao mes 2 (`billing_month_2`) — EUR
- Facturacao mes 3 (`billing_month_3`) — EUR
- Facturacao mes 6 (`billing_month_6`) — EUR
- Facturacao mes 12 (`billing_month_12`) — EUR
- Meses para igualar anterior (`months_to_match_previous`) — numero
- Notas (`notes`) — textarea

**UI:**
- Formulario com inputs numericos
- Grafico de barras com evolucao mensal
- Comparacao visual com `billing_avg_month` do perfil de origem (se disponivel)
- Indicador de progresso ate igualar facturacao anterior

**Tabela:** `recruitment_financial_evolution` (1:1 com candidato)
**Server actions:** `getFinancialEvolution()`, `upsertFinancialEvolution()`

---

### Tab 7 — Periodo de Experiencia

Gestao dos marcos de 30/60/90 dias apos entrada do consultor.

**Campos:**
- Data de inicio (`start_date`) — date
- Data de fim (`end_date`) — date (calculada: start + 90 dias)
- Marco 30 dias: concluido (`milestone_30_days`) + notas (`milestone_30_notes`)
- Marco 60 dias: concluido (`milestone_60_days`) + notas (`milestone_60_notes`)
- Marco 90 dias: concluido (`milestone_90_days`) + notas (`milestone_90_notes`)
- Objectivo facturacao mes 1/2/3 (`billing_target_month_1/2/3`) — EUR
- Facturacao real mes 1/2/3 (`billing_actual_month_1/2/3`) — EUR
- Estado (`status`) — Activo, Concluido, Nao Aprovado
- Notas gerais (`notes`) — textarea

**UI:**
- Stepper horizontal com 3 marcos (30, 60, 90 dias)
- Cada marco com checkbox, data, notas e indicador de progresso
- Tabela comparativa: objectivo vs real por mes
- Barra de progresso temporal (posicao actual no periodo de 90 dias)
- Badge de estado com cor

**Tabela:** `temp_recruitment_probation` (1:1 com candidato)
**Server actions:** `getProbation()`, `upsertProbation()`

---

### Tab 8 — Onboarding

Checklist de onboarding apos adesao do candidato.

**Campos:**
- Contrato enviado (`contract_sent`) — checkbox
- Contrato enviado por (`contract_sent_by`) — select de utilizadores
- Formulario de entrada enviado (`form_sent`) — checkbox
- Acessos criados (`access_created`) — checkbox
- Data de inicio do onboarding (`onboarding_start_date`) — date

**UI:**
- Checklist visual com 3 items
- Barra de progresso (0%, 33%, 66%, 100%)
- Alerta visual se incompleto ha > 15 dias apos adesao
- Nome do utilizador que enviou o contrato

**Tabela:** `recruitment_onboarding` (1:1 com candidato)
**Server actions:** `getOnboarding()`, `upsertOnboarding()`

---

### Tab 9 — Historico

Timeline de todas as mudancas de estado do candidato no pipeline.

**Campos (por entrada):**
- Estado anterior (`from_status`) — pode ser null (criacao)
- Estado novo (`to_status`)
- Alterado por (`changed_by`) — nome do utilizador
- Notas (`notes`)
- Data (`created_at`)

**UI:**
- Timeline vertical com badges coloridos de estado (anterior → novo)
- Avatar e nome do utilizador que fez a alteracao
- Timestamp relativo e absoluto
- Notas se existirem

**Tabela:** `recruitment_stage_log` (1:N com candidato)
**Server actions:** `getStageLog()`

---

## Tabelas de Base de Dados

### Tabelas Existentes

#### `recruitment_candidates`
Registo principal do candidato.

```
recruitment_candidates
├── id (UUID, PK, default gen_random_uuid())
├── full_name (text, NOT NULL)
├── phone (text, nullable)
├── email (text, nullable)
├── source (text, NOT NULL, default 'linkedin')
│   valores: linkedin | social_media | referral | inbound | paid_campaign | event | other
├── source_detail (text, nullable)
├── status (text, NOT NULL, default 'prospect')
│   valores: prospect | in_contact | in_process | decision_pending | joined | declined | on_hold
├── assigned_recruiter_id (UUID, nullable, FK → dev_users.id)
├── first_contact_date (date, nullable)
├── last_interaction_date (date, nullable)
├── decision_date (date, nullable)
├── decision (text, nullable)
│   valores: joined | declined | ghosted | on_hold
├── reason_yes (text, nullable)
├── reason_no (text, nullable)
├── notes (text, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado
**Registos existentes:** 1

---

#### `recruitment_origin_profiles`
Perfil de origem profissional do candidato (1:1).

```
recruitment_origin_profiles
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── currently_active_real_estate (boolean, default false)
├── origin_brand (text, nullable)
│   valores: remax | century21 | era | keller_williams | realty_one | independent | other
├── origin_brand_custom (text, nullable)
├── time_at_origin_months (integer, nullable)
├── reason_for_leaving (text, nullable)
├── billing_avg_month (numeric, nullable)
├── billing_avg_year (numeric, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_pain_pitch`
Registo de dores, solucoes e objecoes (1:N).

```
recruitment_pain_pitch
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── identified_pains (text, nullable)
├── solutions_presented (text, nullable)
├── candidate_objections (text, nullable)
├── fit_score (integer, nullable) — 1 a 5
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_interviews`
Entrevistas realizadas (1:N).

```
recruitment_interviews
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── interview_number (integer, NOT NULL, default 1)
├── interview_date (timestamptz, NOT NULL)
├── format (text, NOT NULL, default 'in_person')
│   valores: in_person | video_call | phone
├── conducted_by (UUID, nullable, FK → dev_users.id)
├── notes (text, nullable)
├── next_step (text, nullable)
├── follow_up_date (date, nullable)
└── created_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_financial_evolution`
Acompanhamento de facturacao (1:1).

```
recruitment_financial_evolution
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── billing_month_1 (numeric, nullable)
├── billing_month_2 (numeric, nullable)
├── billing_month_3 (numeric, nullable)
├── billing_month_6 (numeric, nullable)
├── billing_month_12 (numeric, nullable)
├── months_to_match_previous (integer, nullable)
├── notes (text, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_budget`
Custo de aquisicao do candidato (1:1).

```
recruitment_budget
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── paid_campaign_used (boolean, default false)
├── campaign_platform (text, nullable)
│   valores: linkedin_ads | meta_ads | google_ads | other
├── estimated_cost (numeric, nullable)
├── resources_used (text, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_onboarding`
Checklist de onboarding (1:1).

```
recruitment_onboarding
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── contract_sent (boolean, default false)
├── contract_sent_by (UUID, nullable, FK → dev_users.id)
├── form_sent (boolean, default false)
├── access_created (boolean, default false)
├── onboarding_start_date (date, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

#### `recruitment_stage_log`
Historico de mudancas de estado (1:N).

```
recruitment_stage_log
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, NOT NULL, FK → recruitment_candidates.id)
├── from_status (text, nullable) — null na criacao
├── to_status (text, NOT NULL)
├── changed_by (UUID, nullable, FK → dev_users.id)
├── notes (text, nullable)
└── created_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado
**Registos existentes:** 7

---

#### `recruitment_form_fields`
Configuracao dos campos do formulario publico de entrada.

```
recruitment_form_fields
├── id (UUID, PK, default gen_random_uuid())
├── field_key (text, NOT NULL)
├── label (text, NOT NULL)
├── section (text, NOT NULL)
├── field_type (text, NOT NULL, default 'text')
├── options (jsonb, nullable)
├── placeholder (text, nullable)
├── is_visible (boolean, NOT NULL, default true)
├── is_required (boolean, NOT NULL, default false)
├── is_ai_extractable (boolean, NOT NULL, default false)
├── order_index (integer, NOT NULL, default 0)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado
**Registos existentes:** 26

---

#### `recruitment_entry_submissions`
Submissoes do formulario publico.

```
recruitment_entry_submissions
├── id (UUID, PK, default gen_random_uuid())
├── candidate_id (UUID, nullable, FK → recruitment_candidates.id)
├── full_name (text, NOT NULL)
├── cc_number (text, nullable)
├── cc_expiry (date, nullable)
├── cc_issue_date (date, nullable)
├── date_of_birth (date, nullable)
├── nif (text, nullable)
├── niss (text, nullable)
├── naturalidade (text, nullable)
├── estado_civil (text, nullable)
├── display_name (text, nullable)
├── full_address (text, nullable)
├── professional_phone (text, nullable)
├── emergency_contact_name (text, nullable)
├── emergency_contact_phone (text, nullable)
├── personal_email (text, nullable)
├── email_suggestion_1 (text, nullable)
├── email_suggestion_2 (text, nullable)
├── email_suggestion_3 (text, nullable)
├── has_sales_experience (boolean, nullable)
├── has_real_estate_experience (boolean, nullable)
├── previous_agency (text, nullable)
├── instagram_handle (text, nullable)
├── facebook_page (text, nullable)
├── id_document_front_url (text, nullable)
├── id_document_back_url (text, nullable)
├── professional_photo_url (text, nullable)
├── status (text, NOT NULL, default 'submitted')
│   valores: submitted | reviewed | approved | rejected
├── submitted_at (timestamptz, NOT NULL, default now())
├── reviewed_at (timestamptz, nullable)
├── reviewed_by (UUID, nullable, FK → dev_users.id)
├── notes (text, nullable)
├── created_at (timestamptz, NOT NULL, default now())
└── updated_at (timestamptz, NOT NULL, default now())
```

**RLS:** Activado

---

### Tabelas Novas (prefixo `temp_`)

Tabelas a criar para completar o modulo. Usam o prefixo `temp_` conforme convencao do projecto para modulos em desenvolvimento.

#### `temp_recruitment_communications`
Registo de comunicacoes com o candidato (1:N).

```sql
CREATE TABLE temp_recruitment_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
    -- valores: call | email | whatsapp | sms | meeting | note
  subject TEXT,
  content TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound',
    -- valores: inbound | outbound
  logged_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_recruitment_comms_candidate ON temp_recruitment_communications(candidate_id);
CREATE INDEX idx_recruitment_comms_type ON temp_recruitment_communications(type);
CREATE INDEX idx_recruitment_comms_created ON temp_recruitment_communications(created_at DESC);

-- RLS
ALTER TABLE temp_recruitment_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recruitment communications"
  ON temp_recruitment_communications FOR ALL
  USING (auth.role() = 'authenticated');
```

---

#### `temp_recruitment_probation`
Acompanhamento do periodo de experiencia (1:1).

```sql
CREATE TABLE temp_recruitment_probation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  milestone_30_days BOOLEAN DEFAULT false,
  milestone_30_notes TEXT,
  milestone_60_days BOOLEAN DEFAULT false,
  milestone_60_notes TEXT,
  milestone_90_days BOOLEAN DEFAULT false,
  milestone_90_notes TEXT,
  billing_target_month_1 NUMERIC,
  billing_actual_month_1 NUMERIC,
  billing_target_month_2 NUMERIC,
  billing_actual_month_2 NUMERIC,
  billing_target_month_3 NUMERIC,
  billing_actual_month_3 NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
    -- valores: active | completed | failed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_recruitment_probation_candidate ON temp_recruitment_probation(candidate_id);
CREATE INDEX idx_recruitment_probation_status ON temp_recruitment_probation(status);

-- RLS
ALTER TABLE temp_recruitment_probation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recruitment probation"
  ON temp_recruitment_probation FOR ALL
  USING (auth.role() = 'authenticated');
```

---

#### `temp_recruitment_comm_templates`
Templates de comunicacao reutilizaveis por fase e canal.

```sql
CREATE TABLE temp_recruitment_comm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage TEXT NOT NULL,
    -- valores: prospect | in_contact | in_process | decision_pending | joined | declined | on_hold
  channel TEXT NOT NULL DEFAULT 'email',
    -- valores: email | whatsapp | sms
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_recruitment_comm_tpl_stage ON temp_recruitment_comm_templates(stage);
CREATE INDEX idx_recruitment_comm_tpl_channel ON temp_recruitment_comm_templates(channel);

-- RLS
ALTER TABLE temp_recruitment_comm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recruitment comm templates"
  ON temp_recruitment_comm_templates FOR ALL
  USING (auth.role() = 'authenticated');
```

---

## Sistema de Scoring (0-100)

O score de cada candidato e calculado automaticamente com base em criterios objectivos. E um valor computado (nao persistido na base de dados) pela server action `calculateCandidateScore()`.

### Tabela de Criterios

| Criterio | Pontos Max | Logica |
|---|---|---|
| Contacto preenchido | 10 | telefone preenchido (+5) + email preenchido (+5) |
| Perfil de origem preenchido | 15 | origin_brand (+5) + billing_avg_month (+5) + reason_for_leaving (+5) |
| Entrevistas realizadas | 30 | 15 pontos por entrevista (max 2 = 30) |
| Fit score em Pain & Pitch | 20 | Media dos fit_score >= 4 (+20), >= 3 (+10), >= 2 (+5) |
| Tempo de resposta | 15 | < 24h desde criacao ate first_contact_date (+15), < 48h (+10), < 72h (+5) |
| Recrutador atribuido | 10 | assigned_recruiter_id preenchido (+10) |
| **Total** | **100** | |

### Apresentacao Visual

- Badge circular com numero (0-100)
- Cor condicional:
  - 0-25: `bg-red-100 text-red-700` (Fraco)
  - 26-50: `bg-orange-100 text-orange-700` (Regular)
  - 51-75: `bg-amber-100 text-amber-700` (Bom)
  - 76-100: `bg-emerald-100 text-emerald-700` (Excelente)
- Tooltip com breakdown por criterio

### Interface TypeScript

```typescript
interface CandidateScoreBreakdown {
  contact_info: number      // 0-10
  origin_profile: number    // 0-15
  interviews: number        // 0-30
  fit_score: number         // 0-20
  response_time: number     // 0-15
  recruiter_assigned: number // 0-10
  total: number             // 0-100
}
```

---

## Alertas Automaticos

Os alertas sao calculados em tempo real pela server action `getRecruitmentAlerts()` com base no estado actual dos dados. Nao sao persistidos na base de dados.

### Regras de Alerta

| Tipo | Condicao | Severidade | Mensagem |
|---|---|---|---|
| `no_contact` | `last_interaction_date` NULL ou > 7 dias, status activo | `warning` | "Sem contacto ha X dias" |
| `no_contact` | `last_interaction_date` NULL ou > 14 dias, status activo | `urgent` | "Sem contacto ha X dias — urgente" |
| `follow_up_today` | `recruitment_interviews.follow_up_date` = hoje | `warning` | "Follow-up agendado para hoje" |
| `interview_tomorrow` | `recruitment_interviews.interview_date` = amanha | `info` | "Entrevista agendada para amanha" |
| `onboarding_incomplete` | Status `joined` + onboarding incompleto (contract_sent OR form_sent OR access_created = false) ha > 15 dias | `warning` | "Onboarding incompleto ha X dias" |
| `probation_milestone` | Marco (30/60/90 dias) a aproximar-se dentro de 3 dias e nao concluido | `info` | "Marco de X dias em 3 dias" |

### Status "activos" para alertas de sem contacto

Apenas candidatos com status `prospect`, `in_contact`, `in_process` ou `decision_pending` geram alertas de sem contacto.

---

## Accoes em Massa

Disponiveis na pagina de Candidatos (`/dashboard/recrutamento/candidatos`) quando um ou mais candidatos estao seleccionados.

### Alterar Estado

```typescript
bulkUpdateStatus(candidateIds: string[], newStatus: CandidateStatus): Promise<{...}>
```
- Aplica o novo estado a todos os candidatos seleccionados
- Regista mudanca no `recruitment_stage_log` para cada candidato
- Mostra toast com contagem de actualizacoes

### Atribuir Recrutador

```typescript
bulkAssignRecruiter(candidateIds: string[], recruiterId: string): Promise<{...}>
```
- Atribui o recrutador a todos os candidatos seleccionados
- Mostra toast com confirmacao

### Exportar CSV

```typescript
exportCandidatesCsv(filters?: {...}): Promise<{ csv: string; error: string | null }>
```
- Gera CSV com todos os campos do candidato + perfil de origem + estado
- Cabecalhos em PT-PT
- Download automatico no browser

---

## Templates de Comunicacao

### Variaveis Disponiveis

| Variavel | Descricao | Exemplo |
|---|---|---|
| `{{nome}}` | Nome completo do candidato | "Joao Silva" |
| `{{recrutador}}` | Nome do recrutador atribuido | "Ana Costa" |
| `{{empresa}}` | Nome da empresa | "Infinity Group" |
| `{{data}}` | Data actual formatada | "16 de Marco de 2026" |
| `{{fase}}` | Nome da fase actual | "Em Processo" |
| `{{telefone}}` | Telefone do candidato | "+351 912 345 678" |
| `{{email}}` | Email do candidato | "joao@email.com" |

### Canais

| Canal | Campos | Limite |
|---|---|---|
| Email | Assunto + Corpo | Sem limite |
| WhatsApp | Corpo apenas | 4096 caracteres |
| SMS | Corpo apenas | 160 caracteres |

### Interface TypeScript

```typescript
interface RecruitmentCommTemplate {
  id: string
  name: string
  stage: CandidateStatus
  channel: 'email' | 'whatsapp' | 'sms'
  subject: string | null
  body: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
```

---

## Deteccao de Duplicados

Funcionalidade para identificar e fundir candidatos duplicados.

### Criterios de Match

- Telefone identico (normalizando espacos e prefixo +351)
- Email identico (case-insensitive)

### Server Action

```typescript
findDuplicates(candidateId: string): Promise<{
  duplicates: Array<{
    id: string
    full_name: string
    phone: string | null
    email: string | null
    status: CandidateStatus
    match_reason: 'phone' | 'email'
  }>
  error: string | null
}>
```

### Merge (Fusao)

```typescript
mergeCandidates(keepId: string, deleteId: string): Promise<{
  success: boolean
  error: string | null
}>
```

**Logica de fusao:**
1. Move todos os registos filhos do candidato eliminado para o candidato mantido:
   - `recruitment_pain_pitch`
   - `recruitment_interviews`
   - `recruitment_stage_log`
   - `temp_recruitment_communications`
2. Mantem o registo 1:1 do candidato mantido (origin_profile, financial_evolution, budget, onboarding, probation)
3. Elimina o candidato duplicado (CASCADE elimina registos 1:1 orfaos)
4. Regista a fusao no `recruitment_stage_log` com nota explicativa

---

## Ficheiros Chave

### Server Actions

```
app/dashboard/recrutamento/actions.ts
```

Contem 43 server actions:

**Candidatos:**
- `getCandidates(filters?)` — listagem com filtros
- `getCandidate(id)` — detalhe
- `createCandidate(data)` — criar com log de estado
- `updateCandidate(id, updates)` — actualizar com log de estado automatico
- `deleteCandidate(id)` — eliminar

**Perfil de Origem:**
- `getOriginProfile(candidateId)` — obter perfil
- `upsertOriginProfile(candidateId, data)` — criar/actualizar

**Pain & Pitch:**
- `getPainPitchRecords(candidateId)` — listar registos
- `upsertPainPitch(data)` — criar/actualizar registo
- `deletePainPitch(id)` — eliminar

**Entrevistas:**
- `getInterviews(candidateId)` — listar
- `createInterview(data)` — criar
- `updateInterview(id, updates)` — actualizar
- `deleteInterview(id)` — eliminar

**Evolucao Financeira:**
- `getFinancialEvolution(candidateId)` — obter
- `upsertFinancialEvolution(candidateId, data)` — criar/actualizar

**Budget:**
- `getBudget(candidateId)` — obter
- `upsertBudget(candidateId, data)` — criar/actualizar

**Onboarding:**
- `getOnboarding(candidateId)` — obter
- `upsertOnboarding(candidateId, data)` — criar/actualizar

**Historico:**
- `getStageLog(candidateId)` — listar mudancas de estado

**Comunicacoes:**
- `getCommunications(candidateId)` — listar
- `createCommunication(data)` — registar comunicacao

**Periodo de Experiencia:**
- `getProbation(candidateId)` — obter
- `upsertProbation(candidateId, data)` — criar/actualizar

**Templates de Comunicacao:**
- `getCommTemplates(stage?)` — listar (filtro por fase)
- `createCommTemplate(data)` — criar
- `updateCommTemplate(id, updates)` — actualizar
- `deleteCommTemplate(id)` — eliminar

**Formulario:**
- `getFormFields()` — campos do formulario
- `updateFormField(id, updates)` — actualizar campo
- `reorderFormFields(fields)` — reordenar
- `getEntrySubmissions(status?)` — submissoes
- `updateEntrySubmission(id, updates)` — actualizar submissao

**Utilitarios:**
- `getRecruiters()` — lista de recrutadores (dev_users)
- `getRecruitmentKPIs()` — metricas do dashboard
- `calculateCandidateScore(candidateId)` — score 0-100
- `findDuplicates(candidateId)` — detectar duplicados
- `mergeCandidates(keepId, deleteId)` — fundir candidatos

**Accoes em Massa:**
- `bulkUpdateStatus(ids, status)` — alterar estado
- `bulkAssignRecruiter(ids, recruiterId)` — atribuir recrutador
- `exportCandidatesCsv(filters?)` — exportar CSV

**Alertas e Relatorios:**
- `getRecruitmentAlerts()` — alertas automaticos
- `getRecruitmentReportData(dateFrom?, dateTo?)` — dados para relatorios

---

### Paginas

```
app/dashboard/recrutamento/
├── page.tsx                    — Dashboard (KPIs, graficos, actividade recente)
├── layout.tsx                  — Layout com navegacao lateral do modulo
├── actions.ts                  — 43 server actions centralizadas
├── pipeline/page.tsx           — Kanban board (7 colunas) [A CRIAR]
├── candidatos/page.tsx         — Tabela + filtros + accoes em massa [A CRIAR]
├── calendario/page.tsx         — Mini calendario de entrevistas [A CRIAR]
├── alertas/page.tsx            — Lista de alertas automaticos [A CRIAR]
├── relatorios/page.tsx         — Graficos e relatorios [A CRIAR]
├── templates/page.tsx          — Templates de comunicacao [A CRIAR]
├── formulario/page.tsx         — Submissoes + editor de campos [EXISTENTE]
└── [id]/page.tsx               — Detalhe do candidato (9 tabs) [EXISTENTE]
```

---

### Componentes

```
components/recrutamento/
├── form-editor-tab.tsx         — Editor de campos do formulario [EXISTENTE]
├── submissions-tab.tsx         — Lista de submissoes [EXISTENTE]
├── candidate-card.tsx          — Card para Kanban [A CRIAR]
├── candidate-filters.tsx       — Barra de filtros [A CRIAR]
├── candidate-form.tsx          — Formulario de criacao/edicao [A CRIAR]
├── candidate-score-badge.tsx   — Badge de score com tooltip [A CRIAR]
├── communication-timeline.tsx  — Timeline de comunicacoes [A CRIAR]
├── communication-form.tsx      — Dialog de nova comunicacao [A CRIAR]
├── interview-timeline.tsx      — Timeline de entrevistas [A CRIAR]
├── interview-form.tsx          — Dialog de nova entrevista [A CRIAR]
├── onboarding-checklist.tsx    — Checklist visual [A CRIAR]
├── origin-profile-form.tsx     — Formulario perfil origem [A CRIAR]
├── pain-pitch-list.tsx         — Lista de pain/pitch [A CRIAR]
├── probation-stepper.tsx       — Stepper 30/60/90 dias [A CRIAR]
├── pipeline-column.tsx         — Coluna do Kanban [A CRIAR]
├── stage-log-timeline.tsx      — Timeline de historico [A CRIAR]
├── duplicate-detector.tsx      — UI de deteccao/merge [A CRIAR]
├── comm-template-form.tsx      — Dialog de template [A CRIAR]
├── report-charts.tsx           — Graficos de relatorios [A CRIAR]
└── alert-list.tsx              — Lista de alertas [A CRIAR]
```

---

### Types

```
types/recruitment.ts
```

Contem todos os tipos, interfaces e constantes do modulo:

**Tipos base:**
- `CandidateSource` — 7 valores
- `CandidateStatus` — 7 valores
- `CandidateDecision` — 4 valores
- `OriginBrand` — 7 valores
- `InterviewFormat` — 3 valores
- `CampaignPlatform` — 4 valores
- `CommunicationType` — 6 valores
- `CommunicationDirection` — 2 valores
- `ProbationStatus` — 3 valores
- `CommTemplateChannel` — 3 valores
- `AlertType` — 5 valores
- `AlertSeverity` — 3 valores

**Interfaces:**
- `RecruitmentCandidate`
- `RecruitmentOriginProfile`
- `RecruitmentPainPitch`
- `RecruitmentInterview`
- `RecruitmentFinancialEvolution`
- `RecruitmentBudget`
- `RecruitmentOnboarding`
- `RecruitmentStageLog`
- `RecruitmentCommunication`
- `RecruitmentProbation`
- `RecruitmentCommTemplate`
- `RecruitmentAlert`
- `CandidateScoreBreakdown`

**Constantes (mapas PT-PT):**
- `CANDIDATE_SOURCES`
- `CANDIDATE_STATUSES` (com label e cor)
- `CANDIDATE_DECISIONS` (com label e cor)
- `ORIGIN_BRANDS`
- `INTERVIEW_FORMATS`
- `CAMPAIGN_PLATFORMS`
- `PIPELINE_STAGES` (array ordenado)
- `COMMUNICATION_TYPES` (com label e icone)
- `COMMUNICATION_DIRECTIONS`
- `PROBATION_STATUSES` (com label e cor)
- `COMM_TEMPLATE_CHANNELS`
- `ALERT_TYPES` (com label e icone)
- `ALERT_SEVERITIES` (com label e cor)

---

## Permissoes

O modulo de recrutamento e controlado pela permissao `recruitment` na tabela `roles.permissions`.

**Roles com acesso:**
- `Broker/CEO` — acesso total
- `recrutador` — acesso total
- `team_leader` — leitura + edicao dos seus candidatos
- `Office Manager` — leitura

**Verificacao no frontend:**
```typescript
const { hasPermission } = usePermissions()
const canAccessRecruitment = hasPermission('recruitment')
```

---

## Fluxo Principal

```
1. Candidato entra no sistema
   ├── Via formulario publico (recruitment_entry_submissions)
   │   └── Aprovacao → cria recruitment_candidates com status 'prospect'
   ├── Via criacao manual no ERP
   └── Via importacao (futuro)

2. Pipeline de recrutamento
   prospect → in_contact → in_process → decision_pending
   │
   ├── → joined (aderiu)
   │     ├── Onboarding iniciado (recruitment_onboarding)
   │     ├── Periodo de experiencia (temp_recruitment_probation)
   │     └── Evolucao financeira (recruitment_financial_evolution)
   │
   ├── → declined (recusou)
   │     └── Motivo registado (reason_no)
   │
   └── → on_hold (em espera)
         └── Pode regressar a qualquer fase

3. Ao longo do pipeline:
   ├── Comunicacoes registadas (temp_recruitment_communications)
   ├── Entrevistas agendadas e realizadas (recruitment_interviews)
   ├── Pain/Pitch documentados (recruitment_pain_pitch)
   ├── Score calculado automaticamente
   └── Alertas gerados para accoes pendentes
```

---

## Notas Tecnicas

1. **Server Actions em vez de API Routes** — O modulo usa `"use server"` actions em `actions.ts` em vez de route handlers em `app/api/`. Isto simplifica o codigo e aproveita o streaming do Next.js.

2. **Supabase Admin Client** — As actions usam `createAdminClient()` (service role, sem RLS) para todas as queries. Isto permite acesso total sem configurar policies complexas.

3. **Tabelas `temp_` prefix** — As tabelas novas (`temp_recruitment_communications`, `temp_recruitment_probation`, `temp_recruitment_comm_templates`) usam o prefixo `temp_` conforme convencao do projecto para modulos em desenvolvimento. Serao renomeadas apos estabilizacao.

4. **RLS activado** — Todas as tabelas de recrutamento tem RLS activado com policy simples para utilizadores autenticados.

5. **Score computado** — O score nao e persistido na base de dados. E calculado on-demand pela `calculateCandidateScore()` com base no estado actual dos dados.

6. **Alertas computados** — Os alertas tambem nao sao persistidos. Sao calculados em tempo real pela `getRecruitmentAlerts()`.

7. **Extraccao IA de CC** — A extraccao de dados do Cartao de Cidadao usa GPT-4o vision. Requer `OPENAI_API_KEY` no `.env.local`.

8. **Deteccao de duplicados** — A funcao `findDuplicates()` normaliza telefones (remove espacos e prefixo +351) e emails (lowercase) antes de comparar.

9. **Formulario publico** — O formulario de entrada pode ser partilhado via link publico. Os campos sao configurados dinamicamente via `recruitment_form_fields`. O flag `is_ai_extractable` indica quais campos podem ser pre-preenchidos pela extraccao IA do documento de identificacao.

10. **Dependencias** — O modulo nao requer dependencias adicionais. Utiliza `date-fns` (ja instalado) para calculos de datas e `sonner` (ja instalado) para notificacoes. Para o Kanban com drag-and-drop, recomenda-se `@dnd-kit/core` + `@dnd-kit/sortable` (ja instalados do modulo de imoveis).
