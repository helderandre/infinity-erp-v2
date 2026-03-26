# SPEC — CRM Leads System

**Data:** 2026-03-25
**Prefixo tabelas:** `leads_*`
**Estado:** Schema criado, a aguardar implementacao de UI e APIs

---

## 1. Modelo Conceptual

```
leads_contacts (pessoa unica, deduplicada por phone/email/NIF)
  |
  |-- lifecycle_stage_id --> leads_contact_stages (Lead -> Pot. Cliente -> Cliente -> Recorrente -> Inactivo)
  |-- tags[] (segmentacao para campanhas)
  |
  |-- leads_entries[] (cada evento de entrada: formulario, chamada, parceiro)
  |     |-- campaign_id --> leads_campaigns
  |     |-- partner_id --> leads_partners
  |     |-- UTMs, form_data, source
  |
  |-- leads_negocios[] (cada negocio, com pipeline proprio)
  |     |-- pipeline_type: comprador | vendedor | arrendatario | arrendador
  |     |-- pipeline_stage_id --> leads_pipeline_stages
  |     |-- stage_entered_at (para SLA tracking)
  |     |-- expected_value, probability_pct (para forecast)
  |     |-- details (JSONB, campos dinamicos por tipo)
  |     |
  |     |-- leads_negocio_stage_history[] (tempo em cada fase)
  |
  |-- leads_activities[] (timeline 360: calls, emails, whatsapp, notes, visits)
  |
  |-- leads_referrals[] (referencias internas + de parceiros)
        |-- internal: from_consultant -> to_consultant
        |-- partner_inbound: partner_id -> leads_partners

leads_pipeline_stages (fases configuraveis por pipeline_type)
leads_contact_stages (fases de lifecycle configuraveis)
leads_partners (parceiros externos com portal magic link)
leads_campaigns (tracking Meta/Google/organic)
leads_tags (tags predefinidas para segmentacao)
leads_assignment_rules (regras de auto-atribuicao)
```

---

## 2. Principios-Chave

### Contacto vs Entrada
- **Contacto** = pessoa unica. Recebe mensagens, tem lifecycle, tags.
- **Entrada** = cada formulario preenchido, campanha respondida, referencia recebida. Muitas entradas -> 1 contacto.
- Deduplicacao: ao receber nova entrada, procurar contacto por phone -> email -> NIF. Se encontrar, ligar. Se nao, criar.
- Automacoes target o **contacto**, nunca a entrada (evita 3 mensagens para 3 formularios).

### Pipeline nos Negocios (nao no Contacto)
- Mesma pessoa pode ter negocio de compra E venda simultaneos.
- Cada negocio tem pipeline_type + pipeline_stage proprios.
- Converter comprador em vendedor = criar novo negocio, nao mover entre pipelines.
- Kanban mostra negocios filtrados por pipeline_type.

### Lifecycle do Contacto (separado dos pipelines)
- Lead -> Potencial Cliente -> Cliente -> Cliente Recorrente -> Inactivo
- Usado para **segmentacao e campanhas**, nao para operacoes de venda.
- Exemplos: "Potenciais clientes sem actividade em 14 dias", "Clientes com 2+ negocios fechados"
- Actualizacao pode ser manual ou automatica (trigger quando negocio fecha).

### 4 Pipelines
| Pipeline       | Fases (seed)  | Terminal Won         | Terminal Lost |
|---------------|---------------|---------------------|---------------|
| Comprador     | 10 + won/lost | Fechado             | Perdido       |
| Vendedor      | 8 + won/lost  | Vendido             | Perdido       |
| Arrendatario  | 8 + won/lost  | Contrato Assinado   | Perdido       |
| Arrendador    | 8 + won/lost  | Arrendado           | Perdido       |

Fases sao **configuraveis no DB** (leads_pipeline_stages).

---

## 3. Tabelas Criadas

| Tabela                        | Descricao                                           |
|-------------------------------|-----------------------------------------------------|
| leads_contact_stages          | Fases do lifecycle do contacto (configuraveis)       |
| leads_contacts                | Pessoa unica (deduplicada)                           |
| leads_campaigns               | Campanhas Meta/Google/organic                        |
| leads_partners                | Parceiros externos (portal magic link)               |
| leads_entries                 | Eventos de entrada (forms, chamadas, referencias)    |
| leads_pipeline_stages         | Fases dos pipelines (configuraveis por tipo)         |
| leads_negocios                | Negocios com posicao no pipeline                     |
| leads_negocio_stage_history   | Historico de tempo em cada fase                      |
| leads_activities              | Timeline 360 unificada                               |
| leads_referrals               | Referencias internas + parceiros                     |
| leads_tags                    | Tags predefinidas para segmentacao                   |
| leads_assignment_rules        | Regras de auto-atribuicao de leads                   |

---

## 4. Triggers Automaticos

| Trigger                              | Tabela          | Accao                                              |
|--------------------------------------|-----------------|-----------------------------------------------------|
| trg_leads_contacts_default_lifecycle | leads_contacts  | Define lifecycle_stage_id default ao inserir         |
| trg_leads_contacts_updated           | leads_contacts  | Actualiza updated_at                                 |
| trg_leads_negocios_stage_change      | leads_negocios  | Regista historico de fase + actualiza stage_entered_at|
| trg_leads_negocios_init_history      | leads_negocios  | Cria entrada inicial no historico de fases           |
| trg_leads_negocios_updated           | leads_negocios  | Actualiza updated_at                                 |
| trg_leads_campaigns_updated          | leads_campaigns | Actualiza updated_at                                 |
| trg_leads_partners_updated           | leads_partners  | Actualiza updated_at                                 |
| trg_leads_referrals_updated          | leads_referrals | Actualiza updated_at                                 |

---

## 5. Referencias (Internal + Partner Inbound)

### Internas (consultor -> consultor)
- from_consultant envia lead para to_consultant
- from_consultant mantem visibilidade read-only (ve fase, nao pode editar)
- Rankings: volume enviado, volume recebido, taxa de conversao

### Partner Inbound (parceiro externo envia lead)
- Parceiro tem portal com magic link
- Ve apenas as suas leads referenciadas + fase actual
- Recebe Flash Report semanal por email (Resend)

---

## 6. Auto-Atribuicao (leads_assignment_rules)

Quando entra lead sem assigned_consultant_id:
1. Avaliar regras por prioridade (DESC)
2. Fazer match: source, campaign, zone, pipeline_type
3. Se regra tem consultant_id fixo -> atribuir
4. Se regra tem team_consultant_ids -> round-robin pelo consultor com menos negocios activos
5. Se nenhuma regra match -> deixar sem atribuicao (alerta para gestao)

---

## 7. Webhook de Entrada (POST /api/webhooks/leads)

Fluxo:
1. Receber payload (validar com webhookLeadSchema)
2. Deduplicar contacto (phone -> email)
3. Criar/actualizar leads_contacts
4. Criar leads_entries com UTMs, campaign, source
5. Se pipeline_type indicado -> criar leads_negocios na fase "Lead Recebida"
6. Executar auto-atribuicao
7. Registar actividade "system" na timeline
8. Disparar automacao de boas-vindas (se configurada)

---

## 8. Dashboard e Forecast

### Metricas de Funil
- Por pipeline_type: contagem por fase, valor por fase, taxa de conversao entre fases
- Tempo medio por fase (via leads_negocio_stage_history)
- SLA overdue: negocios que excedem sla_days da fase actual

### Forecast Ponderado
- weighted_value = expected_value * (probability_pct ?? stage.probability_pct) / 100
- Agrupado por fase, por consultor, por periodo

### Previsto vs Realizado
- Comparar forecast de periodos anteriores com negocios efectivamente fechados (won_date)

---

## 9. Portal de Parceiros

- URL: /portal/parceiros?token=<magic_link_token>
- Mostra apenas leads referenciadas pelo parceiro
- Informacao visivel: nome do contacto, fase actual (sem detalhes internos), data
- Flash Report semanal automatico via email (Resend MCP)

---

## 10. Ficheiros Criados

| Ficheiro                                              | Descricao                     |
|-------------------------------------------------------|-------------------------------|
| supabase/migrations/20260325_leads_crm_system.sql     | Migracao SQL completa          |
| types/leads-crm.ts                                    | TypeScript types               |
| lib/validations/leads-crm.ts                          | Zod validation schemas         |
| lib/constants-leads-crm.ts                            | Constantes e labels PT-PT      |
| docs/SPEC-CRM-LEADS.md                               | Esta especificacao             |

---

## 11. Proximos Passos (Implementacao)

### Fase A — Fundacao (DB + Kanban)
- [ ] Executar migracao SQL no Supabase
- [ ] API: CRUD leads_contacts (com deduplicacao)
- [ ] API: CRUD leads_negocios (com pipeline)
- [ ] API: GET leads_pipeline_stages por tipo
- [ ] UI: Kanban board com drag-and-drop (por pipeline_type)
- [ ] UI: Detalhe de contacto com tabs (Dados, Entradas, Negocios, Timeline, Referencias)

### Fase B — Entrada de Leads
- [ ] API: POST /api/webhooks/leads (webhook entrada)
- [ ] API: Auto-atribuicao engine
- [ ] API: CRUD leads_campaigns
- [ ] UI: Configuracao de campanhas
- [ ] UI: Configuracao de regras de atribuicao

### Fase C — Comunicacao + 360
- [ ] UI: Timeline de actividades (componente)
- [ ] API: CRUD leads_activities
- [ ] Click-to-call/WhatsApp/email no detalhe do contacto
- [ ] Templates de automacao pre-definidos (boas-vindas, follow-up, reactivacao)

### Fase D — Referencias + Forecast
- [ ] API: CRUD leads_referrals
- [ ] UI: Sistema de referencias (criar, acompanhar, read-only)
- [ ] API: Dashboard metricas de funil
- [ ] API: Forecast ponderado
- [ ] UI: Dashboard com graficos

### Fase E — Portal de Parceiros
- [ ] API: CRUD leads_partners
- [ ] API: Magic link generation + validation
- [ ] UI: Portal de parceiros (/portal/parceiros)
- [ ] Automacao: Flash Report semanal (Resend)
