## Context

A tab "Automatismos" em `/dashboard/crm/automatismos-contactos` é a principal superfície de configuração e observabilidade de automatismos de contacto. Hoje, [scheduled-tab.tsx](components/crm/automations-hub/scheduled-tab.tsx) compõe três blocos verticais:

1. Uma grelha de [AutomationEventCard](components/crm/automations-hub/custom-events/automation-event-card.tsx) alimentada por `useCustomEvents()` (nome, data/hora, lead_count, `last_sent_at` cru, canais, recurrence).
2. O wizard de criação de eventos custom.
3. Uma **tabela de rows** `useScheduled()` com filtros por evento/estado, ligada ao endpoint `GET /api/crm/contact-automations-scheduled`.

O problema: (a) a tabela replica informação que já pertence aos cards; (b) os cards não comunicam saúde — não se vê que 3 envios de Natal falharam ontem, nem que a Promoção de 60% já correu com sucesso e "concluiu".

Os dados de saúde já existem em `contact_automation_runs` (colunas: `kind ∈ {manual,virtual,custom_event}`, `status`, `sent_at`, `error`, `skip_reason`, `scheduled_for`, `lead_id`, `event_type`, `custom_event_id`). Não há coluna `consultant_id` directa — o scoping faz-se por joins: `lead_id → leads.agent_id` para virtuais, `contact_automation_id → contact_automations.consultant_id` para manuais, `custom_event_id → custom_commemorative_events.consultant_id` para custom. Isto já é feito por [/api/crm/contact-automations-scheduled](app/api/crm/contact-automations-scheduled/route.ts) e pelo detalhe do sheet; é a mesma receita.

O `AutomationDetailSheet` já tem uma tab "Envios feitos" com timeline agrupada por dia, filtro chip `Só falhados` e retry inline — **o caminho de drill-down já existe e funciona**. O gap é apenas nos cards.

## Goals / Non-Goals

**Goals:**
- Cada card comunica em < 1 segundo: **estado de saúde**, **última execução**, **falhas por resolver** e **conclusão de one-shots** — sem abrir o sheet.
- Drill-down rápido: um clique no badge de falhas abre o sheet na tab "Envios feitos" com filtro `failed` aplicado.
- Remover a tabela redundante por baixo da grelha sem perder capacidade de análise (o sheet cobre o drill-down; a tab "Execuções" continua a existir para o filtro cross-event).
- Payload único alimenta toda a grelha (1 request, cache curto), sem N+1.
- Zero migrations obrigatórias — reutilizar schema existente.

**Non-Goals:**
- Redesenhar o `AutomationDetailSheet` (já foi feito em `redesign-automation-detail-as-sheet`). Apenas adiciona-se prop `initialRunsFilter`.
- Criar notificações push/email quando uma automação falha — fica para uma change futura ("notify consultant on automation failures").
- Adicionar gráficos/timelines no card — o card é um resumo de saúde; drill-down é no sheet.
- Reabrir decisão sobre a tabela em "Execuções" (tab irmã) — continua como está.

## Decisions

### 1. Um único endpoint dedicado em vez de alargar `use-custom-events`

**Decisão:** criar `GET /api/automacao/custom-events/health-summary` separado em vez de inflacionar o payload de `GET /api/automacao/custom-events` (consumido pelo hook `useCustomEvents`).

**Porquê:**
- `useCustomEvents` alimenta múltiplas superfícies (sheet, wizard, selectores). Agregar runs custa O(runs_last_30d) e seria desperdiçado onde só o CRUD interessa.
- Separa cache (`Cache-Control: private, max-age=30` para saúde; o CRUD mantém a sua política).
- Eventos fixos não têm linha em `custom_commemorative_events` — teriam de ser injectados à parte de qualquer forma. Um endpoint dedicado assume esta composição como responsabilidade sua.

**Alternativa rejeitada:** estender `/api/automacao/custom-events` com `?include_health=1`. Piora o custo do caminho quente (dropdown do wizard) e não resolve o problema dos fixos.

### 2. Shape do payload: linha por `event_key`, não por run

**Decisão:** o endpoint devolve um array de `HealthSummary` onde `event_key` é `aniversario_contacto | natal | ano_novo | custom:<uuid>`. Cada linha agrega 30 dias de runs e inclui **até 5** leads com falha não resolvida (`failed_unresolved`) com `lead_name`, `error_short` (primeiros 80 chars), `run_id`.

```ts
type HealthSummary = {
  event_key: string              // "aniversario_contacto" | "natal" | "ano_novo" | "custom:<uuid>"
  last_run_at: string | null
  last_run_status: "sent" | "failed" | "skipped" | "pending" | null
  runs_last_30d: { sent: number; failed: number; skipped: number; pending: number }
  failed_unresolved: Array<{ run_id: string; lead_id: string; lead_name: string | null; error_short: string | null }>
  failed_unresolved_count: number   // pode ser > 5 se truncado
  completed_one_shot: boolean       // true se is_recurring=false E existe ≥1 sent
}
```

**Porquê `failed_unresolved` em vez de `failed_count`:**
- O tooltip do badge mostra os primeiros leads afectados. Ter 5 leads + um contador total cobre 95% dos casos; > 5 mostra `+N`.
- Se só devolvêssemos contador, teríamos um segundo request ao abrir o tooltip — latência pior.

**Definição de "unresolved":** run com `status='failed'` cuja `(lead_id, event_key)` não tem nenhum run posterior com `status='sent'`. Computado em SQL via NOT EXISTS subquery. Isto evita marcar como "falha pendente" um run antigo que já foi retry-ado com sucesso.

### 3. Consultant scoping via CASE + join, num único SELECT

**Decisão:** uma query SQL no endpoint, com `CASE` discriminando por `kind` para resolver `consultant_id`:

```sql
WITH recent_runs AS (
  SELECT
    r.id, r.status, r.sent_at, r.scheduled_for, r.error, r.lead_id, r.event_type, r.custom_event_id,
    CASE r.kind
      WHEN 'manual'       THEN ca.consultant_id
      WHEN 'virtual'      THEN l.agent_id
      WHEN 'custom_event' THEN ce.consultant_id
    END AS consultant_id,
    COALESCE('custom:' || r.custom_event_id::text, r.event_type) AS event_key
  FROM contact_automation_runs r
  LEFT JOIN contact_automations ca ON ca.id = r.contact_automation_id
  LEFT JOIN leads l                ON l.id = r.lead_id
  LEFT JOIN custom_commemorative_events ce ON ce.id = r.custom_event_id
  WHERE r.created_at > now() - interval '30 days'
)
SELECT event_key,
       max(sent_at)   FILTER (WHERE status='sent')   AS last_sent_at,
       count(*)       FILTER (WHERE status='sent')   AS sent_30d,
       count(*)       FILTER (WHERE status='failed') AS failed_30d,
       ...
FROM recent_runs
WHERE consultant_id = $1
GROUP BY event_key;
```

Uma segunda query (ou LATERAL) busca os até 5 leads com `failed_unresolved` por `event_key`. Manter < 2 round-trips ao postgres por request.

**Porquê não tentar fazer tudo numa view materializada:** 30 dias de runs para N consultores é barato (a tabela não é grande — crescerá linearmente mas continua < 10k rows/mês). Uma MV adicionaria complexidade de refresh. Reavaliar se o EXPLAIN mostrar scan > 50ms.

### 4. Remover a tabela; manter filtro de consultor

**Decisão:** apagar o bloco `<Table>...<TableBody>` e os selectores `Todos os eventos` / `Todos os estados`. **Manter** o selector `Consultor` (só para brokers) acima da grelha — afecta o endpoint de saúde (scope por consultor) e o endpoint de leads dos fixos.

**Porquê:** os filtros `event`/`state` são triviais visualmente com 5–8 cards (dá para ler de relance). O de `consultor` é ortogonal: brokers precisam de alternar entre consultores, e a grelha inteira muda com ele.

O hook `useScheduled()` pode ser mantido se outra superfície o usa; verificar antes de remover ficheiros. Caso seja exclusivo desta tab, eliminar junto.

### 5. Estados visuais do card — 4 buckets

**Decisão:** o dot/badge do header mapeia a um de quatro buckets, calculados client-side a partir do `HealthSummary` (não faz parte do payload):

| Bucket                  | Condição                                                                                            | Dot        | Label              |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| `completed_one_shot`    | `completed_one_shot === true`                                                                       | emerald-600 | "Concluído"        |
| `failures_unresolved`   | `failed_unresolved_count > 0`                                                                       | red-500    | "N falhas"          |
| `ok`                    | `last_run_status === 'sent'` nos últimos 30d                                                        | emerald-500 | nenhum texto extra |
| `idle`                  | sem runs nos últimos 30d                                                                             | slate-400  | nenhum texto extra |

`failures_unresolved` **ganha** a `ok` mesmo que o último run tenha sido sent (caso: últimos 5 sent + 2 failed mais antigos não retry-ados). Razão: chamar atenção para o que precisa de acção.

O actual badge `Activo/Desactivado` (status configuracional do evento) **mantém-se** — é ortogonal. Um evento pode estar `paused` (desactivado) e ter falhas passadas não resolvidas; o card mostra ambos.

### 6. Deep-link do badge de falhas

**Decisão:** `AutomationDetailSheet` aceita prop opcional `initialRunsFilter?: 'all' | 'failed'`. Quando o utilizador clica no badge `⚠ N falhas` do card:

1. O grid chama `onEventClick(eventId, isFixed)` passando também `filter: 'failed'` (via função extendida `onEventClick(id, isFixed, opts?)`).
2. `ScheduledTab` propaga para o sheet, que inicializa a tab "Envios feitos" com o chip `Só falhados` já activo.

**Porquê não query-string na URL:** o sheet é controlled (não usa router); o estado vive em React. Query-string seria redundante.

## Risks / Trade-offs

- **[Risco] Query de saúde O(runs_last_30d) pode degradar se o volume crescer.** → Mitigação: adicionar índice `idx_car_lead_event_created(lead_id, event_type, created_at DESC)` se o EXPLAIN mostrar sort > 20ms. Não pré-criar — validar primeiro com dados reais (hoje a tabela tem < 500 rows).
- **[Risco] Discrepância entre `last_sent_at` do card (via `useCustomEvents`) e `last_run_at` do novo endpoint.** → Mitigação: passar a usar apenas o do novo endpoint no card; `useCustomEvents` deixa de precisar de `last_sent_at` ao nível do CRUD (ou passa a ser só um fallback quando o health summary ainda está a carregar).
- **[Risco] Tooltip do badge de falhas pode "estragar" em touch devices.** → Mitigação: no mobile, clicar no badge em vez de hover abre directamente o sheet filtrado — salta o tooltip. No desktop, hover mostra tooltip com nomes + click abre sheet.
- **[Risco] `completed_one_shot=true` pode ser prematuro se o spawner ainda vai correr leads adicionais do mesmo evento.** → Mitigação: a flag só aplica a `is_recurring=false`. Para eventos `is_recurring=true` (Anual) a flag nunca é true; o card mostra sempre "Último envio: …" como hoje. Para one-shots, uma execução bem-sucedida **de qualquer lead** é suficiente para marcar como concluído — se for preciso granularidade por lead, esse detalhe já está na tab "Envios feitos" do sheet.
- **[Trade-off] Remover a tabela inferior é um passo de simplificação que alguns utilizadores podem sentir como perda.** → Mitigação: os mesmos rows continuam acessíveis via drill-down no card (tab "Quem recebe" lista leads incluídos + estado). Se surgir push-back, considerar re-adicionar a tabela como secção colapsável "Ver todos os agendados em lista" (colapsada por defeito).

## Migration Plan

Sem migrations de schema. Rollout:

1. Merge do endpoint `GET /api/automacao/custom-events/health-summary` + hook `useAutomationHealth()` sem consumers — seguro para deploy.
2. Actualizar `<AutomationEventCard>` para aceitar prop opcional `health?: HealthSummary` (backwards compatible: sem health, comporta-se como hoje).
3. Actualizar `<EventsCardsGrid>` para consumir `useAutomationHealth()` e passar `health` a cada card. Confirmar nenhum consumer externo dos componentes muda.
4. Remover tabela de `<ScheduledTab>`. Verificar se `useScheduled`/`GET /api/crm/contact-automations-scheduled` têm outros consumers (grep). Se não, apagar também. Se sim, manter o endpoint.
5. Adicionar prop `initialRunsFilter` a `AutomationDetailSheet` e wiring do click do badge.
6. QA em staging (conta broker + conta consultor) — validar (a) broker vê todos os consultores via selector; (b) consultor vê só os seus; (c) um run falhado aparece no card; (d) retry bem-sucedido remove o run do `failed_unresolved`; (e) one-shot com `sent=1` mostra "Concluído".

**Rollback:** reverter commits. Sem efeitos no DB. Endpoint novo pode ficar "órfão" (sem callers) sem efeito colateral.

## Open Questions

- **Devemos mostrar o contador `✓ 12 · ✕ 2` sempre, ou só quando `failed > 0`?** Inclinação: só quando há falhas, para reduzir ruído visual. O sucesso é o default implícito — o dot emerald + "Último envio: há 2 dias" já comunica "tudo bem".
- **Eventos `paused` (desactivados) — mostrar health ou esconder?** Inclinação: mostrar. Um consultor pode ter pausado um evento depois de ver falhas acumuladas; o card deve continuar a comunicar isso até ser reactivado ou eliminado.
- **Filtro "Consultor" (broker) afecta o payload de `useCustomEvents` também?** Hoje `useCustomEvents` devolve só os eventos do próprio consultor (via RLS). Um broker que queira ver os eventos de outro consultor precisa de `?consultant_id=X` em ambos os endpoints. Resolver na fase de tasks — provavelmente alinhar com o padrão existente em `/api/crm/contact-automations-scheduled`.
