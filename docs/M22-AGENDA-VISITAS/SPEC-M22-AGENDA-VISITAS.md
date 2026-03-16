# SPEC-M22 — Agenda e Visitas

## Visão Geral

Sistema de agendamento de visitas a imóveis com clientes, integrado com o calendário existente (M13), leads (M05), e imóveis (M03). Inclui confirmação, feedback pós-visita, e integração futura com Google Calendar/Outlook.

---

## 1. Conceitos

### Visita
Uma visita é um evento específico: um consultor mostra um imóvel a um ou mais clientes (leads).

```
Visita = Consultor + Imóvel + Lead(s) + Data/Hora + Estado
```

### Estados da Visita
| Estado | Descrição |
|--------|-----------|
| `scheduled` | Agendada |
| `confirmed` | Confirmada pelo cliente |
| `completed` | Realizada |
| `cancelled` | Cancelada |
| `no_show` | Cliente não apareceu |

---

## 2. Tabela: `temp_visits`

```sql
CREATE TABLE temp_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES dev_properties(id),
  consultant_id UUID NOT NULL REFERENCES dev_users(id),
  lead_id UUID REFERENCES leads(id),

  -- Agendamento
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  duration_minutes INT DEFAULT 30,

  -- Estado
  status TEXT DEFAULT 'scheduled',

  -- Confirmação
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,  -- 'client' | 'agent' | 'system'
  confirmation_method TEXT,  -- 'whatsapp' | 'phone' | 'email' | 'sms'

  -- Feedback pós-visita
  feedback_rating INT,  -- 1-5 stars
  feedback_interest TEXT,  -- 'very_interested' | 'interested' | 'neutral' | 'not_interested'
  feedback_notes TEXT,
  feedback_next_step TEXT,  -- 'second_visit' | 'proposal' | 'discard' | 'thinking'
  feedback_submitted_at TIMESTAMPTZ,

  -- Cancelamento
  cancelled_reason TEXT,
  cancelled_by UUID REFERENCES dev_users(id),

  -- Dados do cliente (se não há lead)
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,

  -- Notas
  notes TEXT,

  -- Calendar integration
  calendar_event_id UUID,  -- FK to temp_calendar_events
  external_calendar_id TEXT,  -- Google/Outlook event ID (futuro)

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES dev_users(id)
);
```

---

## 3. Funcionalidades

### 3.1 Agendar Visita

**Acesso:** A partir de:
- Detalhe do imóvel → botão "Agendar Visita"
- Detalhe do lead/negócio → botão "Agendar Visita" (com imóvel pré-seleccionado do matching)
- Calendário → criar evento tipo "visita"
- Página de visitas → botão "Nova Visita"

**Formulário:**
- Imóvel (select com autocomplete)
- Lead (select com autocomplete, ou preencher nome/telefone/email manualmente)
- Data e hora
- Duração (30min default)
- Notas

**Ao criar:**
- Cria registo em `temp_visits`
- Cria evento no calendário (temp_calendar_events) tipo "visita"
- Opcionalmente envia confirmação ao cliente (WhatsApp/SMS/email via automações)

### 3.2 Confirmar Visita

**Fluxo:**
- Automação envia mensagem 24h antes: "Confirma a visita amanhã às 15h?"
- Cliente responde (WhatsApp) → automação actualiza status para `confirmed`
- Ou: consultor marca manualmente como confirmada

### 3.3 Feedback Pós-Visita

**Após a visita**, o consultor preenche:
- Rating (1-5 estrelas)
- Nível de interesse (Muito interessado / Interessado / Neutro / Sem interesse)
- Notas do feedback
- Próximo passo (Segunda visita / Proposta / Descartar / A pensar)

**O feedback alimenta:**
- Lead score (se muito interessado, score sobe)
- Negócio (se proposta, sugere criar proposta no processo)
- Calendário (se segunda visita, sugere agendar)

### 3.4 Listagem de Visitas

**Página:** `/dashboard/visitas` ou tab no calendário

**Vistas:**
- Lista (tabela com filtros)
- Calendário (integrado com M13)
- Mapa (mostrar visitas do dia num mapa com pins dos imóveis)

**Filtros:**
- Consultor, imóvel, lead, estado, data range

### 3.5 Integração com Google Calendar / Outlook (Futuro)

**Fase 1 (agora):** Apenas calendário interno
**Fase 2 (futuro):**
- OAuth com Google/Microsoft
- Sync bidireccional
- Campo `external_calendar_id` já preparado na tabela

---

## 4. Ligações com Outros Módulos

| Módulo | Ligação |
|--------|---------|
| **Calendário (M13)** | Visitas aparecem como eventos no calendário |
| **Imóveis (M03)** | Tab "Visitas" no detalhe do imóvel com histórico |
| **Leads (M05)** | Tab "Visitas" no detalhe do lead |
| **Negócios (M05)** | Matching sugere agendar visita |
| **Automações (M10)** | Enviar confirmação 24h antes, lembrete 1h antes |
| **Dashboard** | KPI "Visitas Esta Semana" no dashboard do agente |
| **Objectivos (M14)** | Contabilizar visitas como actividade |

---

## 5. Páginas a Criar

| Ficheiro | Descrição |
|----------|-----------|
| `app/dashboard/visitas/page.tsx` | Listagem + calendário de visitas |
| `components/visits/visit-form.tsx` | Formulário de criação/edição |
| `components/visits/visit-feedback.tsx` | Formulário de feedback pós-visita |
| `components/visits/visit-card.tsx` | Card de visita para calendário |
| `app/dashboard/visitas/actions.ts` | Server actions |

---

## 6. Server Actions

```typescript
getVisits(filters?) → lista com joins (property, consultant, lead)
getVisit(id) → detalhe
createVisit(data) → cria visita + evento calendário
updateVisit(id, data) → actualiza
cancelVisit(id, reason) → cancela
submitFeedback(id, feedback) → regista feedback pós-visita
getVisitsByProperty(propertyId) → histórico de visitas do imóvel
getVisitsByLead(leadId) → histórico de visitas do lead
getUpcomingVisits(consultantId?) → visitas dos próximos 7 dias
```

---

## 7. Sidebar

Adicionar "Visitas" ao grupo "Negócio":
```typescript
{ title: 'Visitas', icon: MapPin, href: '/dashboard/visitas', permission: 'properties' }
```

---

## 8. Types

```typescript
// types/visit.ts

export type VisitStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type FeedbackInterest = 'very_interested' | 'interested' | 'neutral' | 'not_interested'
export type FeedbackNextStep = 'second_visit' | 'proposal' | 'discard' | 'thinking'
export type ConfirmationMethod = 'whatsapp' | 'phone' | 'email' | 'sms'

export interface Visit {
  id: string
  property_id: string
  consultant_id: string
  lead_id: string | null
  visit_date: string
  visit_time: string
  duration_minutes: number
  status: VisitStatus
  confirmed_at: string | null
  confirmed_by: string | null
  confirmation_method: ConfirmationMethod | null
  feedback_rating: number | null
  feedback_interest: FeedbackInterest | null
  feedback_notes: string | null
  feedback_next_step: FeedbackNextStep | null
  feedback_submitted_at: string | null
  cancelled_reason: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  notes: string | null
  calendar_event_id: string | null
  created_at: string
  updated_at: string
  // Joins
  property?: { id: string; title: string; external_ref: string; city: string }
  consultant?: { id: string; commercial_name: string }
  lead?: { id: string; name: string; phone_primary: string }
}
```
