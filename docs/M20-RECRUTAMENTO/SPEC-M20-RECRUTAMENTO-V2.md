# SPEC-M20 — Módulo de Recrutamento (V2 — Redesign)

**Última actualização:** 2026-03-26
**Estado:** Em desenvolvimento
**Módulo:** M20 — Recrutamento CRM
**Substitui:** SPEC-M20-RECRUTAMENTO.md (v1)

---

## Motivação do Redesign

A v1 do módulo de recrutamento é funcional mas sobre-engenheirada:
- **10 tabs** no detalhe do candidato → sobrecarga cognitiva
- **8 páginas** de navegação → dispersão de informação
- **Dados de baixo volume** separados em tabs próprias (Budget = 4 campos, Financial Evolution = 6 campos)
- **Falta o mais importante:** geração de contrato e criação automática de consultor
- **UI desalinhada** do design language actual do app (glassmorphism, rounded-2xl)

### Princípios do Redesign

1. **Guiar o recrutador** pelo fluxo natural: Contacto → Qualificação → Entrevista → Decisão → Onboarding → Contrato → Consultor
2. **Hierarquia de atenção** — o que preciso fazer HOJE está sempre visível
3. **Agrupar dados relacionados** — menos tabs, mais contexto por secção
4. **Culminar na automação** — do candidato ao consultor com um botão

---

## Visão Geral da Arquitectura V2

### Navegação: 8 páginas → 5

| Página | URL | Propósito |
|--------|-----|-----------|
| **Dashboard** | `/dashboard/recrutamento` | KPIs + alertas inline + actividade recente + mini-relatórios |
| **Pipeline** | `/dashboard/recrutamento/pipeline` | Kanban com action indicators nos cards |
| **Candidatos** | `/dashboard/recrutamento/candidatos` | Tabela com search/filter/bulk ops |
| **Calendário** | `/dashboard/recrutamento/calendario` | Entrevistas e follow-ups |
| **Configuração** | `/dashboard/recrutamento/configuracao` | Templates + Editor formulário (2 sub-tabs) |

**Removidos como páginas standalone:**
- ~~Alertas~~ → integrados no Dashboard (secção de alertas com badges)
- ~~Relatórios~~ → integrados no Dashboard (secção colapsável ou toggle)
- ~~Templates~~ → movido para Configuração (tab 1)
- ~~Formulário~~ → movido para Configuração (tab 2)

### Detalhe do Candidato: 10 tabs → 4 tabs

| Tab | Conteúdo | Tabelas DB |
|-----|----------|------------|
| **Visão Geral** | Dados pessoais, fonte, recrutador, notas, comunicações (timeline), histórico de estágios (colapsável) | `recruitment_candidates`, `temp_recruitment_communications`, `recruitment_stage_log` |
| **Qualificação** | Perfil de origem, pain & pitch (1 registo, não N), evolução financeira, budget — tudo num formulário scrollable | `recruitment_origin_profiles`, `recruitment_pain_pitch`, `recruitment_financial_evolution`, `recruitment_budget` |
| **Entrevistas** | Lista de entrevistas, agendar nova, decisão (reason_yes/reason_no) | `recruitment_interviews` |
| **Onboarding** | Recolha de documentos, checklist onboarding, geração de contrato, botão "Criar Consultor" | `recruitment_onboarding`, `recruitment_entry_submissions` |

---

## Página 1 — Dashboard (`/dashboard/recrutamento`)

### KPIs (4 cards superiores, glass style)

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Total Pipeline  │ │  Novos (Mês)    │ │  Taxa Conversão │ │  Tempo Médio    │
│      24          │ │      7           │ │     32%         │ │    18 dias      │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Alertas Inline (abaixo dos KPIs)

Cards horizontais com severidade (urgente = vermelho, aviso = amarelo, info = azul):
- "João Silva — sem contacto há 14 dias" (urgente)
- "Ana Santos — follow-up hoje" (aviso)
- "Pedro Costa — entrevista amanhã" (info)

Máximo 5 alertas visíveis + "Ver todos (12)" expande lista completa.

### Actividade Recente + Mini-Relatórios

Layout em 2 colunas:
- **Esquerda:** Feed de actividade (últimas 10 acções)
- **Direita:** Mini-gráficos (funil de conversão, candidatos por fonte — compactos)

### Server Actions: `getRecruitmentKPIs()`, `getRecruitmentAlerts()`, `getCandidates()`, `getRecruitmentReportData()`

---

## Página 2 — Pipeline (`/dashboard/recrutamento/pipeline`)

### Kanban (mantém v1 com melhorias visuais)

7 colunas: Prospecto → Em Contacto → Em Processo → Decisão Pendente → Aderiu → Recusou → Em Espera

### Card do Candidato (redesign)

```
┌──────────────────────────────────┐
│ 🟢  João Silva                   │  ← dot de cor = tempo sem contacto
│ LinkedIn · RE/MAX                │  ← fonte + marca de origem
│                                  │
│ ⚡ Follow-up hoje               │  ← action indicator (só aparece se relevante)
│                                  │
│ 👤 Maria R.          Score: 72   │  ← recrutador + score
└──────────────────────────────────┘
```

**Action indicators** (mostram o que precisa de atenção):
- "Follow-up hoje" (amarelo)
- "Entrevista amanhã" (azul)
- "Sem contacto há X dias" (vermelho se >14d, amarelo se >7d)
- "Onboarding pendente" (para status `joined`)

### Drag-and-drop: mantém comportamento v1

### Server Actions: `getCandidates()`, `updateCandidate()`, `getRecruiters()`

---

## Página 3 — Candidatos (`/dashboard/recrutamento/candidatos`)

**Mantém v1** — tabela com filtros, bulk actions, CSV export, paginação.

Sem alterações de lógica, apenas modernização visual (glassmorphism nos filtros, rounded-2xl nos cards de acções em massa).

### Server Actions: mesmas da v1

---

## Página 4 — Calendário (`/dashboard/recrutamento/calendario`)

**Mantém v1** — calendário mensal com entrevistas e follow-ups.

Modernização visual apenas.

### Server Actions: `getAllInterviews()`

---

## Página 5 — Configuração (`/dashboard/recrutamento/configuracao`)

**NOVA página** que junta Templates + Formulário.

### Tab 1 — Templates de Comunicação
Mantém funcionalidade v1 de CRUD de templates (nome, fase, canal, assunto, corpo, variáveis).

### Tab 2 — Formulário de Entrada
Mantém funcionalidade v1 (submissões + editor de campos).

### Server Actions: mesmas da v1 para templates e form fields

---

## Detalhe do Candidato (`/dashboard/recrutamento/[id]`)

### Cabeçalho (sticky, glassmorphism)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Voltar    João Manuel da Silva Pereira                               │
│              📧 joao@email.com  📱 912 345 678                          │
│                                                                          │
│  [Em Processo ▾]   Score: 72/100   👤 Maria Rodrigues    ⏱ há 2 dias   │
│                                                                          │
│  ●───────●───────●───────◐───────○───────○───────○                      │
│  Prosp.  Cont.   Proc.   Decis.  Aderiu  Recus.  Esp.                  │
└──────────────────────────────────────────────────────────────────────────┘
```

- Nome completo + contactos directos (clicáveis: tel:, mailto:)
- Status como dropdown editável inline
- Score compacto (badge numérico com cor)
- Recrutador atribuído (avatar + nome, editável)
- Tempo desde última interacção (com alerta visual se >7d)
- **Progress bar de pipeline** — pills com estados, posição actual destacada

### Componente: `<CandidateHeader>`
Extraído para componente próprio (~80 linhas). Props: candidate, onUpdate, recruiters.

---

### Tab 1 — Visão Geral

Tudo o que o recrutador precisa ver **primeiro**.

#### Secção: Dados do Candidato (Card)
- Nome completo, telefone, email — editáveis inline
- Fonte + detalhe da fonte
- Data do primeiro contacto
- Notas (textarea expandível)

#### Secção: Timeline de Comunicações
Estilo chat/timeline vertical com bolhas glass:

```
┌─ 📞 Chamada (enviada) ─── Maria R. · há 2 horas ──────────┐
│  Falei com o João, está interessado. Marcámos reunião       │
│  para quinta-feira.                                          │
└──────────────────────────────────────────────────────────────┘

┌─ 💬 WhatsApp (recebida) ─── João S. · há 1 dia ────────────┐
│  Bom dia, gostaria de saber mais sobre a Infinity.          │
└──────────────────────────────────────────────────────────────┘
```

- Botão "Registar comunicação" → dialog com tipo, assunto, conteúdo, direcção
- Opção de usar template (pré-preenche)
- Filtro por tipo de comunicação

#### Secção: Histórico de Estágios (Colapsável)
Mini-timeline das mudanças de status — colapsado por defeito, expande com click.

#### Secção: Decisão (visível apenas quando status = `decision_pending` ou terminal)
- Razão de adesão (`reason_yes`) — textarea
- Razão de recusa (`reason_no`) — textarea
- Data da decisão

### Componente: `<CandidateOverviewTab>`
### Server Actions: `getCandidate()`, `updateCandidate()`, `getCommunications()`, `createCommunication()`, `getStageLog()`

---

### Tab 2 — Qualificação

Toda a informação de avaliação do candidato **num único formulário scrollable** com secções visuais.

#### Secção: Perfil de Origem
- Activo no imobiliário (toggle)
- Marca de origem (select) + campo custom
- Tempo na marca anterior (meses)
- Motivo de saída (textarea)
- Facturação média mensal / anual (EUR)

#### Secção: Pain & Pitch
**Alteração v1→v2:** de 1:N para **1:1** (um único registo por candidato).
Na prática, o recrutador actualiza o mesmo registo à medida que evolui o contacto.

- Dores identificadas (textarea)
- Soluções apresentadas (textarea)
- Objecções do candidato (textarea)
- Fit Score (1-5, input com estrelas ou slider)

#### Secção: Projecção Financeira
Junta "Evolução Financeira" + "Budget" da v1.

- Facturação projectada: mês 1, 2, 3, 6, 12 (EUR)
- Meses para igualar anterior
- Campanha paga utilizada (toggle)
- Plataforma da campanha (select)
- Custo estimado (EUR)
- Notas

### Componente: `<CandidateQualificationTab>`
### Server Actions: `getOriginProfile()`, `upsertOriginProfile()`, `getPainPitchRecords()`, `upsertPainPitch()`, `getFinancialEvolution()`, `upsertFinancialEvolution()`, `getBudget()`, `upsertBudget()`

---

### Tab 3 — Entrevistas

#### Lista de Entrevistas (cards, não tabela)
Cada entrevista como card glass com:
- Número (#1, #2, #3...)
- Data e hora
- Formato (badge: Presencial / Videochamada / Telefone)
- Conduzida por (avatar + nome)
- Notas (preview truncado, expande com click)
- Próximo passo
- Follow-up (com badge "Pendente" / "Atrasado" / "Concluído")

#### Botão "Agendar Entrevista" → Dialog
- Data e hora (datetime picker)
- Formato (select)
- Conduzida por (select de recrutadores)
- Notas
- Próximo passo
- Data de follow-up

### Componente: `<CandidateInterviewsTab>`
### Server Actions: `getInterviews()`, `createInterview()`, `updateInterview()`, `deleteInterview()`

---

### Tab 4 — Onboarding & Contrato

**NOVA funcionalidade** — o culminar do processo de recrutamento.

Visível para **todos os candidatos**, mas apenas **activa quando status = `joined`** (antes disso mostra mensagem "Candidato ainda não aderiu").

#### Secção 1: Dados para Contrato

Dados pessoais necessários para o contrato — podem vir da entry form submission ou ser preenchidos manualmente.

| Campo | Fonte | DB |
|-------|-------|----|
| Nome completo | candidato / submission | `recruitment_candidates.full_name` |
| NIF | submission / manual | `recruitment_entry_submissions.nif` |
| NISS | submission / manual | `recruitment_entry_submissions.niss` |
| Nº Cartão Cidadão | submission / manual | `recruitment_entry_submissions.cc_number` |
| Validade CC | submission / manual | `recruitment_entry_submissions.cc_expiry` |
| Data de Nascimento | submission / manual | `recruitment_entry_submissions.date_of_birth` |
| Naturalidade | submission / manual | `recruitment_entry_submissions.naturalidade` |
| Estado Civil | submission / manual | `recruitment_entry_submissions.estado_civil` |
| Morada completa | submission / manual | `recruitment_entry_submissions.full_address` |
| IBAN | manual (novo campo) | `recruitment_entry_submissions.iban` (novo) |
| Telemóvel profissional | submission / manual | `recruitment_entry_submissions.professional_phone` |
| Email profissional | submission / manual | sugestão do email |
| Taxa de comissão | manual | novo campo |
| Salário base | manual | novo campo |
| Data de início | manual | novo campo |

**Nota importante:** NIF e IBAN são **campos** (extraídos do documento de identificação ou preenchidos manualmente), não documentos em si.

Se existir uma `recruitment_entry_submissions` ligada ao candidato, os campos são pré-preenchidos automaticamente.

#### Secção 2: Documentos Necessários

Checklist de documentos com upload e estado:

| Documento | Obrigatório | Estado |
|-----------|-------------|--------|
| Cartão de Cidadão (frente) | Sim | ○ Pendente / ✓ Recebido |
| Cartão de Cidadão (verso) | Sim | ○ Pendente / ✓ Recebido |
| Foto profissional | Sim | ○ Pendente / ✓ Recebido |
| Comprovativo de morada | Não | ○ Pendente / ✓ Recebido |

Auto-pull de `recruitment_entry_submissions` se existirem (`id_document_front_url`, `id_document_back_url`, `professional_photo_url`).

Cada documento tem:
- Slot de upload (ou preview se já existe)
- Estado (pendente / recebido / validado)
- Data de recepção

#### Secção 3: Checklist de Onboarding

- [ ] Dados para contrato completos
- [ ] Documentos necessários recebidos
- [ ] Contrato gerado
- [ ] Contrato enviado
- [ ] Formulário de entrada preenchido
- [ ] Acessos criados (email, ERP)

Barra de progresso visual (0% → 100%).

Items auto-checkados quando as condições são satisfeitas (e.g., "Dados completos" fica checked quando todos os campos obrigatórios da Secção 1 estão preenchidos).

#### Secção 4: Geração de Contrato

Botão **"Gerar Contrato"** (enabled quando Secção 1 completa):
1. Seleccionar template de contrato (select de templates de contrato)
2. Preview do contrato com dados preenchidos (HTML renderizado)
3. Gerar PDF
4. Opções: Download / Enviar por email (Resend)

**Variáveis de template de contrato:**
```
{{nome_completo}}, {{nif}}, {{niss}}, {{cc_numero}}, {{morada}},
{{data_nascimento}}, {{estado_civil}}, {{naturalidade}},
{{iban}}, {{telemovel}}, {{email_profissional}},
{{taxa_comissao}}, {{salario_base}}, {{data_inicio}},
{{data_contrato}}, {{empresa}} ("Infinity Group")
```

#### Secção 5: Criar Consultor

Botão **"Criar Consultor"** — o passo final.

**Pré-condições** (todas devem ser verdadeiras):
- Status = `joined`
- Todos os campos obrigatórios da Secção 1 preenchidos
- Documentos obrigatórios recebidos (CC frente + verso, foto)
- Contrato gerado

**Ao clicar:**
1. Cria registo em `auth.users` (Supabase Auth invite)
2. Cria registo em `dev_users`:
   - `professional_email` = email profissional
   - `commercial_name` = display_name ou full_name
   - `role_id` = role "Consultor"
   - `is_active` = true
3. Cria registo em `dev_consultant_profiles`:
   - `profile_photo_url` = foto profissional do submission
   - `phone_commercial` = telemóvel profissional
   - `instagram_handle` = do submission
   - `linkedin_url` = do submission (se existir)
4. Cria registo em `dev_consultant_private_data`:
   - `full_name`, `nif`, `iban`, `address_private` = morada
   - `commission_rate` = taxa de comissão
   - `monthly_salary` = salário base
   - `hiring_date` = data de início
5. Actualiza `recruitment_candidates.consultant_user_id` (novo campo FK → dev_users.id) para manter rastreabilidade
6. Inicia período de experiência (`temp_recruitment_probation`) automaticamente

**Resultado:**
- Toast: "Consultor João Silva criado com sucesso! Convite enviado para joao@infinity.pt"
- Banner no cabeçalho do candidato: "Este candidato é agora o consultor João Silva" (link para perfil)

### Componente: `<CandidateOnboardingTab>`
### Server Actions: `getOnboarding()`, `upsertOnboarding()`, `getEntrySubmission()`, nova `createConsultorFromCandidate()`, nova `generateContract()`

---

## Período de Experiência (Pós-Consultor)

Após a criação do consultor, o tab "Onboarding & Contrato" transforma-se para mostrar também o acompanhamento do período de experiência.

#### Secção Extra (só visível quando `consultant_user_id` != null):

**Período de Experiência (90 dias)**

```
┌──────────────────────────────────────────────────────────────┐
│  Início: 01/04/2026    Fim: 30/06/2026    ████████░░ 67%    │
│                                                               │
│  ✅ 30 dias (01/05)     ✅ 60 dias (01/06)     ○ 90 dias    │
│  "Boa adaptação,        "Primeira venda         Pendente     │
│   2 angariações"         concretizada"                       │
│                                                               │
│  Mês 1: €2.500/€3.000  Mês 2: €4.100/€3.000  Mês 3: —/—   │
│         ████████░░             ██████████              ░░░░  │
└──────────────────────────────────────────────────────────────┘
```

- Stepper horizontal: 30 / 60 / 90 dias
- Cada marco: checkbox concluído + notas
- Objectivo vs real por mês (barras comparativas)
- Estado: Activo / Concluído / Não Aprovado

### Server Actions: `getProbation()`, `upsertProbation()`

---

## Alterações à Base de Dados

### Campos Novos

#### `recruitment_candidates` — adicionar:
```sql
ALTER TABLE recruitment_candidates
ADD COLUMN consultant_user_id UUID REFERENCES dev_users(id);
```

#### `recruitment_entry_submissions` — adicionar:
```sql
ALTER TABLE recruitment_entry_submissions
ADD COLUMN iban TEXT;
```

#### Nova tabela: `recruitment_contract_templates`
```sql
CREATE TABLE recruitment_contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content_html TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Nova tabela: `recruitment_contracts` (contratos gerados)
```sql
CREATE TABLE recruitment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id),
  template_id UUID REFERENCES recruitment_contract_templates(id),
  contract_data JSONB NOT NULL,        -- dados usados na geração
  generated_html TEXT,                  -- HTML renderizado
  pdf_url TEXT,                         -- URL do PDF no R2
  status TEXT DEFAULT 'draft',          -- draft | sent | signed
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas Existentes (sem alterações)
Todas as tabelas da v1 mantêm-se. A única alteração estrutural é:
- `recruitment_pain_pitch` continua a existir como 1:N na DB, mas a UI mostra apenas o último registo e permite editar/criar (simplificação de UX, não de schema)

### Tabelas `temp_` a Renomear (futuro)
As tabelas `temp_recruitment_communications`, `temp_recruitment_probation`, `temp_recruitment_comm_templates` devem ser renomeadas sem o prefixo `temp_` quando estabilizarem.

---

## Design Language — UI/UX

### Glassmorphism Pattern
```tsx
// Card base
className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-6 shadow-sm"

// Card hover
className="transition-all duration-300 hover:shadow-md hover:bg-card/80"

// Header sticky
className="sticky top-0 z-10 rounded-2xl border border-border/30 bg-background/80 backdrop-blur-md p-4"

// KPI card
className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-4"

// Pipeline card
className="rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01]"

// Alert card (urgente)
className="rounded-xl border border-red-200/50 bg-red-50/50 backdrop-blur-sm p-3"
```

### Progress Pills (Pipeline)
```tsx
// Pill activa
className="rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground"

// Pill completa
className="rounded-full px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700"

// Pill pendente
className="rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground"
```

### Communications Timeline
```tsx
// Bubble outbound
className="ml-8 rounded-2xl rounded-br-sm border border-border/20 bg-primary/5 p-3"

// Bubble inbound
className="mr-8 rounded-2xl rounded-bl-sm border border-border/20 bg-card/60 p-3"
```

---

## Componentes a Criar/Refactorizar

### Novos Componentes
| Componente | Localização | Descrição |
|------------|------------|-----------|
| `CandidateHeader` | `components/recrutamento/candidate-header.tsx` | Cabeçalho sticky com pipeline pills |
| `CandidateOverviewTab` | `components/recrutamento/candidate-overview-tab.tsx` | Dados + comunicações + histórico |
| `CandidateQualificationTab` | `components/recrutamento/candidate-qualification-tab.tsx` | Origem + pain/pitch + financeiro |
| `CandidateInterviewsTab` | `components/recrutamento/candidate-interviews-tab.tsx` | Entrevistas como cards |
| `CandidateOnboardingTab` | `components/recrutamento/candidate-onboarding-tab.tsx` | Docs + contrato + criar consultor |
| `CommunicationsTimeline` | `components/recrutamento/communications-timeline.tsx` | Timeline estilo chat |
| `PipelineProgress` | `components/recrutamento/pipeline-progress.tsx` | Pills de progresso |
| `ContractGenerator` | `components/recrutamento/contract-generator.tsx` | Preview + gerar PDF |
| `OnboardingChecklist` | `components/recrutamento/onboarding-checklist.tsx` | Checklist visual com auto-check |
| `ProbationTracker` | `components/recrutamento/probation-tracker.tsx` | Stepper 30/60/90 + billing |

### Componentes Existentes (manter)
- `submissions-tab.tsx` — mover para tab dentro de Configuração
- `form-editor-tab.tsx` — mover para tab dentro de Configuração

---

## Server Actions — Novas

```typescript
// Contrato
async function getContractTemplates(): Promise<ContractTemplate[]>
async function createContractTemplate(data: ContractTemplateInput): Promise<ContractTemplate>
async function generateContract(candidateId: string, templateId: string, data: ContractData): Promise<Contract>
async function sendContract(contractId: string, email: string): Promise<void>

// Criar Consultor
async function createConsultorFromCandidate(candidateId: string, consultorData: CreateConsultorInput): Promise<{ userId: string }>
// → cria auth.users + dev_users + dev_consultant_profiles + dev_consultant_private_data
// → actualiza recruitment_candidates.consultant_user_id
// → inicia probation

// Entry submission link
async function linkSubmissionToCandidate(submissionId: string, candidateId: string): Promise<void>
async function getLinkedSubmission(candidateId: string): Promise<EntrySubmission | null>
```

---

## Ordem de Implementação

### Fase 1 — Simplificar Detalhe do Candidato
1. Criar componentes: `CandidateHeader`, `PipelineProgress`
2. Criar `CandidateOverviewTab` (dados + comunicações timeline + stage log colapsável)
3. Criar `CandidateQualificationTab` (origem + pain/pitch + financeiro + budget)
4. Criar `CandidateInterviewsTab` (entrevistas como cards)
5. Placeholder para `CandidateOnboardingTab`
6. Reescrever `[id]/page.tsx` com 4 tabs + header + glassmorphism

### Fase 2 — Consolidar Navegação
1. Criar página `/configuracao` com 2 sub-tabs (templates + formulário)
2. Integrar alertas e mini-relatórios no Dashboard
3. Actualizar `layout.tsx` com 5 items de navegação
4. Modernizar visualmente: Pipeline, Candidatos, Calendário

### Fase 3 — Onboarding & Contrato
1. Migração DB: novos campos e tabelas
2. Criar `CandidateOnboardingTab` com secções 1-3 (dados + docs + checklist)
3. Criar `ContractGenerator` com preview e geração PDF
4. Integrar envio por email (Resend)

### Fase 4 — Candidato → Consultor
1. Server action `createConsultorFromCandidate()`
2. UI do botão com pré-condições visuais
3. Integração com Supabase Auth (invite)
4. Criação automática de registos (dev_users, profiles, private_data)
5. `ProbationTracker` com stepper e billing

### Fase 5 — Polish & Glassmorphism
1. Aplicar design language a todas as páginas
2. Pipeline cards com action indicators
3. Animações de transição
4. Empty states ilustrados
5. Mobile responsive

---

## Notas Importantes

1. **NIF e IBAN são campos**, não documentos — preenchidos manualmente ou extraídos via IA do documento de identificação
2. **Pain & Pitch simplificado** — UI mostra 1 registo (o último), mas DB mantém schema 1:N para histórico
3. **Score mantém-se** mas é compacto no header, não tab própria
4. **Duplicate detection** corre automaticamente no create/edit, mostra banner de aviso — não é tab
5. **Entry form submissions** podem ser ligadas a candidatos para auto-preencher dados de onboarding
6. **Server Actions** continuam como padrão de backend (não API Route Handlers)
7. **Período de experiência** inicia automaticamente ao criar consultor
8. **Toda a UI em PT-PT**
