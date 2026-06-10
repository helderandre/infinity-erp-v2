# Prompt — consumir Insights, custo por lead e sync no frontend / CRM

Copia este ficheiro inteiro como prompt num Claude Code corrido sobre o repositório do **frontend / dashboard / CRM** que consome a `meta-api` (NÃO este repo).

---

## Contexto

A backend `meta-api` (multi-tenant, integração Meta/Facebook) ganhou a capacidade de **medir desempenho de anúncios**. Já existia: OAuth por tenant, sync de Pages/formulários/leads/campanhas/anúncios, e entrega de leads ao CRM por webhook assinado.

Novidades que este prompt cobre:
1. **Insights de desempenho** (gasto, impressões, cliques, CPL, ROAS) a todos os níveis — leitura via API e notificação por webhook.
2. **Custo por lead** anexado a cada lead no payload de entrega.
3. **Webhook de Ad Account** (alertas de estado/problema de campanhas/anúncios).
4. **Sync sob demanda** para descobrir campanhas/anúncios novos — porque o Meta **não** envia webhook quando uma campanha/anúncio/formulário é **criado** (só envia leads e mudanças de estado). Para o caso de o utilizador criar uma campanha e querer mapeá-la/ajustá-la antes de ativar, é preciso forçar o sync.

## Autenticação — TRÊS modos, não confundir

| Modo | Header(s) | Quem | Onde chamar |
|---|---|---|---|
| **Tenant — Bearer JWT** | `Authorization: Bearer <jwt_supabase>` + `?tenant_id=<uuid>` | utilizador logado (Supabase Auth) membro do tenant | pode ser do browser (com o JWT do user) |
| **Tenant — HMAC** | `X-Mube-Tenant-Id`, `X-Mube-Timestamp`, `X-Mube-Signature-256` | backend do CRM (sem JWT de utilizador) | server-to-server, usando o `signing_secret` da destination |
| **Admin / server-to-server** | `X-Admin-Secret: <MUBE_ADMIN_SECRET>` | backoffice/cron | **só do lado server** (route handler / server action). NUNCA expor o segredo no browser |

- Os endpoints **tenant-facing** (`/api/leads`, `/api/leads/[id]`, `/api/insights`) aceitam **Bearer JWT OU HMAC** — usa o que for mais conveniente (browser → JWT; backend do CRM → HMAC).
- JWT: o utilizador tem de estar em `tenant_members` desse `tenant_id`, senão `403 not_a_member`.
- HMAC: assina `ts.MÉTODO.caminho+query.body` (body `""` em GET) com o `signing_secret` da destination; janela de ±5 min; header no formato `X-Mube-Signature-256: sha256=<hmac_hex>`. Ver exemplo na secção A.0.
- Os endpoints `/api/internal/*` são todos admin (`X-Admin-Secret`).

Base URL: `process.env.MUBE_API_BASE_URL` (produção: `https://meta-api.mubesystems.com`).

---

## A. Endpoints tenant-facing (Bearer JWT **ou** HMAC)

### A.0 Chamar via HMAC (backend do CRM, sem JWT)

```ts
import crypto from "node:crypto";

const ts = Math.floor(Date.now() / 1000).toString();
const path = "/api/insights?tenant_id=615dbe3a-...&level=campaign"; // pathname + query EXATOS
const msg = `${ts}.GET.${path}.`;                                    // body "" em GET
const sig = "sha256=" + crypto.createHmac("sha256", SIGNING_SECRET).update(msg, "utf8").digest("hex");

await fetch(`${BASE}${path}`, {
  headers: {
    "X-Mube-Tenant-Id": tenantId,
    "X-Mube-Timestamp": ts,
    "X-Mube-Signature-256": sig,
  },
});
```
⚠️ O `caminho+query` na mensagem assinada tem de ser **idêntico** ao do pedido, senão `hmac_signature_mismatch`. O `SIGNING_SECRET` é o mesmo da destination (usado também para verificar os webhooks de entrada).

### A.1 `GET /api/insights` — série temporal de desempenho

Query params:
- `tenant_id` (uuid, **obrigatório**)
- `level` (`account` | `campaign` | `adset` | `ad`, opcional) — filtra o nível
- `ad_account_id` (`act_<num>`, opcional)
- `campaign_id` (opcional)
- `ad_id` (opcional)
- `from` / `to` (`YYYY-MM-DD`, opcional) — filtram por `date_start`
- `limit` (default 50, máx 500), `offset` (default 0)

Response 200:
```ts
type InsightActionStat = { action_type: string; value: string }; // value vem como string da Graph API

type Insight = {
  id: string;
  ad_account_id: string;          // "act_3067921983240264"
  level: "account" | "campaign" | "adset" | "ad";
  object_id: string;              // id do objeto no nível indicado
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  date_start: string;             // "2026-05-01" (1 linha por dia)
  date_stop: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  inline_link_clicks: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  leads: number | null;           // soma dos action_type de lead
  cost_per_lead: number | null;   // spend ÷ leads (aproximação). null se leads=0
  actions: InsightActionStat[] | null;
  action_values: InsightActionStat[] | null;
  cost_per_action_type: InsightActionStat[] | null;
  purchase_roas: InsightActionStat[] | null; // normalmente vazio em lead-gen (sem pixel de compra)
  account_currency: string | null; // "EUR"
  fetched_at: string;             // ISO datetime
};

type InsightsResponse = {
  insights: Insight[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
};
```

Notas importantes para a UI:
- **Uma linha por (nível, objeto, dia).** Para um total de campanha num período, soma `spend`/`clicks`/`leads` das linhas `level=campaign` (mas **NÃO** somes `reach`/`frequency` — não são somáveis; usa só o valor que o Meta dá por linha).
- `cost_per_lead` é o **custo médio diário do anúncio** (gasto ÷ leads do dia), não o custo exato daquele lead. Mostra como aproximação.
- **ROI não vem calculado** — só `spend` e (se houver) `purchase_roas`. O ROI real é responsabilidade do CRM (receita ÷ gasto), usando a receita que só o CRM tem.

Exemplo (browser, com JWT do user):
```ts
const r = await fetch(
  `${BASE}/api/insights?tenant_id=${tenantId}&level=campaign&from=2026-05-01&to=2026-05-28`,
  { headers: { Authorization: `Bearer ${jwt}` } },
);
const { insights, pagination } = await r.json();
```

Errors: `400 tenant_id required` / `400 invalid_level` / `401` / `403 not_a_member` / `500`.

### A.2 `GET /api/leads` — lista de leads

Query: `tenant_id` (obrigatório), `page_id?`, `form_id?`, `from?`/`to?` (ISO, filtram `received_at`), `limit` (default 50, máx 200), `offset`.

```ts
type Lead = {
  id: string;
  leadgen_id: string;
  page_id: string;
  form_id: string | null;
  ad_id: string | null;
  campaign_id: string | null;
  is_organic: boolean | null;
  fb_created_time: string | null;
  field_data: unknown;            // array bruto de {name, values} da Meta
  normalized_email: string | null;
  normalized_phone: string | null;
  normalized_full_name: string | null;
  delivery_status: string | null;
  received_at: string;
};
type LeadsResponse = { leads: Lead[]; pagination: {...} };
```

> ⚠️ Este endpoint **não devolve o custo por lead**. O custo chega ao CRM pelo **payload do webhook `lead.created`** (campo `lead.cost`, ver secção C) e/ou cruza-se com `/api/insights` por `ad_id` + dia. Se precisares de mostrar custo numa lista de leads vinda só desta API, terás de juntar com os insights do lado do frontend.

---

## B. Endpoints admin (X-Admin-Secret — só server-side)

### B.1 `POST /api/internal/sync/insights` — refresh dos insights

Body (todos opcionais):
```ts
{ since_days?: number;   // 1..90, default 30 (janela móvel de atribuição)
  limit?: number;        // 1..1000, default 100 (connections por rodada)
  connection_id?: string;// restringe a uma connection
  purge?: boolean }      // default true — apaga linhas > 90 dias no fim
```
Response: `{ connections_processed, since_days, total_errors, purged, elapsed_ms, results: [{ connection_id, fetched, upserted, errors, accounts_processed, error? }] }`.

Já corre **diariamente** via Coolify Scheduled Task. Usa este endpoint manualmente só para um "Atualizar desempenho agora".

### B.2 `POST /api/internal/deliver-insights` — refresh de UM tenant

Body:
```ts
{ tenant_id: string;        // obrigatório
  ad_account_id?: string;   // "act_<num>", restringe a uma conta
  since_days?: number;      // default 30
  dry_run?: boolean }       // default false — só conta linhas na BD, não busca
```
Response: `{ tenant_id, ad_account_ids, dry_run, since_days, found, delivered, errors?, elapsed_ms, note? }`.
Errors: `404 no_active_connection`, `403 ad_account_not_allowed`.

### B.3 Sync seletivo e assíncrono (campanhas/anúncios/criativos/formulários)

`POST /api/internal/sync/connection/{connection_id}` — sync seletivo. Body (todos opcionais):
```ts
{
  resources?: ("forms"|"campaigns"|"ads"|"creatives"|"leads"|"insights")[]; // omitir = todos
  since?: string | number;   // YYYY-MM-DD ou unix segundos, interpretado POR RECURSO:
                             //   forms      → ignorado (lista completa)
                             //   campaigns  → updated_time > since
                             //   ads        → updated_time > since
                             //   creatives  → criativos dos ads alterados desde since
                             //   leads      → created_time >= since
                             //   insights   → série de since até hoje
  since_days?: number;       // 1..365; janela default de leads/insights quando não há `since`
  async?: boolean;           // default TRUE. false = corre já e devolve contadores
}
```
- **Modo assíncrono (default)** — responde **202** com `{ job_id, status: "queued" }` e processa em background. Resolve o timeout de ~6 min em tenants grandes. Consulta o estado em `GET /api/internal/sync/jobs/{job_id}`.
- **`insights` e `creatives` correm SEMPRE async**, mesmo com `async: false` (são rate-limited / pesados).
- **Modo síncrono** (`async: false` numa chamada leve, ex.: `{ resources: ["campaigns"], since: "2026-05-20", async: false }`) — responde **200** com os contadores:
  ```ts
  { connection_id, pages, resources: string[],
    forms_total:{fetched,upserted,errors},
    leads_total:{fetched,upserted,errors,forms_processed},
    ad_assets:{ accounts:{...}, campaigns:{...}, ads:{...}, creatives:{...} },
    insights_total:{fetched,upserted,errors,accounts_processed},
    elapsed_ms }
  ```
- **Valores fora do enum em `resources` → `400 invalid_body`.**

`GET /api/internal/sync/jobs/{job_id}` — estado de um job assíncrono. Resposta:
```ts
{ job: {
    id: string; connection_id: string; tenant_id: string;
    resources: string[]; since: string | null;
    status: "pending" | "running" | "done" | "failed";
    result: ConnectionSyncResult | null;  // os contadores acima quando done
    error: string | null;
    created_at: string; started_at: string | null; finished_at: string | null;
} }
```
Faz polling até `status` ser `done` ou `failed`. Jobs presos em `running` além do timeout (~15 min) são marcados `failed`. `404 job_not_found` se o id não existir.

- `POST /api/internal/sync/all` — body `{ since_days?, limit? }`. Re-sincroniza todas as connections ativas (todos os recursos).
- `POST /api/internal/sync/page/{page_id}` — só formulários + leads de uma Page.

> Reconciliação: o antigo `updated_since` foi **removido** — usa `since` (unificado, interpretado por recurso).

### B.4 Scope (autorizar BMs / ad accounts)

`GET /api/internal/scope/preview` e `POST /api/internal/scope/commit` — ver o prompt dedicado [`scope-picker-prompt.md`](./scope-picker-prompt.md). Necessário quando uma campanha nova está numa ad account/BM ainda não autorizado para o tenant (default-deny).

---

## C. Corpo entregue pelo webhook (o que o CRM recebe)

A `meta-api` faz `POST` para o `webhook_url` configurado em cada destination, com estes headers:

| Header | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | `MubeLeads/1.0 (+https://mubesystems.com)` |
| `X-Mube-Event` | o tipo de evento (ver abaixo) |
| `X-Mube-Signature-256` | `sha256=<hmac_hex>` |
| `X-Mube-Delivery-Id` | uuid único da entrega |

### Verificar a assinatura (OBRIGATÓRIO no CRM)

A assinatura é `HMAC-SHA256` do **corpo cru** (os bytes exatos, antes de `JSON.parse`), com o `signing_secret` da destination, em hex. Verifica assim:

```ts
import crypto from "node:crypto";

function verifyMubeSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// IMPORTANTE: usa o corpo CRU (string original do request), não o objeto re-serializado.
```

### Envelope comum a todos os eventos

```ts
type MubeEnvelope = {
  version: "1";
  event: MubeEventType;
  delivered_at: string;   // ISO
  tenant_id: string;
  // + um campo de entidade conforme o evento (lead / form / campaign / ad / insights / ad_object)
};

type MubeEventType =
  | "lead.created"      // tem retry (até esgotar backoff). Os outros são fire-and-forget (re-emitidos no próximo sync)
  | "form.synced"
  | "campaign.synced"
  | "ad.synced"
  | "creative.synced"
  | "insights.synced"
  | "ad_object.issue";
```
Uma destination só recebe os eventos que tem em `event_types`. O CRM deve **fazer upsert idempotente** pelo id da entidade (os eventos não-lead podem repetir).

### C.1 `lead.created`
```ts
{
  version: "1"; event: "lead.created"; delivered_at: string; tenant_id: string;
  lead: {
    id: string; leadgen_id: string; page_id: string;
    form_id: string | null; form_name: string | null; form_questions: unknown | null;
    ad_id: string | null; campaign_id: string | null;
    email: string | null; full_name: string | null; phone: string | null;
    field_data: unknown; fb_created_time: string | null; received_at: string;
    cost: {
      per_lead: number | null;       // null em leads novos (custo chega depois, via sync de insights)
      currency: string | null;
      basis: "ad_daily_average";     // aproximação: gasto diário do anúncio ÷ leads do dia
    };
  };
}
```
> Nota: o `cost.per_lead` chega **null** num lead acabado de criar (o gasto do dia ainda não fechou). É preenchido depois pelo sync de insights — o CRM pode re-consultar `/api/insights` por `ad_id`+dia, ou re-receber via re-entrega.

### C.2 `form.synced`
```ts
{ ...envelope; form: { form_id: string; page_id: string; form_name: string | null;
    status: string | null; locale: string | null; questions: unknown | null; fb_created_time: string | null } }
```

### C.3 `campaign.synced`
```ts
{ ...envelope; campaign: { campaign_id: string; ad_account_id: string; name: string | null;
    status: string | null;       // effective_status (ex.: "ACTIVE", "PAUSED")
    objective: string | null; daily_budget: string | null; lifetime_budget: string | null;
    start_time: string | null; stop_time: string | null; fb_created_time: string | null } }
```

### C.4 `ad.synced`
```ts
{ ...envelope; ad: { ad_id: string; campaign_id: string | null; adset_id: string | null;
    name: string | null; status: string | null; // effective_status
    creative_id: string | null; creative_name: string | null; fb_created_time: string | null } }
```
> O `ad.synced` continua a expor só `creative_id` + `creative_name` (não quebra consumidores atuais). O **criativo completo** (imagem/vídeo, copy, CTA, link) chega no evento `creative.synced` abaixo — junta-se por `creative_id`.

### C.4b `creative.synced` — criativo completo
```ts
{ ...envelope; creative: {
    creative_id: string; ad_account_id: string; name: string | null;
    title: string | null; body: string | null;   // título e copy
    cta_type: string | null;                       // ex.: "LEARN_MORE", "SIGN_UP"
    link_url: string | null;                       // link de destino
    image_url: string | null; thumbnail_url: string | null; video_id: string | null;
    object_story_spec: Record<string, unknown> | null; // spec cru da Meta, para flexibilidade
} }
```
> Upsert idempotente por `creative_id`. Liga ao anúncio pelo `creative_id` recebido em `ad.synced`.

### C.5 `insights.synced` — é um PING, não traz métricas
```ts
{ ...envelope; insights: { ad_account_id: string; since: string; until: string;
    rows_upserted: number; leads_cost_updated: number } }
```
> ⚠️ Este evento só avisa que houve um refresh (quantas linhas e quantos custos de lead atualizados). **As métricas em si lêem-se em `GET /api/insights`.** Usa este evento como gatilho para o CRM re-buscar os insights.

### C.6 `ad_object.issue` — alerta de estado/problema (webhook de Ad Account)
```ts
{ ...envelope; ad_object: { ad_account_id: string;
    field: "with_issues_ad_objects" | "in_process_ad_objects";
    value: unknown } } // value é o payload bruto da Meta para esse campo
```

---

## D. Fluxo: criar campanha → mapear/ajustar → ativar

O Meta **não** envia webhook quando uma campanha/anúncio/formulário é **criado**. Logo, descobrir objetos novos depende de **sync** (polling). Fluxo recomendado para o caso do utilizador criar uma campanha (mesmo ainda em PAUSED) e querer mapeá-la antes de ativar:

1. **Forçar refresh** (server-side, admin secret):
   `POST /api/internal/sync/connection/{connection_id}` com `{ resources: ["campaigns","ads"] }` — busca campanhas/anúncios novos e **emite `campaign.synced` / `ad.synced`** ao CRM. Por default é **assíncrono**: recebes `202 { job_id }`, fazes polling em `GET /sync/jobs/{job_id}` até `done`. Para uma janela pequena podes pedir `async: false` e receber os contadores na hora. Campanhas em PAUSED chegam com `status` a refletir isso, por isso podem ser mapeadas antes de ativar.
2. **Se a campanha está numa ad account/BM ainda não autorizado** (recebes 0 contas / não aparece): corre o picker de scope (`scope/preview` → `scope/commit`, ver [`scope-picker-prompt.md`](./scope-picker-prompt.md)). O `commit` já dispara um sync completo.
3. **O CRM guarda** as campanhas/anúncios recebidos em `campaign.synced`/`ad.synced` (upsert por `campaign_id`/`ad_id`) e mostra-os na UI de mapeamento.
4. O utilizador faz o mapeamento no CRM e ativa a campanha no Meta.
5. Quando a campanha gera leads, chega `lead.created` (com `campaign_id`/`ad_id`); o custo e os insights chegam no ciclo diário (ou via "Atualizar agora" → `deliver-insights`).

> ⚠️ **Não existe** hoje endpoint tenant-facing de leitura para campanhas/anúncios (só `/api/leads` e `/api/insights`). Os dados de campanha/anúncio chegam ao CRM **pelos eventos de webhook** e devem ser guardados no lado do CRM. Se for preciso uma API de leitura de campanhas/anúncios, é um follow-up na `meta-api` (não inventes `GET /api/campaigns`).

### Botões úteis na UI
- **"Atualizar campanhas/anúncios agora"** → `POST /api/internal/sync/connection/{connection_id}` `{ resources: ["campaigns","ads"] }` (server action). Async por default → guarda o `job_id` e faz polling em `GET /sync/jobs/{job_id}`.
- **"Sincronizar criativos"** → `POST /api/internal/sync/connection/{connection_id}` `{ resources: ["creatives"] }` (sempre async → `job_id`).
- **"Atualizar desempenho agora"** → `POST /api/internal/deliver-insights` `{ tenant_id }` (ou `sync/insights`).

---

## Gotchas

1. **`X-Admin-Secret` nunca no browser.** Os `/api/internal/*` chamam-se de server actions / route handlers do frontend.
2. **Assinatura sobre o corpo CRU.** Verifica antes de `JSON.parse`; senão a verificação falha.
3. **`insights.synced` não tem métricas** — é gatilho; lê em `/api/insights`.
4. **`reach`/`frequency` não são somáveis** entre dias/níveis — usa o valor por linha.
5. **Custo por lead é aproximação** (`basis: "ad_daily_average"`) e pode chegar null em leads novos.
6. **Datas:** `date_start` dos insights usa o fuso da conta (`account_currency`/timezone Meta); `received_at` dos leads é o nosso (UTC). Não assumas que batem ao segundo.
7. **Idempotência:** eventos não-lead podem repetir — upsert pelo id da entidade.

---

## Outputs esperados quando este prompt for processado

1. Cliente tipado para os endpoints tenant-facing (`getInsights`, `getLeads`) com o header Bearer.
2. Server actions/route handlers para os endpoints admin (`syncInsights`, `deliverInsights`, `syncConnection` com `resources`/`since`/`async`, `getSyncJob`) com `X-Admin-Secret`. `syncConnection` async devolve `job_id` → helper de polling em `GET /sync/jobs/{job_id}`.
3. Receiver de webhook com verificação de assinatura e `switch` por `X-Mube-Event` (incl. `creative.synced`), com upsert idempotente por entidade (`creative.synced` por `creative_id`).
4. Tipos TypeScript explícitos para todos os payloads (secção C) e respostas (secção A/B).
5. UI de desempenho a ler `/api/insights` + botões de "atualizar agora".

Focar em funcionar manualmente primeiro; sem testes E2E neste sprint.
