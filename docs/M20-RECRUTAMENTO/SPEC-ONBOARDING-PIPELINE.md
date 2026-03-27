# SPEC — Onboarding Pipeline & Form-Candidate Linking

**Data:** 2026-03-27
**Estado:** A implementar
**Pré-requisito:** Ler CLAUDE.md + SPEC-M20-RECRUTAMENTO-V2.md

---

## 1. Form ↔ Candidate Linking

### 1.1 DB Changes

```sql
ALTER TABLE recruitment_entry_submissions
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES recruitment_candidates(id);

CREATE INDEX IF NOT EXISTS idx_entry_submissions_candidate
  ON recruitment_entry_submissions(candidate_id);
```

### 1.2 Entry Form (`/entryform`)

- Accept `?c=<candidateId>` query parameter
- If present, store `candidate_id` in hidden field, submit it with the form
- Pre-fill `full_name` from the candidate record (fetch via public API)
- The `POST /api/entry-form` endpoint saves `candidate_id` to `recruitment_entry_submissions`

### 1.3 Generate Link (Candidate Detail → Onboarding Tab)

- Button "Enviar Formulário" that copies `https://app.infinitygroup.pt/entryform?c=<candidateId>` to clipboard
- Only visible when candidate status is `joined` or `decision_pending`
- Toast: "Link copiado! Envie ao consultor."

### 1.4 Submissions Tab

- Show linked candidate name next to each submission (or "Não associado")
- If not linked, show a "Associar Candidato" button → dialog to search and select a candidate
- API: `PUT /api/entry-form/submissions/[id]` already exists — add `candidate_id` to allowed fields

### 1.5 Candidate Detail → Onboarding Tab

- If candidate has a linked submission (`recruitment_entry_submissions.candidate_id = candidate.id`), auto-pull all fields
- If no linked submission, show "Aguardar formulário" state with the link generation button

---

## 2. Onboarding Pipeline

### 2.1 Pipeline Stages (8 steps)

```typescript
const ONBOARDING_STAGES = [
  { key: 'form_submitted', label: 'Formulário', icon: FileText,
    autoComplete: (data) => !!data.submission },

  { key: 'admin_validation', label: 'Validação', icon: CheckCircle2,
    autoComplete: (data) => data.submission?.status === 'approved' },

  { key: 'contract_sede', label: 'Contrato Sede', icon: Building2,
    autoComplete: (data) => data.onboarding?.contract_sede_status === 'signed' },

  { key: 'contract_ours', label: 'Contrato Nosso', icon: FileSignature,
    autoComplete: (data) => data.onboarding?.contract_ours_status === 'signed' },

  { key: 'access_creation', label: 'Acessos', icon: Key,
    autoComplete: (data) => data.onboarding?.accesses_created },

  { key: 'email_materials', label: 'Email & Materiais', icon: Mail,
    autoComplete: (data) => data.onboarding?.email_created && data.onboarding?.materials_ready },

  { key: 'initial_training', label: 'Formação Inicial', icon: GraduationCap,
    autoComplete: (data) => data.onboarding?.initial_training_completed },

  { key: 'plan_66_days', label: 'Plano 66 Dias', icon: Target,
    autoComplete: (data) => data.onboarding?.plan_66_started },
]
```

### 2.2 DB Changes — Extend `recruitment_onboarding`

```sql
ALTER TABLE recruitment_onboarding
  -- Contract tracking (two tracks)
  ADD COLUMN IF NOT EXISTS contract_sede_status TEXT DEFAULT 'pending',  -- pending, requested, sent, signed
  ADD COLUMN IF NOT EXISTS contract_sede_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_sede_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_sede_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_ours_status TEXT DEFAULT 'pending',  -- pending, generated, sent, signed
  ADD COLUMN IF NOT EXISTS contract_ours_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_ours_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_ours_signed_at TIMESTAMPTZ,
  -- Access creation
  ADD COLUMN IF NOT EXISTS accesses_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remax_access_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remax_access_granted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_access_created BOOLEAN DEFAULT false,
  -- Email & Materials
  ADD COLUMN IF NOT EXISTS email_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS email_signature_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS materials_ready BOOLEAN DEFAULT false,
  -- Training
  ADD COLUMN IF NOT EXISTS initial_training_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_training_date DATE,
  ADD COLUMN IF NOT EXISTS plan_66_started BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_66_start_date DATE,
  -- Current stage (auto-calculated but cached)
  ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'form_submitted';
```

### 2.3 Onboarding Tab UI — Visual Pipeline

Layout: horizontal progress bar at top + expandable sections below.

```
[●]───[●]───[●]───[○]───[○]───[○]───[○]───[○]
Form  Valid  Sede  Nosso Access Email  Form. P66
```

- Green filled = completed
- Current = pulsing/highlighted
- Gray = pending
- Clicking a stage scrolls to that section

### 2.4 Each Stage Section

#### Stage 1: Formulário
- Shows linked submission data (or "Aguardar" + link button)
- Auto-completes when `recruitment_entry_submissions` has a record with this `candidate_id`

#### Stage 2: Validação Administrativa
- Show submission status (pendente / aprovado / rejeitado)
- Approve/reject buttons (already exist in submissions tab)
- Checklist:
  - [ ] Dados pessoais completos
  - [ ] Documentos CC recebidos (frente + verso)
  - [ ] Foto profissional recebida
- Auto-completes when submission status = `approved`

#### Stage 3: Contrato Sede
- Status badge (Pendente → Solicitado → Enviado → Assinado)
- "Solicitar à Sede" button → sends email via Resend to sede with candidate data
- Upload slot for signed contract PDF
- Date tracking (requested_at, signed_at)

#### Stage 4: Contrato Nosso
- Status badge (Pendente → Gerado → Enviado → Assinado)
- "Gerar Contrato" button → uses existing contract generation (DOCX template fill)
- Upload slot for signed version
- Date tracking

#### Stage 5: Criação de Acessos
- Checklist with toggles:
  - [ ] Acesso à APP criado
  - [ ] Acesso RE/MAX solicitado
  - [ ] Acesso RE/MAX concedido
- "Criar Consultor" button (existing — creates auth user + dev_users + profiles)
- Auto-completes when all toggles are checked

#### Stage 6: Email & Materiais
- Email field (the assigned @remax.pt email)
- Toggle: Email criado
- Toggle: Assinatura de email gerada
- Toggle: Materiais de marketing prontos
- (Future: Canva MCP integration for auto-generation)

#### Stage 7: Formação Inicial
- Toggle: Formação inicial concluída
- Date picker: Data da formação
- Link to the formações module enrollment

#### Stage 8: Plano 66 Dias
- Toggle: Plano iniciado
- Date picker: Data de início
- (Future: link to goals/objectives module for 66-day tracking)

### 2.5 Progress Bar

- `percent_complete = completedStages / totalStages * 100`
- Displayed at top of the Onboarding tab
- Also shown as a mini progress indicator on the candidate list/pipeline cards

### 2.6 API Changes

**`GET /api/recrutamento/candidates/[id]/onboarding`** — returns:
- Onboarding record with all new fields
- Linked submission (if any)
- Calculated `current_stage` and `percent_complete`

**`PUT /api/recrutamento/candidates/[id]/onboarding`** — updates any onboarding field + recalculates `current_stage`

**`POST /api/recrutamento/candidates/[id]/onboarding/request-sede-contract`** — sends email to sede via Resend

**`POST /api/recrutamento/candidates/[id]/onboarding/upload-contract`** — uploads signed contract PDF to R2

---

## 3. "Criar Consultor" Button — Enhanced

When clicked (after all pre-conditions met):

1. Creates `auth.users` entry (Supabase Auth invite)
2. Creates `dev_users` with:
   - `professional_email` from onboarding email field or submission email suggestions
   - `commercial_name` from submission `display_name` or candidate `full_name`
   - `role_id` = "Consultor" role
3. Creates `dev_consultant_profiles` with:
   - `profile_photo_url` from submission photo
   - `phone_commercial` from submission phone
   - `instagram_handle`, `facebook_page` from submission
4. Creates `dev_consultant_private_data` with:
   - `full_name`, `nif`, `iban`, `address_private` from submission
   - `commission_rate`, `monthly_salary`, `hiring_date` from onboarding manual fields
5. Updates `recruitment_candidates.consultant_user_id = new_user_id`
6. Starts probation period (`temp_recruitment_probation`)
7. Enrolls in initial training (formações module)
8. Creates 66-day goals (objectives module)

**Pre-conditions (all must be true):**
- Candidate status = `joined`
- Submission linked and approved
- Both contracts signed
- All accesses checklist completed

---

## 4. Email Signature & Materials (Future — Canva MCP)

When "Gerar Materiais" is clicked:
1. Use Canva MCP `generate-design-structured` with:
   - Template: email signature template (pre-configured in Canva)
   - Variables: name, phone, email, photo URL
2. Export as PNG for email signature
3. Same flow for business card, social media header, etc.
4. Store generated URLs in `dev_consultant_profiles` or a new `consultant_materials` table

---

## 5. Implementation Order

1. **Migration SQL** — add `candidate_id` to submissions + extend `recruitment_onboarding`
2. **Entry form linking** — `?c=` param, auto-link on submit
3. **Submissions tab** — show linked candidate, manual association
4. **Onboarding tab redesign** — visual pipeline with 8 stages
5. **Each stage's UI** — one by one, starting with Form → Validation → Contracts
6. **Criar Consultor enhancement** — connect all the data
7. **Sede contract email** — Resend integration
8. **Canva materials** — future sprint
