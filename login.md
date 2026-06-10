# Login MubeLeads — guia de integração para `app.casasdosotavento.com`

**Audiência**: time que mantém o CRM `app.casasdosotavento.com`.
**Objetivo**: documentar a lógica atual de **login/conexão** do tenant ao MubeLeads (integração Meta Lead Ads), descrevendo todos os endpoints e o fluxo end-to-end.
**Última atualização**: 2026-05-12.

---

## 0. Conceito em uma linha

O usuário do CRM Casas do Sotavento clica em **"Conectar Meta"** → é redirecionado pelo MubeLeads pro Facebook → autoriza → volta pro CRM com a integração 100% pronta (Pages descobertas, webhook leadgen subscrito, backfill de 7 dias de leads históricos rodando em background).

Não há painel intermediário Mube — o usuário **nunca** vê uma tela MubeLeads. Tudo acontece via redirects, e o controle volta pro CRM Casas com query params indicando sucesso ou erro.

---

## 1. Pré-requisitos

### 1.1 Estado no MubeLeads (provisionado pelo time Mube)

Para que um tenant possa fazer login, ele precisa **já existir** nas tabelas internas do MubeLeads:

| Tabela | O que precisa estar lá |
| --- | --- |
| `meta.tenants` | linha com `id = <uuid do tenant>` e `status = 'active'` |
| `meta.lead_destinations` | pelo menos 1 destination ativa pro tenant (gera o `signing_secret` que vira `MUBE_SIGNING_SECRET` no CRM) |

> Provisionamento manual pelo time Mube na ativação do cliente. O CRM Casas não cria nenhum desses registros.

### 1.2 Env vars no CRM Casas

O time Mube entrega ao CRM **duas variáveis** na ativação:

| Env var | Conteúdo | Origem | Uso |
| --- | --- | --- | --- |
| `MUBE_TENANT_ID` | UUID do tenant na `meta.tenants` | Mube ops | Passado no `?tenant_id=` do `/connect`; identifica o tenant nas chamadas autenticadas |
| `MUBE_SIGNING_SECRET` | 64 chars hex | Resposta do `POST /api/internal/destinations` (única vez em claro) | (1) Verificar HMAC dos webhooks inbound de delivery. (2) Assinar HMAC dos requests outbound aos endpoints `/connection` e `/disconnect`. |

Ambas devem ficar **só no backend** do CRM (nunca expostas ao browser).

---

## 2. Endpoints envolvidos

Base URL produção: `https://meta-api.mubesystems.com`

| # | Endpoint | Quem chama | Auth |
| - | --- | --- | --- |
| 2.1 | `GET /api/integrations/meta/connect` | Browser do usuário (via `window.location`) | Nenhuma (state CSRF dentro do fluxo) |
| 2.2 | `GET /api/integrations/meta/callback` | Browser do usuário (Meta redireciona) | Validação interna via `state` |
| 2.3 | `GET /api/integrations/meta/connection` | CRM (server-side ou client-side) | Bearer JWT Supabase |

---

## 3. Fluxo passo a passo

```
[Casas CRM]                      [MubeLeads]                       [Facebook]
   |                                  |                                |
   |  1. usuário clica "Conectar"     |                                |
   |  window.location = /connect      |                                |
   |--------------------------------->|                                |
   |                                  |  2. gera state CSRF             |
   |                                  |  insere em oauth_states          |
   |                                  |  302 → facebook.com/.../oauth   |
   |                                  |------------------------------->|
   |                                                                    |
   |                            3. usuário autoriza no Facebook         |
   |                                                                    |
   |                                  |  4. Facebook redirect           |
   |                                  |  /callback?code=...&state=...   |
   |                                  |<-------------------------------|
   |                                  |                                |
   |                                  |  5. valida state               |
   |                                  |  troca code→token              |
   |                                  |  upserta connection + pages    |
   |                                  |  subscribe leadgen webhook     |
   |                                  |  dispara backfill bg           |
   |                                  |                                |
   |  6. 302 → redirect_to             |                                |
   |     ?status=success&...           |                                |
   |<----------------------------------|                                |
   |                                  |                                |
   |  7. CRM lê query params           |                                |
   |     mostra sucesso pro usuário    |                                |
```

---

## 4. Passo 1 — Iniciar OAuth

### Endpoint

```
GET https://meta-api.mubesystems.com/api/integrations/meta/connect
  ?tenant_id=<uuid-do-tenant>
  &redirect_to=<url-do-CRM-pra-onde-voltar>
```

### Parâmetros

| Param | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `tenant_id` | UUID | sim | UUID do tenant na tabela `meta.tenants` (fornecido pelo Mube) |
| `redirect_to` | URL HTTPS | recomendado | URL absoluta do CRM Casas para onde o MubeLeads vai redirecionar ao terminar. Ex: `https://app.casasdosotavento.com/integrations/meta/result` |

### Como chamar (do CRM)

Tem que ser via **navegação do browser**, NÃO via `fetch`/`XHR`. Se você fizer `fetch`, o navegador segue o 302 mas o `Set-Cookie` da Meta não funciona e o usuário não vê o popup de consentimento.

```ts
// Exemplo: handler do botão "Conectar Meta" no CRM
function connectMeta() {
  const url = new URL("https://meta-api.mubesystems.com/api/integrations/meta/connect");
  url.searchParams.set("tenant_id", TENANT_ID);
  url.searchParams.set("redirect_to", "https://app.casasdosotavento.com/integrations/meta/result");
  window.location.href = url.toString();
}
```

### O que acontece do lado MubeLeads

1. Gera um `state` UUIDv4 (token CSRF).
2. Insere em `meta.oauth_states (state, tenant_id, redirect_to, expires_at, ...)`.
3. Constrói a URL de autorização da Meta com `scope` contendo: `public_profile`, `email`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `leads_retrieval`, `ads_read`, `ads_management`, `business_management`.
4. Retorna `302 Location: https://www.facebook.com/v25.0/dialog/oauth?...`.

### Erros possíveis nesta etapa

| Resposta | Significado | Ação |
| --- | --- | --- |
| `400 {"error":"tenant_id required"}` | param ausente | CRM deve incluir `tenant_id` |
| `500 {"error":"internal_error"}` | falha ao gravar state | Mostrar erro genérico, sugerir tentar de novo |

---

## 5. Passo 2 — Usuário autoriza no Facebook

Fluxo padrão Facebook Login. Pontos importantes:

- O usuário precisa ser **admin ou ter Tasks que incluam MANAGE/ADVERTISE** em pelo menos uma Page (caso contrário a Page não aparece na listagem subsequente).
- Se ele revogar/cancelar, a Meta redireciona pra `/callback?error=access_denied&error_reason=user_denied`.
- A primeira conexão dispara o consent screen com a lista completa de permissões; reconexões podem ser silenciosas se o usuário já consentiu antes (até a próxima App Review).

---

## 6. Passo 3 — Callback do MubeLeads

O endpoint `GET /api/integrations/meta/callback` é interno (chamado pela Meta), o CRM **não chama ele diretamente**. Mas é importante entender o que ele faz porque define o que o CRM vai ver no passo 4.

Sequência interna ([app/api/integrations/meta/callback/route.ts](../../../app/api/integrations/meta/callback/route.ts)):

1. **Valida `state`** — busca em `oauth_states`. Rejeita se expirado, já consumido, ou inexistente.
2. **Troca `code` por token short-lived** (`GET /oauth/access_token`).
3. **Troca short-lived por long-lived** (`GET /oauth/access_token?grant_type=fb_exchange_token`).
4. **Busca perfil do usuário** (`GET /me`) — para popular `meta_user_id`, `meta_user_name`, `meta_user_email`.
5. **Lista Pages do usuário** (`GET /me/accounts`).
6. **Persiste `meta.connections`** com user token cifrado (AES via Vault).
7. **Para cada Page**:
   - Cifra page access token.
   - **Subscribe automático** ao webhook leadgen (`POST /{page_id}/subscribed_apps?subscribed_fields=leadgen`). Falha em uma Page não interrompe — log warning e segue.
   - Upsert em `meta.pages` com `webhook_subscribed: true/false`.
8. **Marca `state` como consumido** (one-shot — não pode ser reusado).
9. **Dispara o bootstrap em background** (fire-and-forget): cria um job em `meta.sync_jobs` e corre `runSyncJob` com **todos** os recursos (`forms`, `campaigns`, `ads`, `creatives`, `leads`, `insights`), `sinceDays: 7`. Internamente:
   - `syncFormsForPage` por Page → popula `meta.lead_forms`.
   - `backfillLeadsForPage(sinceDays: 7)` por Page → importa leads dos últimos 7 dias (não dispara delivery ao CRM, é só pra histórico no painel).
   - ad assets por ad account permitida (default-deny via `tenant_scopes`) → popula `meta.ad_accounts`, `meta.campaigns`, `meta.ads`, **`meta.creatives`**.
   - insights (janela de 7 dias) → popula `meta.ad_insights`.
   - O estado fica rastreável em `GET /api/internal/sync/jobs/{job_id}` (`pending`/`running`/`done`/`failed` + contadores). O `job_id` não é devolvido ao CRM no redirect (o bootstrap é best-effort); serve para debug do lado Mube.
10. **Redireciona** para o `redirect_to` original (CRM Casas) com query params de status.

---

## 7. Passo 4 — CRM recebe o redirect

A URL final que o usuário vê tem o formato:

### Sucesso

```
https://app.casasdosotavento.com/integrations/meta/result
  ?status=success
  &connection_id=<uuid>
  &pages_count=<int>
```

### Falha

```
https://app.casasdosotavento.com/integrations/meta/result
  ?status=error
  &error=<código>
  &error_reason=<motivo opcional>
```

### Códigos de erro possíveis

| `error` | Motivo |
| --- | --- |
| `access_denied` | Usuário cancelou no Facebook |
| `invalid_state` | State não encontrado (link velho, tentativa de CSRF) |
| `state_already_consumed` | Callback já processado antes (back button) |
| `state_expired` | Mais de 15 minutos entre `/connect` e `/callback` |
| `missing_params` | `code` ou `state` ausentes |
| (outros) | Mensagem de erro da Graph API ou exception interna |

### Recomendação de tratamento no CRM

```tsx
// Página /integrations/meta/result do CRM Casas
"use client";
import { useSearchParams } from "next/navigation";

export default function MetaResultPage() {
  const params = useSearchParams();
  const status = params.get("status");
  const error = params.get("error");
  const pagesCount = params.get("pages_count");

  if (status === "success") {
    return (
      <Alert variant="success">
        Meta conectada! {pagesCount} Page(s) configurada(s).
        Os leads dos últimos 7 dias estão sendo importados em background.
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="error">
        {error === "access_denied"
          ? "Você cancelou a autorização no Facebook. Tente novamente."
          : `Erro na conexão: ${error}. Contate o suporte.`}
      </Alert>
    );
  }

  return <Spinner />;
}
```

---

## 8. Consultar status da conexão (sem refazer login)

Use `GET /api/integrations/meta/connection` para perguntar ao MubeLeads se um tenant já está conectado e quais Pages estão ativas. Usado em:
- Tela de configurações ("integração Meta: conectado/desconectado")
- Página de listagem de Pages
- Validações antes de criar destinations

### Endpoint

```
GET https://meta-api.mubesystems.com/api/integrations/meta/connection?tenant_id=<MUBE_TENANT_ID>
X-Mube-Tenant-Id:      <MUBE_TENANT_ID>
X-Mube-Timestamp:      <unix seconds>
X-Mube-Signature-256:  sha256=<HMAC-SHA256 da mensagem canônica>
```

### Autenticação — HMAC com `MUBE_SIGNING_SECRET`

⚠️ Este endpoint **exige autenticação**. O CRM Casas autentica via **HMAC-SHA256** usando o mesmo `MUBE_SIGNING_SECRET` que já recebeu quando a destination foi criada (e que usa pra verificar inbound de delivery).

A chamada **deve ser feita server-side**: a secret nunca pode aparecer no browser do usuário final. Se o CRM Casas tem um frontend React e quer mostrar o status na UI, ele expõe um endpoint no próprio backend que faz proxy.

**Mensagem canônica que é assinada:**

```
${timestamp}.${METHOD}.${pathname}${search}.${rawBody}
```

Para este GET sem body, a mensagem fica:

```
1731600000.GET./api/integrations/meta/connection?tenant_id=0b6a-....
```

(Note o `.` final — `rawBody` é string vazia, mas o separador permanece.)

**Janela anti-replay**: ±300 segundos do horário do servidor. Sync seu clock se ver erro `hmac_timestamp_out_of_window`.

### Exemplo — Node/TypeScript (backend Casas)

```ts
import crypto from "node:crypto";

const MUBE_API = "https://meta-api.mubesystems.com";
const TENANT_ID = process.env.MUBE_TENANT_ID!;
const SECRET = process.env.MUBE_SIGNING_SECRET!;

export async function getMetaConnection() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const path = `/api/integrations/meta/connection?tenant_id=${TENANT_ID}`;
  const message = `${ts}.GET.${path}.`; // body vazio
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(message, "utf8")
    .digest("hex");

  const res = await fetch(`${MUBE_API}${path}`, {
    headers: {
      "X-Mube-Tenant-Id": TENANT_ID,
      "X-Mube-Timestamp": ts,
      "X-Mube-Signature-256": `sha256=${signature}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `meta_connection_${res.status}`);
  }
  return res.json();
}
```

### Exemplo — cURL (debug)

```bash
TS=$(date +%s)
TENANT=$MUBE_TENANT_ID
PATH_Q="/api/integrations/meta/connection?tenant_id=$TENANT"
MSG="$TS.GET.$PATH_Q."
SIG=$(printf '%s' "$MSG" | openssl dgst -sha256 -hmac "$MUBE_SIGNING_SECRET" | awk '{print $2}')

curl "https://meta-api.mubesystems.com$PATH_Q" \
  -H "X-Mube-Tenant-Id: $TENANT" \
  -H "X-Mube-Timestamp: $TS" \
  -H "X-Mube-Signature-256: sha256=$SIG"
```

### Resposta — Conectado

```json
{
  "connected": true,
  "connection": {
    "id": "0b6a...",
    "meta_user_id": "1234567890",
    "meta_user_name": "João da Silva",
    "meta_user_email": "joao@email.com",
    "status": "active",
    "status_reason": null,
    "connected_at": "2026-05-10T14:23:11Z",
    "user_token_expires_at": "2026-07-09T14:23:11Z"
  },
  "pages": [
    {
      "id": "uuid-...",
      "page_id": "987654321",
      "page_name": "Casas do Sotavento",
      "page_category": "Real Estate",
      "page_tasks": ["MANAGE", "ADVERTISE", "..."],
      "webhook_subscribed": true,
      "webhook_subscribed_at": "2026-05-10T14:23:13Z",
      "status": "active",
      "status_reason": null
    }
  ]
}
```

### Resposta — Não conectado

```json
{
  "connected": false,
  "connection": null,
  "pages": []
}
```

### Estados de `connection.status` que o CRM precisa tratar

| Status | Significado | Ação sugerida |
| --- | --- | --- |
| `active` | Tudo ok | Mostrar "Conectado" |
| `reauth_required` | Token expirou / scope mudou | Botão "Reconectar" (refaz fluxo do passo 1) |
| `revoked` | Usuário desconectou (via `/disconnect` ou na Meta) | Botão "Conectar Meta" |
| `error` | Erro interno persistente | Mostrar mensagem + suporte |

### Estados de `pages[].status`

| Status | Significado |
| --- | --- |
| `active` | Page operacional, recebendo leads |
| `disconnected` | Page desligada (via `/disconnect` ou owner removeu app na Meta) |
| `error` | Falha persistente em chamadas à Graph para esta Page |

### Erros HTTP

| Status | Body | Significado | Como resolver |
| --- | --- | --- | --- |
| 400 | `{"error":"tenant_id required"}` | Param `tenant_id` ausente na URL | Incluir query param |
| 401 | `{"error":"missing_authentication"}` | Nenhum dos modos de auth foi enviado | Adicionar headers HMAC |
| 401 | `{"error":"hmac_missing_headers"}` | Falta `X-Mube-Tenant-Id`, `X-Mube-Timestamp` ou `X-Mube-Signature-256` | Mandar os 3 headers |
| 401 | `{"error":"hmac_invalid_timestamp"}` | `X-Mube-Timestamp` não é número | Mandar unix seconds inteiro |
| 401 | `{"error":"hmac_timestamp_out_of_window"}` | Clock skew > 300s | Sincronizar relógio do servidor Casas |
| 401 | `{"error":"hmac_no_destinations"}` | Tenant não tem nenhuma destination ativa | Pedir ao Mube pra criar/reativar a destination |
| 401 | `{"error":"hmac_signature_mismatch"}` | Assinatura não bateu com nenhum secret | Conferir secret + algoritmo de canonicalização |
| 403 | `{"error":"hmac_tenant_mismatch"}` | `X-Mube-Tenant-Id` ≠ `tenant_id` da query | Mandar o mesmo UUID nos dois |
| 500 | `{"error":"internal_error"}` | Falha interna no MubeLeads | Contate o suporte com timestamp |

> Para o dashboard interno Mube (`app.mubesystems.com`) há também um modo Bearer JWT (Supabase Auth do projeto MubeLeads). CRMs cliente devem usar HMAC.

---

## 9. Reconexão

Mesmo fluxo do passo 1. O `/callback` faz `upsert` em `connections` com `onConflict: tenant_id,meta_user_id`, então reconectar o **mesmo usuário Meta** atualiza tokens sem criar registro duplicado.

Se o usuário trocar de conta Facebook (raro, mas possível), surge uma nova `connection` para o mesmo `tenant_id` com `meta_user_id` diferente. O `GET /connection` retorna a mais recente (ordenado por `connected_at desc`).

---

## 10. Tempos de token e renovação automática

- **Short-lived user token**: ~1 hora. Convertido imediatamente em long-lived no callback.
- **Long-lived user token**: ~60 dias (`user_token_expires_at` no DB).
- **Page Access Token**: long-lived também é derivado e dura ~60 dias.

**Não há renovação silenciosa em background**. Quando um token estiver perto de expirar (ex: 5 dias), o CRM deve mostrar um banner "Reautorização necessária em breve" e idealmente forçar a reconexão. Verificar `connection.user_token_expires_at` no endpoint da seção 8.

---

## 11. Permissões aprovadas no App Meta

Para referência (status visível no painel `developers.facebook.com` → app MubeLeads → "Casos de uso"):

| Permission | Uso |
| --- | --- |
| `public_profile`, `email` | Identificar o usuário Meta |
| `pages_show_list` | Listar Pages do usuário |
| `pages_read_engagement` | Ler metadados/campos das Pages |
| `pages_manage_metadata` | Subscribe leadgen webhook |
| `pages_manage_ads` | Campos ad-level dos leads (via Page token) |
| `leads_retrieval` | Buscar leads via Graph |
| `ads_read` | Listar ad accounts/campaigns/ads |
| `ads_management` | Mesmas APIs, com escrita futura |
| `business_management` | Business Manager API |

Marketing API Access Tier: **Standard** ("Acesso limitado"). Limites menores; suficiente pra Casas. Avanço para Advanced Access será solicitado se vier necessidade de escala.

---

## 12. Checklist de integração no CRM Casas

- [ ] `MUBE_TENANT_ID` e `MUBE_SIGNING_SECRET` configurados no **backend** (não no browser)
- [ ] Helper server-side `signMubeRequest(method, path, body)` que produz `X-Mube-Timestamp` + `X-Mube-Signature-256`
- [ ] Botão "Conectar Meta" em algum lugar visível na config do tenant
- [ ] Página `/integrations/meta/result` lendo query params e mostrando feedback
- [ ] Status de conexão exibido no dashboard (proxy server-side chamando `/api/integrations/meta/connection` com HMAC)
- [ ] Botão "Reconectar" quando `status === 'reauth_required'`
- [ ] Botão "Desconectar Meta" (ver [logout.md](./logout.md))
- [ ] Tratamento dos códigos de erro do passo 7
- [ ] Banner de "token expira em X dias" baseado em `user_token_expires_at`

---

## 13. Suporte

- Logs do callback ficam no container `meta-api.mubesystems.com` (Coolify). Pedir ao Mube por `connectionId` ou `tenantId`.
- Tabelas relevantes para debug (acesso via Supabase MubeLeads):
  - `meta.oauth_states` — fluxos em andamento ou expirados
  - `meta.connections` — status atual da conexão por tenant
  - `meta.pages` — Pages descobertas, status de webhook
  - `meta.webhook_events` — log bruto de webhooks recebidos
