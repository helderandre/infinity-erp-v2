## Why

Na tela `/dashboard/crm/automatismos-contactos` (tab **Automatismos**), os cards actuais não transmitem se um automatismo está saudável, falhou ou já concluiu. O consultor tem de abrir a tab "Execuções" ou o sheet de detalhe para saber que 3 envios de Natal falharam, ou que o evento "Promoção de 60% (Única vez)" já correu na semana passada. Paralelamente, a tabela "Lead / Evento / Próximo envio / Canais / Estado / Origem" por baixo dos cards duplica informação que já vive (ou deveria viver) em cada card/sheet — polui a página e desvia a atenção da grelha principal.

O objectivo é tornar os cards a **superfície única** de observabilidade por evento: estado de saúde, última execução, falhas por resolver e conclusão de one-shots ficam visíveis sem abrir o sheet.

## What Changes

- **Adicionar sinal de saúde ao card** — dot colorido no canto superior do header (emerald / amber / red / slate) que resume o estado mais relevante das últimas 30 execuções do evento para o consultor actual: `ok` · `failures_unresolved` · `completed_one_shot` · `idle`.
- **Adicionar linha "Últimas execuções" ao card** — com data relativa da última execução (`Último envio: há 2 dias`) e, quando aplicável, contador agregado de sucessos/falhas (`✓ 12 · ✕ 2`). Clicar salta directamente para a tab "Envios feitos" do sheet filtrada em `status=failed` quando há falhas, senão para a tab completa.
- **Badge de falhas não resolvidas** — quando `failed_runs_unresolved > 0` aparece um pill vermelho inline (`⚠ 2 falhas`) que lista os primeiros 2 leads em tooltip (`Maria S., João P., +3`). Clicar abre o sheet directamente na tab "Envios feitos" com filtro "Só falhados" pré-aplicado.
- **Estado "Concluído" para eventos one-shot (`is_recurring=false`)** — quando existe uma execução bem-sucedida (`status='sent'`) para o evento e `is_recurring=false`, o card passa a `status` visual `completed`: badge "Concluído" a verde-acinzentado, dot emerald-slate, sem "Próximo envio", e opacidade ligeiramente reduzida. Substitui o actual "Activo" sem indicação.
- **Remover a tabela geral no fundo da tab** — `<ScheduledTab>` deixa de renderizar a `<Table>` (e respectivos filtros `Todos os eventos` / `Todos os estados`). Os mesmos dados continuam acessíveis via drill-down nos cards (tabs "Quem recebe" e "Envios feitos" do sheet).
- **Novo endpoint `GET /api/automacao/custom-events/health-summary`** — devolve, para o consultor actual (ou para `consultant_id=X` quando broker), uma linha por evento (fixos + custom) com: `{event_key, last_run_at, last_run_status, runs_last_30d: {sent, failed, skipped}, failed_unresolved: [{lead_id, lead_name, error_short, run_id}], completed_one_shot}`. Payload único alimenta toda a grelha (`Cache-Control: private, max-age=30`).
- **Card skeleton actualizado** — skeleton passa a reservar espaço para a linha "últimas execuções" para evitar layout shift quando os dados aterram.
- **Eventos fixos** — os 3 cards fixos (aniversário/Natal/Ano Novo) consomem o mesmo endpoint com `event_key ∈ {aniversario_contacto, natal, ano_novo}` e mostram os mesmos sinais. "Último envio" continua a ser a informação mais útil para recorrências anuais.

## Capabilities

### New Capabilities
- `automation-health-summary`: Endpoint e shape canónica que agrega execuções recentes (30 dias) por `(consultant_id, event_key)` — sucessos, falhas não resolvidas com os leads afectados, e flag `completed_one_shot`. Serve os cards do hub e é extensível a outras superfícies (widget do dashboard, notificações).

### Modified Capabilities
- `contact-automation-hub`: a tab **Agendados** (actualmente chamada "Automatismos" na UI) deixa de renderizar a tabela de rows; substitui-a pela grelha de cards enriquecida. Os filtros `event_type` / `state` que estavam ligados à tabela são removidos ou migrados para a própria grelha se forem úteis.
- `automation-detail-sheet`: a tab "Envios feitos" passa a aceitar `?filter=failed` como estado inicial controlado por prop, para permitir deep-link vinda do badge de falhas do card.

## Impact

**Frontend**
- [components/crm/automations-hub/scheduled-tab.tsx](components/crm/automations-hub/scheduled-tab.tsx) — remover `<Table>` e filtros associados (consultor continua útil); limpar `useScheduled` consumption se nenhuma outra superfície o usa (verificar antes de apagar).
- [components/crm/automations-hub/custom-events/automation-event-card.tsx](components/crm/automations-hub/custom-events/automation-event-card.tsx) — novo header dot, nova linha "Últimas execuções", novo badge "⚠ N falhas", estado "Concluído" para one-shots.
- [components/crm/automations-hub/custom-events/events-cards-grid.tsx](components/crm/automations-hub/custom-events/events-cards-grid.tsx) — consumir novo hook `useAutomationHealth()` e hidratar cada card com `HealthSummary`.
- [components/crm/automations-hub/automation-detail-sheet/automation-detail-sheet.tsx](components/crm/automations-hub/automation-detail-sheet/automation-detail-sheet.tsx) — aceitar prop `initialRunsFilter?: 'all' | 'failed'` e default-aplicar na tab "Envios feitos".

**Backend**
- Novo `app/api/automacao/custom-events/health-summary/route.ts` (GET). Autorização: `auth()` + scope implícito `consultant_id = user.id` a menos que broker com `?consultant_id=X`.
- Query base corre sobre `contact_automation_runs` dos últimos 30 dias agrupada por `COALESCE(custom_event_id::text, event_type)`. Precisa de índice composto já existente `idx_car_consultant_scheduled` — confirmar em migration inspect; se não existir, adicionar `CREATE INDEX IF NOT EXISTS idx_car_consultant_status_created ON contact_automation_runs(consultant_id, status, created_at DESC)`.

**Hooks/Types**
- [types/custom-event.ts](types/custom-event.ts) — adicionar `AutomationHealthSummary` e export no payload de `CustomEventWithCounts` (opcional `health?: AutomationHealthSummary`).
- Novo `hooks/use-automation-health.ts` com cache simples por `consultant_id`.

**DB**
- Nenhuma migration obrigatória. Apenas eventual índice se o plan explain mostrar scan full — decisão deferida à fase de implementação.

**Não afecta**
- Spawner de runs, resolução de templates, mutes, overrides per-lead — lógica de execução fica intacta.
- Tabs "Execuções", "Templates", "Canais de Envio" — continuam como estão.
