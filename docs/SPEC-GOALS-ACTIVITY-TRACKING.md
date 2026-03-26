# SPEC — Goals Activity Tracking (Verified vs Declared)

## Objectivo

Criar um sistema de registo de actividades para objectivos que distingue entre acções verificadas pelo sistema e acções declaradas manualmente. Visível tanto para consultores como para gestão, com auto-crédito de actividades feitas na app.

---

## Conceitos

### Tipos de Origem (`origin_type`)

| Valor | Label UI | Descrição |
|-------|----------|-----------|
| `system` | No sistema | Acção registada automaticamente pela app (chamada via botão, email enviado, WhatsApp, etc.) |
| `declared` | Adicional | Consultor declara manualmente ("Fiz 5 chamadas do telemóvel pessoal") |

**Framing positivo**: Nunca usar "verificado vs não verificado". Usar "No sistema" vs "Adicional".

### Direcção (`direction`)

| Valor | Label |
|-------|-------|
| `outbound` | Enviada |
| `inbound` | Recebida |

Ambas as direcções contam para os objectivos.

---

## Data Model Changes

### ALTER `temp_goal_activity_log`

```sql
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'system'
    CHECK (origin_type IN ('system', 'declared'));
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS direction TEXT
    CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;
```

O campo `quantity` permite declarações em bloco ("5 chamadas esta semana") como uma única row com `quantity = 5`, em vez de 5 rows individuais.

---

## Feature 1: Auto-Crédito de Actividades do Sistema

Quando uma acção acontece na app, o goal log é criado automaticamente com `origin_type = 'system'`.

### Triggers de Auto-Crédito

| Acção na App | activity_type | origin | Trigger |
|-------------|---------------|--------|---------|
| Chamada via botão "Ligar" → outcome dialog | `call` | Determinado pelo negócio associado | `POST /api/crm/contacts/[id]/call-outcome` (já implementado) |
| WhatsApp enviado via app | `lead_contact` | Determinado pelo negócio | Ao enviar mensagem WhatsApp |
| Email enviado via app | `lead_contact` | Determinado pelo negócio | Ao enviar email |
| Visita registada | `visit` | Determinado pelo negócio | Ao criar actividade tipo `visit` |
| Lead qualificado (stage change) | `buyer_qualify` ou `lead_contact` | Determinado pelo pipeline | Ao mover no pipeline |
| Angariação submetida | `listing` | `sellers` | Ao criar `proc_instances` tipo angariação |
| Negócio fechado (venda) | `sale_close` | `sellers` | Ao fechar deal tipo venda |
| Negócio fechado (compra) | `buyer_close` | `buyers` | Ao fechar deal tipo compra |

### Determinação do `origin` (sellers vs buyers)

Quando a actividade está associada a um negócio (`leads_negocios`), usar o `pipeline_type`:
- `vendedor` ou `arrendador` → `origin = 'sellers'`
- `comprador` ou `arrendatario` → `origin = 'buyers'`

Se não há negócio associado, default para `'sellers'`.

---

## Feature 2: Declaração Manual em Bloco

### UI: Botão "Registar Actividades" no Dashboard de Objectivos

Abre um dialog com:

```
┌────────────────────────────────────────────┐
│  Registar Actividades Adicionais           │
│────────────────────────────────────────────│
│                                            │
│  Tipo de Actividade                        │
│  [Chamadas ▼]                              │
│                                            │
│  Quantidade                                │
│  [5]                                       │
│                                            │
│  Período                                   │
│  [Esta semana ▼]  ou  Data: [____]         │
│                                            │
│  Direcção                                  │
│  [Enviadas] [Recebidas] [Ambas]            │
│                                            │
│  Notas (opcional)                          │
│  [Chamadas do telemóvel pessoal...]        │
│                                            │
│              [Registar]                    │
└────────────────────────────────────────────┘
```

### Tipos Declaráveis

| Tipo | Label PT |
|------|----------|
| `call` | Chamadas |
| `visit` | Visitas |
| `follow_up` | Acompanhamentos |
| `lead_contact` | Contactos com leads |

**Não declaráveis** (só sistema): `listing`, `sale_close`, `buyer_close`, `buyer_qualify`

### Períodos Pré-definidos

| Valor | Label |
|-------|-------|
| `today` | Hoje |
| `yesterday` | Ontem |
| `this_week` | Esta semana (Seg–Sex) |
| `last_week` | Semana passada |
| `custom` | Data específica |

Para `this_week` e `last_week`, a `activity_date` é definida como a segunda-feira dessa semana.

---

## Feature 3: Dashboard de Objectivos — Breakdown

### KPI Card Redesign

Cada card de objectivo mostra:

```
┌──────────────────────────────────┐
│  📞 Chamadas          15 / 20   │
│  ████████████░░░░░░░░  75%      │
│                                  │
│  11 no sistema · 4 adicionais   │
│  ↗ 8 enviadas · ↙ 7 recebidas  │
└──────────────────────────────────┘
```

A barra de progresso pode ter **duas cores**:
- Secção escura: actividades no sistema
- Secção mais clara: actividades adicionais

### Breakdown API

`GET /api/goals/[id]/summary`

```json
{
  "activities": {
    "call": {
      "total": 15,
      "system": 11,
      "declared": 4,
      "outbound": 8,
      "inbound": 7,
      "target": 20
    },
    "visit": {
      "total": 3,
      "system": 3,
      "declared": 0,
      "target": 5
    }
  },
  "trust_ratio": 0.73,
  "streak_weeks": 4
}
```

---

## Feature 4: Discrepancy Alerts

### Regra

Se num período mensal:
- `declared / total > 0.7` (mais de 70% das actividades são declaradas)
- E `total > 10` (mínimo de actividades para ser relevante)

→ Gerar alerta visível no dashboard do Team Leader.

### Alerta UI

```
⚠️ António Sousa — 18 de 22 chamadas em Março são adicionais (82%)
   Apenas 4 chamadas registadas no sistema
```

Não acusatório — simplesmente informativo. O TL decide se actua.

### Implementação

Query simples no dashboard do TL, não precisa de tabela separada:
```sql
SELECT consultant_id, activity_type,
  COUNT(*) FILTER (WHERE origin_type = 'system') as system_count,
  COUNT(*) FILTER (WHERE origin_type = 'declared') as declared_count,
  SUM(quantity) as total_quantity
FROM temp_goal_activity_log
WHERE activity_date >= date_trunc('month', CURRENT_DATE)
GROUP BY consultant_id, activity_type
HAVING COUNT(*) FILTER (WHERE origin_type = 'declared') * 1.0 / GREATEST(COUNT(*), 1) > 0.7
  AND COUNT(*) > 10
```

---

## Feature 5: Trust Score

### Cálculo

```
trust_score = system_activities / total_activities (rolling 30 dias)
```

| Score | Label | Cor |
|-------|-------|-----|
| ≥ 0.8 | Excelente | Verde |
| 0.6–0.8 | Bom | Azul |
| 0.4–0.6 | Moderado | Amarelo |
| < 0.4 | Baixo | Vermelho |

### Onde Mostrar

- **Perfil do consultor** (tab de desempenho/objectivos) — visível a todos
- **Dashboard do TL** — visível ao team leader
- **Dashboard geral** (admin) — overview de toda a equipa

### Implementação

Calculado on-the-fly, não precisa de coluna. Pode ser cacheado em `dev_consultant_private_data` se a performance exigir.

---

## Feature 6: Streaks

### Definição

Um streak conta semanas consecutivas em que o consultor atingiu **pelo menos 80%** de um objectivo semanal.

### Cálculo

Para cada semana (Seg–Dom):
1. Somar `quantity` de todas as actividades do tipo
2. Comparar com o target semanal (target mensal / 4.33)
3. Se ≥ 80% → semana contada
4. Streak = número de semanas consecutivas (da mais recente para trás)

### UI

Na página de objectivos do consultor:
```
🔥 4 semanas consecutivas a atingir chamadas
```

Quando o streak é ≥ 4 semanas, mostrar com destaque (badge animado ou cor especial).

---

## Feature 7: Call Outcome Dialog — Direcção

### Alteração ao Dialog Existente

Adicionar toggle de direcção **antes** dos botões de resultado:

```
┌──────────────────────────────────────┐
│  Como correu a chamada?              │
│  João Silva · 912 345 678            │
│──────────────────────────────────────│
│                                      │
│  Direcção                            │
│  [↗ Enviada]  [↙ Recebida]          │
│                                      │
│  Notas (opcional)                    │
│  [_________________________________]│
│                                      │
│  [✅ Atendeu               ]         │
│  [📵 Sem resposta] [⏳ Ocupado]      │
│  [📧 Voicemail]   [❌ Não atendeu]   │
└──────────────────────────────────────┘
```

Default: `outbound` (pois o consultor iniciou a chamada).

---

## Ficheiros a Criar/Modificar

### Novos

| Ficheiro | Descrição |
|----------|-----------|
| `app/api/goals/[id]/declare-activities/route.ts` | POST — declaração manual em bloco |
| `app/api/goals/[id]/summary/route.ts` | GET — breakdown com system/declared/direction |
| `components/goals/declare-activities-dialog.tsx` | Dialog para declaração manual |
| `components/goals/goal-activity-breakdown.tsx` | KPI card com breakdown visual |

### Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `app/api/crm/contacts/[id]/call-outcome/route.ts` | Adicionar `direction` ao goal log |
| `components/crm/call-outcome-dialog.tsx` | Adicionar toggle de direcção |
| `app/api/crm/contacts/[id]/activities/route.ts` | Auto-credit goals on activity creation |
| Dashboard de objectivos (página existente) | Integrar breakdown cards + declare button |

### Migração

```sql
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'system'
    CHECK (origin_type IN ('system', 'declared'));
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS direction TEXT
    CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;
```

---

## Ordem de Implementação

1. **Migração** — adicionar colunas ao `temp_goal_activity_log`
2. **Call outcome dialog** — adicionar toggle de direcção + passar direction ao API
3. **Auto-crédito** — garantir que todas as acções do sistema criam goal entries
4. **Declaração manual** — dialog + API para bulk declaration
5. **Summary API** — breakdown por tipo, origin, direction
6. **Dashboard cards** — visual breakdown com barra dual-color
7. **Discrepancy alerts** — query + UI no dashboard do TL
8. **Trust score** — cálculo + display no perfil
9. **Streaks** — cálculo + display na página de objectivos
