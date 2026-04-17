## 1. Base de Dados

- [x] 1.1 Criar migração SQL: tabela `custom_commemorative_events` com todas as colunas (id, consultant_id, name, description, event_date, send_hour, is_recurring, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, status, last_triggered_year, created_at, updated_at) + trigger updated_at
- [x] 1.2 Criar migração SQL: tabela `custom_event_leads` (event_id, lead_id, added_at) com PK composta e ON DELETE CASCADE
- [x] 1.3 Adicionar coluna nullable `custom_event_id UUID REFERENCES custom_commemorative_events(id)` à tabela `contact_automation_runs`
- [x] 1.4 Criar índices: `custom_commemorative_events(consultant_id, status)`, `custom_event_leads(lead_id)`, `contact_automation_runs(custom_event_id)`
- [x] 1.5 Criar trigger PostgreSQL `AFTER INSERT OR UPDATE OF agent_id ON leads` que insere o lead nos `custom_commemorative_events` do consultor onde `status = 'active'` e (`is_recurring = true` OR evento único ainda não disparado). Usar `INSERT INTO custom_event_leads ... ON CONFLICT DO NOTHING`

## 2. API — CRUD de Eventos

- [x] 2.1 Criar endpoint `GET /api/automacao/custom-events` — listar eventos do consultor autenticado com contagem de leads e último envio
- [x] 2.2 Criar endpoint `POST /api/automacao/custom-events` — criar evento com validação Zod (nome, data, hora 0-23, recorrência, canais, template IDs opcionais)
- [x] 2.3 Criar endpoint `GET /api/automacao/custom-events/[id]` — detalhe do evento com leads associados e histórico de runs
- [x] 2.4 Criar endpoint `PUT /api/automacao/custom-events/[id]` — editar evento (nome, data, hora, recorrência, canais, templates, status)
- [x] 2.5 Criar endpoint `DELETE /api/automacao/custom-events/[id]` — eliminar evento (cascade leads)

## 3. API — Gestão de Contactos do Evento

- [x] 3.1 Criar endpoint `GET /api/automacao/custom-events/[id]/leads` — listar leads associados ao evento com paginação
- [x] 3.2 Criar endpoint `POST /api/automacao/custom-events/[id]/leads` — adicionar leads ao evento (array de lead_ids ou flag `all=true`)
- [x] 3.3 Criar endpoint `DELETE /api/automacao/custom-events/[id]/leads` — remover leads do evento (array de lead_ids)
- [x] 3.4 Criar endpoint auxiliar `GET /api/automacao/custom-events/eligible-leads` — listar leads do consultor com filtros (estado, nome, origem) para a UI de selecção

## 4. Integração com Spawner

- [x] 4.1 Adicionar fase C ao cron `POST /api/automacao/scheduler/spawn-runs`: iterar `custom_commemorative_events` activos onde mês/dia de `event_date` = hoje e `last_triggered_year != ano_actual`
- [x] 4.2 Para cada evento, gerar runs em `contact_automation_runs` com `kind='custom_event'`, `custom_event_id`, `scheduled_for` = data actual + send_hour, para cada lead em `custom_event_leads`
- [x] 4.3 Respeitar mutes existentes via `is-muted.ts` antes de criar cada run
- [x] 4.4 Após spawn, actualizar `last_triggered_year` do evento; se `is_recurring=false`, marcar `status='archived'`
- [x] 4.5 Garantir que retry de runs (`spawn-retry.ts`) funciona com `kind='custom_event'` — resolver evento e template a partir de `custom_event_id`

## 5. Validações Zod e Types

- [x] 5.1 Criar schema Zod `customEventSchema` em `lib/validations/custom-event.ts` (nome min 2 chars, data ISO, hora 0-23, canais array non-empty, etc.)
- [x] 5.2 Criar types TypeScript `CustomEvent`, `CustomEventWithLeads`, `CustomEventFormData` em `types/custom-event.ts`

## 6. UI — Cards de Automatismos

- [x] 6.1 Redesenhar tab "Automatismos" no hub CRM para mostrar cards visuais — um card por evento (3 fixos + personalizados do consultor)
- [x] 6.2 Criar componente `<AutomationEventCard>` com: nome, ícone/cor, data, canais (badges), nº contactos, estado (activo/pausado/arquivado)
- [x] 6.3 Ao clicar no card, abrir painel de detalhe com: lista de contactos do evento, acções (desactivar, editar template), link para execuções
- [x] 6.4 Botão "+ Nova Data" que abre o wizard de criação
- [x] 6.5 Implementar acções inline nos cards personalizados: pausar/reactivar (toggle status), eliminar (com AlertDialog)

## 7. UI — Wizard de Criação/Edição

- [x] 7.1 Criar componente `<CustomEventWizard>` com 3 passos (Dados, Contactos, Templates)
- [x] 7.2 Passo 1 — Dados do Evento: campos nome, descrição (opcional), date picker para data, select hora (0-23), toggle recorrência, checkboxes canais
- [x] 7.3 Passo 2 — Selecção de Contactos: componente `<LeadMultiSelect>` com tabela paginada, checkbox por linha, "Seleccionar todos", pesquisa por nome, filtro por estado
- [x] 7.4 Passo 3 — Templates: select de template de email existente + botão "Criar novo"; select de template WPP existente + botão "Criar novo"; preview do template seleccionado
- [x] 7.5 Implementar submissão do wizard: POST evento + POST leads associados + toast de sucesso

## 8. UI — Detalhe e Histórico

- [x] 8.1 Criar página ou dialog de detalhe do evento com dados, lista de contactos e histórico de runs
- [x] 8.2 Componente `<CustomEventRunHistory>` com tabela: contacto, canal, estado, data envio, conta de email/instância WPP usada, acção retry
- [x] 8.3 Implementar retry de run falhado via API existente `/api/automacao/runs/[id]/retry`

## 9. Hooks e Estado

- [x] 9.1 Criar hook `useCustomEvents()` — listagem com refetch
- [x] 9.2 Criar hook `useCustomEvent(id)` — detalhe + runs
- [x] 9.3 Criar hook `useEligibleLeads()` — lista de leads elegíveis com filtros e paginação para o wizard
