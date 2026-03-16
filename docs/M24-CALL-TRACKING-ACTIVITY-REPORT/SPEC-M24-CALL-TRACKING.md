# SPEC-M24 — Call Tracking + Relatório de Actividade

## Visão Geral

Duas funcionalidades interligadas:

1. **Call Tracking** — Quando o consultor clica para telefonar a um lead/cliente, a app regista a chamada e ao voltar pergunta o resultado (atendeu/não atendeu/ocupado/caixa de voz). Isto alimenta alertas automáticos.

2. **Relatório de Actividade** — Dashboard automático (sem input manual) que agrega toda a actividade de cada consultor a partir dos dados existentes no ERP.

---

## 1. Call Tracking

### 1.1 Fluxo

```
Consultor vê lead/candidato com telefone
  │
  ├─ Clica no ícone 📞 (ou número de telefone)
  │
  ├─ App regista: chamada iniciada (timestamp, caller, target, context)
  │
  ├─ App abre dialer nativo: tel:+351XXXXXXXXX
  │    (ou WhatsApp: https://wa.me/351XXXXXXXXX)
  │
  ├─ Utilizador faz a chamada no telemóvel
  │
  ├─ Quando volta à app (visibilitychange event):
  │    ↓
  │    ┌──────────────────────────────────────────┐
  │    │  📞 Chamada para João Silva              │
  │    │                                          │
  │    │  O cliente atendeu?                      │
  │    │                                          │
  │    │  [✅ Atendeu]  [❌ Não Atendeu]          │
  │    │  [📱 Ocupado]  [📨 Caixa de Voz]        │
  │    │  [⏭️ Cancelar registo]                   │
  │    │                                          │
  │    │  Notas rápidas: [________________]       │
  │    │                                          │
  │    │  Agendar follow-up:                      │
  │    │  [☐] Lembrar-me em [▾ 1h/3h/amanhã/3d]  │
  │    │                                          │
  │    │              [Guardar]                    │
  │    └──────────────────────────────────────────┘
  │
  ├─ Registo guardado em temp_call_log
  │
  └─ Se "Não Atendeu" e sem follow-up:
       → Alerta automático: "Ligar novamente a João Silva"
```

### 1.2 Onde aparece o botão de chamada

| Localização | Contexto guardado |
|---|---|
| Detalhe do Lead → telefone | `{ context: 'lead', reference_id: lead.id }` |
| Lista de Leads → ícone telefone | idem |
| Detalhe do Candidato (recrutamento) | `{ context: 'recruitment', reference_id: candidate.id }` |
| Detalhe do Proprietário → telefone | `{ context: 'owner', reference_id: owner.id }` |
| Negócios → interessados → telefone | `{ context: 'negocio', reference_id: negocio.id }` |
| Qualquer número de telefone clicável | `{ context: 'general' }` |

### 1.3 Tabela: `temp_call_log`

```sql
CREATE TABLE temp_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES dev_users(id),  -- quem ligou

  -- Target
  target_name TEXT NOT NULL,
  target_phone TEXT NOT NULL,

  -- Contexto
  context TEXT NOT NULL,  -- 'lead' | 'recruitment' | 'owner' | 'negocio' | 'general'
  reference_id UUID,      -- ID do lead/candidato/proprietário
  reference_type TEXT,     -- tipo para link directo

  -- Resultado
  result TEXT,  -- 'answered' | 'no_answer' | 'busy' | 'voicemail' | 'cancelled'
  duration_seconds INT,   -- estimado (tempo entre saída e retorno à app)
  notes TEXT,

  -- Follow-up
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_at TIMESTAMPTZ,
  follow_up_completed BOOLEAN DEFAULT false,

  -- Channel
  channel TEXT DEFAULT 'phone',  -- 'phone' | 'whatsapp'

  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_log_caller ON temp_call_log(caller_id);
CREATE INDEX idx_call_log_context ON temp_call_log(context, reference_id);
CREATE INDEX idx_call_log_result ON temp_call_log(result);
CREATE INDEX idx_call_log_followup ON temp_call_log(follow_up_scheduled, follow_up_at)
  WHERE follow_up_scheduled = true AND follow_up_completed = false;
```

### 1.4 Componente: `<CallButton>`

Componente reutilizável que substitui todos os links `tel:` na app.

```typescript
// components/shared/call-button.tsx

interface CallButtonProps {
  phone: string
  name: string
  context: 'lead' | 'recruitment' | 'owner' | 'negocio' | 'general'
  referenceId?: string
  variant?: 'icon' | 'button' | 'link'  // como renderizar
  channel?: 'phone' | 'whatsapp'
}
```

**Comportamento:**
1. Ao clicar: regista `initiated_at` na DB via server action
2. Abre `tel:` ou `https://wa.me/`
3. Listener em `document.visibilitychange` — quando `visible` novamente:
   - Calcula duração estimada
   - Mostra popup de resultado
4. Popup submete resultado + notas + follow-up via server action
5. Toast de confirmação

**Detecção de retorno à app:**

```typescript
useEffect(() => {
  if (!pendingCallId) return

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && pendingCallId) {
      // Utilizador voltou à app — mostrar popup
      const duration = Math.round((Date.now() - callStartTime) / 1000)
      setEstimatedDuration(duration)
      setResultDialogOpen(true)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}, [pendingCallId])
```

### 1.5 Alertas de Follow-up

| Condição | Alerta |
|---|---|
| Não atendeu, sem follow-up agendado | "Ligar novamente a [nome] — não atendeu há [X horas/dias]" |
| Follow-up agendado para agora | "Follow-up: Ligar a [nome]" |
| 3+ chamadas sem resposta | "Alerta: [nome] sem resposta após 3 tentativas" |
| Lead sem contacto há >7 dias | "Lead [nome] sem contacto há [X] dias" (já existe no sistema) |

Estes alertas aparecem:
- No dashboard do consultor (secção "Próximas Acções")
- No detalhe do lead (timeline)
- Nas notificações in-app

### 1.6 Registo manual de chamada

Além do fluxo automático (clicar → ligar → popup), o consultor pode registar manualmente uma chamada:
- Botão "Registar Chamada" no detalhe do lead
- Formulário: resultado, notas, follow-up
- Útil quando ligou do telemóvel pessoal sem usar a app

---

## 2. Relatório de Actividade por Consultor

### 2.1 O que agrega (tudo automático, zero input manual)

| Métrica | Fonte | Query |
|---|---|---|
| **Chamadas realizadas** | `temp_call_log` | COUNT WHERE caller_id = X AND período |
| **Chamadas atendidas** | `temp_call_log` | COUNT WHERE result = 'answered' |
| **Taxa de atendimento** | calculado | atendidas / total × 100 |
| **Visitas realizadas** | `temp_visits` | COUNT WHERE consultant_id = X AND status = 'completed' |
| **Visitas agendadas** | `temp_visits` | COUNT WHERE status = 'scheduled' |
| **Leads contactados** | `temp_call_log` + `lead_activities` | COUNT DISTINCT leads com actividade |
| **Leads novos** | `leads` | COUNT WHERE assigned_agent_id = X AND created_at no período |
| **Angariações novas** | `dev_properties` | COUNT WHERE consultant_id = X AND created_at no período |
| **Negócios activos** | `temp_deals` | COUNT WHERE consultant_id = X AND status = 'active' |
| **Deals fechados** | `temp_deals` | COUNT WHERE status = 'completed' AND período |
| **Facturação** | `temp_deals` | SUM commission_total WHERE completed no período |
| **Tarefas concluídas** | `proc_tasks` | COUNT WHERE assigned_to = X AND status = 'completed' AND período |
| **Follow-ups pendentes** | `temp_call_log` | COUNT WHERE follow_up_scheduled AND NOT completed |
| **Tempo médio de resposta** | `leads` | AVG dias entre created_at e first_contacted_at |

### 2.2 Score de Actividade (0-100)

Calculado automaticamente com pesos configuráveis:

| Métrica | Peso | Cálculo |
|---|---|---|
| Chamadas (vs target semanal) | 20 | min(chamadas / target, 1) × 20 |
| Visitas (vs target semanal) | 25 | min(visitas / target, 1) × 25 |
| Leads contactados | 15 | min(contactados / total_leads, 1) × 15 |
| Angariações | 20 | min(angariações / target_mensal, 1) × 20 |
| Tarefas concluídas | 10 | min(concluídas / pendentes, 1) × 10 |
| Follow-ups em dia | 10 | (1 - pendentes_atrasados / total_follow_ups) × 10 |

Targets vêm dos objectivos do consultor (M16 — temp_consultant_goals) ou de defaults configuráveis.

### 2.3 Interface — Relatório

**Localização:** Nova opção nos Relatórios Financeiros (`/dashboard/comissoes/relatorios`) + acesso directo no Dashboard de Gestão.

**Filtros:**
- Consultor (select ou "Todos")
- Período (Esta semana / Este mês / Este trimestre / Custom)

**Vista Individual (1 consultor):**

```
┌──────────────────────────────────────────────────────┐
│  João Silva — Semana 10-16 Mar 2026                  │
│  Score de Actividade: ████████░░ 78/100              │
│  vs Semana anterior: ↑ +5  |  vs Média equipa: +12% │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📞 Chamadas           │  🏠 Visitas                 │
│  Total: 24             │  Realizadas: 5              │
│  Atendidas: 18 (75%)   │  Agendadas: 3              │
│  Não atendeu: 6        │  No-show: 1                │
│                        │                             │
│  📋 Leads              │  🏢 Angariações             │
│  Contactados: 12       │  Novas: 2                  │
│  Novos: 3              │  Total activas: 8          │
│                        │                             │
│  ✍️ Deals              │  📄 Tarefas                 │
│  Activos: 2            │  Concluídas: 7             │
│  Fechados: 1           │  Pendentes: 3              │
│  Facturação: 8.625€    │                             │
│                        │                             │
│  ⏰ Follow-ups         │                             │
│  Pendentes: 4          │                             │
│  Atrasados: 1          │                             │
│                        │                             │
├──────────────────────────────────────────────────────┤
│  Evolução semanal (últimas 8 semanas)                │
│  ██ ██ ███ ██ ████ ███ ████ █████                    │
│  S5 S6 S7  S8 S9   S10 S11  S12                     │
└──────────────────────────────────────────────────────┘
```

**Vista Comparativa (todos os consultores):**

```
┌──────────────────────────────────────────────────────────────────┐
│  Relatório de Actividade — Março 2026                            │
├───────────────┬────────┬────────┬───────┬──────┬──────┬─────────┤
│ Consultor     │Chamadas│Visitas │Leads  │Angar.│Deals │ Score   │
├───────────────┼────────┼────────┼───────┼──────┼──────┼─────────┤
│ João Silva    │   24   │   5    │  12   │  2   │  1   │ 78 ████ │
│ Maria Costa   │   31   │   7    │  15   │  3   │  2   │ 92 █████│
│ Pedro Santos  │   15   │   2    │   8   │  0   │  0   │ 45 ██   │
│ Ana Ferreira  │   22   │   4    │  11   │  1   │  1   │ 71 ████ │
└───────────────┴────────┴────────┴───────┴──────┴──────┴─────────┘
```

### 2.4 Alertas de Produtividade (para o gestor)

| Alerta | Condição | Severidade |
|---|---|---|
| Score baixo | Score < 40 na última semana | Urgente |
| Sem chamadas | 0 chamadas nos últimos 3 dias úteis | Aviso |
| Sem visitas | 0 visitas na última semana | Aviso |
| Muitos no-show | >30% chamadas sem resposta | Info |
| Follow-ups atrasados | >5 follow-ups atrasados | Aviso |

---

## 3. Server Actions

```typescript
// Call tracking
logCallInitiated(data: { caller_id, target_name, target_phone, context, reference_id, channel })
logCallResult(callId: string, data: { result, notes, follow_up_at? })
getCallLog(filters: { caller_id?, context?, reference_id?, result?, date_from?, date_to?, page? })
getPendingFollowUps(userId: string)
completeFollowUp(callId: string)

// Activity report
getActivityReport(consultantId: string, period: 'week' | 'month' | 'quarter', date?: string)
getActivityComparison(period: 'week' | 'month' | 'quarter', date?: string) // all consultants
getActivityScore(consultantId: string, period: string)
getProductivityAlerts()
```

---

## 4. Ficheiros a Criar

| Ficheiro | Descrição |
|----------|-----------|
| `components/shared/call-button.tsx` | Botão de chamada reutilizável com popup resultado |
| `components/shared/call-result-dialog.tsx` | Dialog de resultado da chamada |
| `app/dashboard/comissoes/relatorios/actividade/page.tsx` | Relatório de actividade |
| `app/dashboard/comissoes/relatorios/actividade/actions.ts` | Server actions |
| `types/call-tracking.ts` | Types |

---

## 5. Integração com Módulos Existentes

| Módulo | Integração |
|---|---|
| **Leads (M05)** | CallButton nos telefones, chamadas aparecem na timeline do lead |
| **Recrutamento (M20)** | CallButton nos telefones dos candidatos |
| **Proprietários (M04)** | CallButton nos telefones dos proprietários |
| **Dashboard (M21)** | Score de actividade no dashboard do agente, alertas no dashboard de gestão |
| **Objectivos (M16)** | Chamadas contam como actividade, alimentam o funnel |
| **Calendário (M13)** | Follow-ups aparecem como eventos |
| **Visitas (M22)** | Chamada antes da visita para confirmar |
| **Notificações** | Alertas de follow-up como notificação in-app |
