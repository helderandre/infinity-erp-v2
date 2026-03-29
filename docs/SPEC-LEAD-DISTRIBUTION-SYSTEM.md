# Spec: Lead Distribution & SLA System

**Data:** 2026-03-28
**Estado:** Implementado (Phase A-C completas)

---

## 1. Visão Geral

Sistema de distribuição automática de leads com rastreamento de SLA, escalonamento e painel de gestora. Leads de qualquer fonte (Meta Ads, Google, website, parceiros, manual) passam por um pipeline unificado de ingestão.

---

## 2. Arquitectura de Dados

### 2.1 Modelo Conceptual: Contacto → Entrada → Negócio

```
CONTACTO (pessoa única, deduplicada por email/telefone)
  ├── ENTRADA 1 (Meta Ads, campanha X, sector: compra)
  │     └── atribuída ao Consultor A
  │     └── SLA: 2h
  │     └── negócio: Compra apartamento → FECHADO
  │
  ├── ENTRADA 2 (Website, sector: crédito)
  │     └── atribuída ao Consultor B
  │     └── SLA: 8h
  │     └── negócio: Intermediação crédito → EM PROGRESSO
  │
  └── ENTRADA 3 (Parceiro referral, sector: venda)
        └── atribuída ao Consultor A
        └── negócio: Venda moradia → QUALIFICADO
```

- **Contacto** = tabela `leads` (a pessoa, única)
- **Entrada** = tabela `leads_entries` (cada evento de aquisição)
- **Negócio** = tabela `negocios` (cada deal, com `entry_id` para atribuição)

### 2.2 Tabelas Novas/Alteradas (Migração 20260328)

| Tabela | Tipo | Descrição |
|--------|------|-----------|
| `leads_entries` (campos novos) | ALTER | `assigned_agent_id`, `sector`, `is_reactivation`, `status`, `priority`, `sla_deadline`, `first_contact_at`, `sla_status` |
| `negocios` (campo novo) | ALTER | `entry_id` — liga negócio à entrada que o originou |
| `leads_campaigns` (campos novos) | ALTER | `sector`, `description` |
| `leads_assignment_rules` (campos novos) | ALTER | `sector_match`, `overflow_threshold`, `fallback_action`, `round_robin_index`, `description` |
| `leads_sla_configs` | CREATE | Configuração de SLA por origem/sector/prioridade |
| `leads_notifications` | CREATE | Notificações in-app para consultores e gestora |
| `leads_campaign_metrics` | CREATE | Snapshot diário de métricas de campanha (Meta API + ERP) |
| `dev_users.active_lead_count` | ALTER | Contador de leads activas por agente (trigger automático) |

---

## 3. Pipeline de Ingestão

**Ficheiro:** `lib/crm/ingest-lead.ts`

```
Lead chega (webhook/cron/manual)
  │
  ├─ 1. Dedup: procura contacto por email/telefone
  │     └─ Se existe → is_reactivation = true
  │     └─ Se não → cria contacto
  │
  ├─ 2. Atribuição: avalia regras por prioridade DESC
  │     └─ Regra match → consultor directo ou round-robin
  │     └─ Overflow → fallback (pool/próximo agente)
  │     └─ Nenhuma regra → pool da gestora
  │
  ├─ 3. SLA: procura config matching → calcula deadline
  │
  ├─ 4. Cria entrada (leads_entries)
  │
  ├─ 5. Log actividades (system + assignment)
  │
  └─ 6. Notificação ao agente atribuído
```

---

## 4. Motor de Atribuição

**Ficheiro:** `lib/crm/assignment-engine.ts`

### Regras (tabela `leads_assignment_rules`)

Cada regra tem:
- **Critérios:** source_match, campaign_id_match, sector_match, zone_match
- **Destino:** consultant_id (directo) ou team_consultant_ids (round-robin)
- **Overflow:** overflow_threshold (max leads não contactadas) + fallback_action
- **Prioridade:** número (maior = avaliada primeiro)

### Lógica de Avaliação

1. Buscar regras activas, ordenadas por prioridade DESC
2. Para cada regra, verificar se todos os critérios correspondem
3. Se match e consultor directo → verificar carga (active_lead_count vs threshold)
4. Se overloaded → aplicar fallback (gestora_pool / round_robin / skip)
5. Se round-robin → rotar entre team_consultant_ids, saltar overloaded
6. Se nenhuma regra match → gestora pool (assigned_agent_id = null)

---

## 5. Sistema de SLA

**Ficheiros:** `lib/crm/sla-engine.ts`, `app/api/cron/check-sla/route.ts`

### Configuração (tabela `leads_sla_configs`)

| Config | Origem | SLA | Warning | Breach | Escalação |
|--------|--------|-----|---------|--------|-----------|
| Meta Urgente | meta_ads + urgent | 30min | 50% | 100% | 150% |
| Meta Normal | meta_ads | 2h | 50% | 100% | 150% |
| Google | google_ads | 4h | 50% | 100% | 150% |
| Website | website, landing_page | 8h | 50% | 100% | 150% |
| Parceiro | partner | 24h | 50% | 100% | 150% |
| Default | * | 24h | 50% | 100% | 150% |

### Cron (cada 5 min)

1. Buscar entradas com sla_status != completed e sla_deadline != null
2. Se já contactado (first_contact_at) → sla_status = completed
3. Calcular % do SLA decorrido
4. `< warning_pct` → on_time
5. `>= warning_pct` → warning + notifica agente
6. `>= critical_pct` → breached + notifica agente + gestora
7. `>= escalate_pct` → escalonamento + notifica gestora

---

## 6. Notificações

**Tabela:** `leads_notifications`
**API:** `GET/PUT /api/crm/notifications`

### Tipos

| Tipo | Quem recebe | Quando |
|------|-------------|--------|
| `new_lead` | Agente atribuído | Lead chega e é atribuída |
| `sla_warning` | Agente | SLA a 50% |
| `sla_breach` | Agente + Gestora | SLA a 100% |
| `sla_escalation` | Gestora | SLA a 150% |
| `assignment` | Agente | Lead reatribuída |

### Integração

O hook `useNotifications` foi estendido para mergear notificações de:
- `notifications` (processos/tarefas)
- `leads_notifications` (CRM/leads)

Ambos com Supabase Realtime para updates em tempo real.

---

## 7. Contacto e Registo de Resultado

**Componente:** `components/crm/contact-action-buttons.tsx`
**Modal:** `components/crm/call-outcome-modal.tsx`
**API:** `POST /api/crm/contacts/[id]/call-outcome`

### Fluxo

1. Agente clica telefone/WhatsApp/email → acção nativa abre
2. Modal aparece: "Resultado do contacto?"
3. Opções: Atendeu / Sem resposta / Ocupado / Voicemail / Não consegui
4. + Notas opcionais
5. Ao submeter:
   - Cria actividade (leads_activities)
   - Se "Atendeu": actualiza first_contact_at em todas as entradas não contactadas
   - Se "Atendeu" e stage = Lead: upgrade para "Contactado"
   - Log no sistema de objectivos

---

## 8. Painel da Gestora

**Página:** `/dashboard/crm/gestora`
**API:** `GET /api/crm/gestora/overview`, `POST /api/crm/gestora/reassign`

### Funcionalidades

- **4 KPIs:** em atraso, sem atribuição, novas hoje, consultores activos
- **Carga por consultor:** leads activas, negócios, badges SLA (em dia/aviso/atraso)
- **Filtro por consultor:** ver só leads de um consultor
- **"Devolver X":** puxa todas as leads em atraso de um consultor para o pool
- **Toggle:** separador "Em Atraso" vs "Pool (sem atribuição)"
- **Selecção em massa:** checkbox → seleccionar consultor destino → reatribuir
- **Contacto directo:** botões tel/whatsapp/email em cada lead

---

## 9. Gestão de Campanhas

**Página:** `/dashboard/crm/campanhas`
**API:** `GET/POST /api/crm/campaigns`, `GET/PUT/DELETE /api/crm/campaigns/[id]`

### Funcionalidades

- Grid de cards com nome, plataforma, estado, sector
- Filtros por plataforma e estado
- Pesquisa por nome
- Dialog de criação/edição com campos:
  - Nome, Plataforma, Estado, Sector
  - ID externo (Meta/Google campaign ID)
  - Orçamento, Datas início/fim, Descrição

---

## 10. Regras de Atribuição

**Página:** `/dashboard/crm/regras`
**API:** `GET/POST /api/crm/assignment-rules`, `PUT/DELETE /api/crm/assignment-rules/[id]`

### Funcionalidades

- Lista ordenada por prioridade
- Badge de prioridade + critérios (origens, campanha, sectores)
- Toggle activa/inactiva por regra
- "Como funciona" — 3 passos explicativos
- Dialog de criação/edição:
  - Nome, Descrição, Prioridade
  - Critérios: origens (multi-select), campanha, sectores (multi-select)
  - Destino: consultor directo ou round-robin
  - Overflow: limite de carga + acção de fallback

---

## 11. Sidebar / Navegação

Secção "CRM" no sidebar inclui:
- Pipeline
- Leads
- Contactos
- Acompanhamentos
- **Gestora de Leads** (permissão: pipeline)
- **Campanhas** (permissão: pipeline)
- **Regras de Atribuição** (permissão: pipeline)

---

## 12. Ficheiros Criados/Modificados

### Backend (Engine)

| Ficheiro | Descrição |
|----------|-----------|
| `lib/crm/ingest-lead.ts` | Pipeline unificado de ingestão |
| `lib/crm/assignment-engine.ts` | Motor de avaliação de regras |
| `lib/crm/sla-engine.ts` | Cálculo de SLA + cron de verificação |

### API Routes

| Rota | Métodos | Descrição |
|------|---------|-----------|
| `/api/webhooks/meta/leads` | GET, POST | Webhook Meta Lead Ads (reescrito) |
| `/api/cron/sync-meta-leads` | GET | Sync periódico Meta (reescrito) |
| `/api/cron/check-sla` | GET | Verificação SLA (novo) |
| `/api/crm/notifications` | GET, PUT | Notificações CRM |
| `/api/crm/gestora/overview` | GET | Dados painel gestora |
| `/api/crm/gestora/reassign` | POST | Reatribuição em massa |
| `/api/crm/campaigns/[id]` | GET, PUT, DELETE | CRUD campanha individual |
| `/api/crm/assignment-rules` | GET, POST | Lista + cria regras |
| `/api/crm/assignment-rules/[id]` | PUT, DELETE | Edita + elimina regras |

### Frontend

| Ficheiro | Descrição |
|----------|-----------|
| `app/dashboard/crm/gestora/page.tsx` | Painel da gestora |
| `app/dashboard/crm/campanhas/page.tsx` | Gestão de campanhas |
| `app/dashboard/crm/regras/page.tsx` | Regras de atribuição |
| `app/dashboard/crm/sla/page.tsx` | Configuração de SLA |
| `app/dashboard/crm/analytics/page.tsx` | Analytics de consultores |
| `components/crm/contact-action-buttons.tsx` | Botões tel/email/whatsapp |
| `components/crm/call-outcome-modal.tsx` | Modal resultado de contacto |

### Types & Validations

| Ficheiro | Alterações |
|----------|------------|
| `types/leads-crm.ts` | +LeadSector, EntryStatus, EntrySlaStatus, NotificationType, LeadsSlaConfig, LeadsNotification, LeadsCampaignMetrics, CampaignWithMetrics |
| `lib/validations/leads-crm.ts` | +createSlaConfigSchema, updateEntrySchema; updated entry/negocio/campaign/rule schemas |

### Migration

| Ficheiro | Descrição |
|----------|-----------|
| `supabase/migrations/20260328_crm_lead_distribution.sql` | entry_id, SLA fields, notifications, campaign metrics, agent counter |

---

## 13. Analytics de Consultores

**Página:** `/dashboard/crm/analytics`
**API:** `GET /api/crm/analytics/agents`

### Métricas por Consultor

| Métrica | Fonte |
|---------|-------|
| Leads recebidas | `leads_entries.assigned_agent_id` |
| Taxa de contacto | `first_contact_at IS NOT NULL / total` |
| Tempo médio de resposta | `first_contact_at - created_at` |
| Tempo mediano de resposta | Mediana das diferenças |
| SLA compliance | `sla_status = completed|on_time / total com SLA` |
| Funil (lead→contacto→qualif→conversão→ganho) | `entries.status` + `negocios.won_date` |
| Negócios ganhos/perdidos | `negocios.won_date/lost_date` |
| Receita | `sum(expected_value) WHERE won_date IS NOT NULL` |
| Actividades por tipo | `leads_activities.activity_type` |
| Leads por origem | `leads_entries.source` |

### Funcionalidades UI

- 8 KPI cards (leads, contactadas, tempo resposta, SLA, ganhos, perdidos, receita, actividades)
- Funil de conversão visual (barras horizontais com percentagens entre etapas)
- Tabela comparativa de consultores (ranking por receita, com indicadores coloridos)
- Detalhe individual com breakdown por origem e tipo de actividade
- Filtro por período (7, 30, 90 dias)
- Toggle entre "Todos" e consultor individual (pill tabs)

---

## 14. Configuração de SLA

**Página:** `/dashboard/crm/sla`
**API:** `GET/POST /api/crm/sla-configs`, `PUT/DELETE /api/crm/sla-configs/[id]`

### Funcionalidades

- Lista de configs por prioridade com badges de origens/prioridades/sectores
- SLA em formato legível (2h, 30min, 24h)
- Indicadores visuais dos 3 thresholds (aviso/violação/escalonação)
- Toggle activa/inactiva
- Dialog de criação/edição com multi-select para origens e prioridades
- "Como funciona" com explicação dos 3 níveis

---

## 15. Navegação Sidebar

Secção CRM completa:
1. Pipeline
2. Leads
3. Contactos
4. Acompanhamentos
5. **Gestora de Leads** (pipeline)
6. **Analytics** (pipeline)
7. **Campanhas** (pipeline)
8. **Regras de Atribuição** (pipeline)
9. **Config. SLA** (pipeline)

---

## 16. Analytics de Campanhas

**Página:** `/dashboard/crm/analytics/campanhas`
**API:** `GET /api/crm/analytics/campaigns`
**Sync:** `GET /api/cron/sync-campaign-metrics` (diário)

### Métricas Combinadas (Meta + ERP)

| Métrica | Fonte | Descrição |
|---------|-------|-----------|
| Investimento | Meta API | Spend total por campanha |
| Impressões | Meta API | Visualizações do anúncio |
| Clicks | Meta API | Cliques no anúncio |
| CTR | Meta API | Click-through rate |
| CPL (plataforma) | Meta API | Custo por lead reportado |
| Leads ERP | leads_entries | Entradas reais no sistema |
| Contactadas | leads_entries | Com first_contact_at |
| Qualificadas | leads_entries | Status qualified/converted |
| Convertidas | leads_entries | Status converted |
| Vendas | negocios | won_date IS NOT NULL |
| Receita | negocios | sum(expected_value) |
| CPQ | Derivado | Spend / Qualificadas |
| CPA | Derivado | Spend / Vendas |
| ROAS | Derivado | Receita / Spend |

### Sync Job

O cron `sync-campaign-metrics` corre diariamente e:
1. Busca insights do Meta Graph API para cada campanha com external_campaign_id
2. Calcula métricas ERP (entries, contacted, qualified, converted, won, revenue)
3. Upsert em `leads_campaign_metrics` (1 row por campanha por dia)
4. Também sincroniza campanhas não-Meta (apenas métricas ERP)

---

## 17. Notificações por Email

**Ficheiro:** `lib/crm/send-notification-email.ts`

Integrado no SLA engine e pipeline de ingestão. Usa o sistema de email existente (Supabase Edge Function + Resend).

| Evento | Email enviado a | Conteúdo |
|--------|-----------------|----------|
| Nova lead | Consultor atribuído | Nome + telefone do contacto + link |
| SLA warning (50%) | Consultor | Aviso de prazo a expirar |
| SLA breach (100%) | Consultor + Gestora | Alerta urgente |
| SLA escalation (150%) | Gestora | Pedido de reatribuição |

Emails são fire-and-forget (não bloqueiam o fluxo principal). O campo `is_email_sent` em `leads_notifications` rastreia o envio.

---

## 18. Cron Jobs (Coolify)

Os cron endpoints são API routes normais protegidas por `CRON_SECRET`. Precisam de ser chamados periodicamente por um scheduler externo.

| Endpoint | Schedule | Descrição |
|----------|----------|-----------|
| `GET /api/cron/sync-meta-leads` | `*/5 * * * *` | Sync leads do Meta Ads |
| `GET /api/cron/check-sla` | `*/5 * * * *` | Verificação de SLAs + notificações/emails |
| `GET /api/cron/sync-campaign-metrics` | `0 6 * * *` | Sync métricas Meta + cálculo ERP |

### Configuração no Coolify

**Opção A — Coolify Scheduled Tasks (recomendado):**

No painel do Coolify, ir a Settings → Scheduled Tasks e adicionar:

```
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/sync-meta-leads
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/check-sla
0 6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/sync-campaign-metrics
```

**Opção B — Crontab do servidor:**

```bash
# Editar crontab
crontab -e

# Adicionar:
*/5 * * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://erp.infinitygroup.pt/api/cron/sync-meta-leads > /dev/null 2>&1
*/5 * * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://erp.infinitygroup.pt/api/cron/check-sla > /dev/null 2>&1
0 6 * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://erp.infinitygroup.pt/api/cron/sync-campaign-metrics > /dev/null 2>&1
```

**Opção C — Supabase pg_cron (mais resiliente):**

Activar extensão `pg_cron` no Supabase e criar jobs que chamam as funções via `net.http_get()`.

---

## 19. Integração de ContactActionButtons

O componente `ContactActionButtons` foi integrado em:
- `components/leads/lead-sidebar.tsx` — substitui os links `tel:`/`mailto:` antigos
- `app/dashboard/crm/gestora/page.tsx` — nas listas de leads

O CRM contact detail (`app/dashboard/crm/contactos/[id]/page.tsx`) já tinha a sua própria implementação de call outcome (`CallOutcomeDialog`).

---

## 20. Navegação entre Analytics

- **Analytics de Consultores** → botão "Ver Analytics de Campanhas" no hero
- **Analytics de Campanhas** → botão "Ver Analytics de Consultores" no hero
- Ambas acessíveis via sidebar (Analytics → Consultores por default)

---

## 21. Portal de Parceiros Externos

**Rota:** `/parceiro` (fora do dashboard, sem sidebar)
**Auth:** Magic link via cookie (não Supabase auth)

### Fluxo

1. No CRM, gestora cria parceiro → `POST /api/crm/partners` gera `magic_link_token`
2. Gestora clica "Enviar link" → `POST /api/crm/partners/[id]/send-link` envia email com link
3. Parceiro clica link → `/parceiro?token=abc123`
4. Token validado → cookie `partner_session` (30 dias)
5. Dashboard mostra referências + formulário de submissão

### Páginas

| Rota | Descrição |
|------|-----------|
| `/parceiro` | Dashboard: summary (total, pendentes, convertidos, taxa conversão), lista de referências com status |
| `/parceiro/nova-lead` | Formulário simples: nome, email, telefone, notas |

### APIs

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/parceiro/validate` | GET | Valida token (URL param ou cookie) |
| `/api/parceiro/referrals` | GET | Lista referências do parceiro (contactos mascarados) |
| `/api/parceiro/submit-lead` | POST | Submete lead via `ingestLead()` com `partner_id` |
| `/api/parceiro/request-reassign` | POST | Parceiro pede reatribuição → notifica gestora |
| `/api/crm/partners/[id]/send-link` | POST | Gera novo token + envia email com magic link |

### Privacidade

- Nomes mascarados: "João Silva" → "João S."
- Sem email/telefone visível
- Parceiro vê: nome mascarado, status, fase do pipeline, datas

### Ficheiros

| Ficheiro | Descrição |
|----------|-----------|
| `app/parceiro/layout.tsx` | Layout mobile-first com validação de sessão |
| `app/parceiro/page.tsx` | Dashboard com summary cards + lista referências |
| `app/parceiro/nova-lead/page.tsx` | Formulário de submissão de lead |
| `lib/crm/partner-session.ts` | Helper para ler cookie de sessão |

---

## 22. Web Push Notifications

**Dependência:** `web-push` (npm)
**Service Worker:** `public/sw.js`

### Arquitectura

```
Utilizador aceita notificações → browser gera PushSubscription
  → POST /api/push/subscribe → guardada em push_subscriptions
  → SLA engine / ingestLead cria notificação
  → lib/crm/send-push.ts envia via web-push
  → browser mostra notificação nativa (mesmo com tab fechada)
```

### Ficheiros

| Ficheiro | Descrição |
|----------|-----------|
| `public/sw.js` | Service Worker — mostra notificação + click handler |
| `hooks/use-push-subscription.ts` | Hook: permissão, subscribe, unsubscribe |
| `components/notifications/push-banner.tsx` | Banner dismissível "Active notificações" |
| `lib/crm/send-push.ts` | Envia push via web-push library |
| `app/api/push/subscribe/route.ts` | POST save / DELETE remove subscription |

### Variáveis de Ambiente

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # Gerar com: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@infinitygroup.pt
```

### Migração

`supabase/migrations/20260329_push_subscriptions.sql` — tabela `push_subscriptions`

---

## 23. Multi-Sector

### O que foi implementado

Os módulos de recrutamento e crédito já existem como sistemas separados. O que foi adicionado é **routing sector-aware** no CRM:

- `sector` field em `leads_entries` e `leads_campaigns` (já existia)
- Filtro por sector na **Gestora de Leads** (dropdown)
- Filtro por sector na **API de Analytics de Agentes** (query param `sector`)
- Assignment rules suportam `sector_match` (já existia)
- SLA configs suportam `sector_match` (já existia)

### Sectores Disponíveis

| Valor | Label |
|-------|-------|
| `real_estate_buy` | Compra |
| `real_estate_sell` | Venda |
| `real_estate_rent` | Arrendamento |
| `recruitment` | Recrutamento |
| `credit` | Crédito |
| `other` | Outro |

### Fluxo para Recrutamento/Crédito

Leads de campanhas de recrutamento/crédito:
1. Campanha criada com `sector: recruitment` ou `sector: credit`
2. Lead chega → `ingestLead()` herda sector da campanha
3. Assignment rule com `sector_match: ['recruitment']` roteia para recrutador
4. SLA config específica para o sector aplica-se
5. No módulo de recrutamento/crédito, o recrutador cria candidato/pedido manualmente

---

## 24. Sistema Completo — Resumo Final

| Componente | Estado |
|------------|--------|
| Pipeline de ingestão | ✅ Completo |
| Motor de atribuição | ✅ Completo |
| SLA engine + cron | ✅ Completo |
| Notificações in-app (bell) | ✅ Completo |
| Notificações email (Resend) | ✅ Completo |
| Notificações push (Web Push) | ✅ Completo |
| Gestora de leads | ✅ Completo |
| Analytics de consultores | ✅ Completo |
| Analytics de campanhas | ✅ Completo |
| Gestão de campanhas | ✅ Completo |
| Regras de atribuição | ✅ Completo |
| Configuração de SLA | ✅ Completo |
| Portal de parceiros | ✅ Completo |
| Multi-sector routing | ✅ Completo |
| Click-to-contact + outcome | ✅ Completo |
