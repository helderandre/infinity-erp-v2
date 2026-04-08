# Imóvel → Interessados — Matching System

How the **Leads Infinity** subtab on a property's *Interessados* tab decides which buyer negocios are shown.

- **API:** `GET /api/properties/[id]/interessados` → [app/api/properties/[id]/interessados/route.ts](../../app/api/properties/%5Bid%5D/interessados/route.ts)
- **UI:** [app/dashboard/imoveis/[id]/page.tsx](../../app/dashboard/imoveis/%5Bid%5D/page.tsx) — search for `interessadosSubTab === 'pipeline'`

---

## Data sources

The endpoint returns two arrays:

| Field | What it is |
|---|---|
| `linked` | Buyers already attached to this property via `negocio_properties` (manually pinned, sent, visited, etc.) |
| `suggestions` | Auto-matched buyer negocios that pass the scoring filter |

The frontend merges them into a single list. Both go through the same display pipeline and per-row card.

For each buyer the API joins:

- `negocios.tipo, estado, orcamento, orcamento_max, localizacao, tipo_imovel, quartos_min, observacoes, assigned_consultant_id`
- `negocios.consultant` → `dev_users` via `negocios_assigned_consultant_id_fkey` (with profile.phone_commercial)
- `negocios.lead` → `leads(id, nome, email, telemovel, agent_id)` and `lead.agent` via `leads_agent_id_fkey` (fallback when negocio has no assigned consultant)

⚠️ The `leads` table only has `nome` (not `name`) and `telemovel` (not `phone_primary`). Don't request the missing columns or the whole select fails silently and the route 500s.

---

## Hard exclusions (DB query)

Done in Postgres before any scoring:

```ts
.in('tipo', ['Compra', 'Compra e Venda'])
.not('estado', 'in', '("Fechado","Cancelado","Perdido")')
.limit(100)
```

- Only buyer-side negocios
- Excludes terminal states
- Already-linked negocios are excluded from `suggestions` (they go to `linked` instead)

Property fields fetched: `listing_price, property_type, city, zone`. **Bedrooms / area / amenities are NOT fetched** — bedroom matching does not currently exist.

---

## Scoring (per candidate)

For each candidate the scorer evaluates **three independent signals** — type, location, budget — and tracks both a numeric `score` and a per-signal status enum.

```
typeOk    : 'exact' | 'compatible' | 'mismatch' | 'unknown'
locOk     : 'match' | 'mismatch' | 'unknown'
budgetOk  : 'match' | 'mismatch' | 'unknown'
```

### Type signal

```ts
const TYPE_ACCEPTS: Record<string, string[]> = {
  apartamento: ['moradia', 'duplex', 'loft'],
  duplex: ['apartamento', 'moradia'],
  loft: ['apartamento'],
  moradia: ['moradia geminada', 'moradia banda', 'quinta'],
  loja: ['armazem'],
  armazem: ['loja'],
}
```

The map is **asymmetric** by design. `apartamento → ['moradia', ...]` means an apartment seeker is also open to moradias. There is no `moradia → ['apartamento']` entry because moradia seekers usually only want moradias.

Each entry only lists *additional* types beyond the exact match. The exact-match check runs first, so a key never needs to list itself.

| Condition | tier | score |
|---|---|---|
| `buyerType` includes `propType` (or vice versa) | `exact` | +30 |
| `propType` matches an entry in `TYPE_ACCEPTS[buyerType]` | `compatible` | +15 |
| Both sides set, no overlap, not in map | `mismatch` | excluded |
| Either side missing | `unknown` | 0 |

**Editing the map:** open the route file and add/remove entries in `TYPE_ACCEPTS`. No restart needed beyond the dev server reload. The `compatible` tier surfaces in the UI as an amber "compatível" badge.

### Location signal

```ts
if (buyerLoc && (propCity || propZone)) {
  const cityHit = propCity && buyerLoc.includes(propCity)
  const zoneHit = propZone && buyerLoc.includes(propZone)
  if (cityHit || zoneHit) locOk = 'match'  // +30 city, +20 zone
  else                    locOk = 'mismatch'
}
```

Pure substring (case-insensitive). No geographic awareness — "Cascais" matches "Cascais" but not "Estoril" even though they're 5 km apart.

To make this smarter, see the brainstorm in the chat history (static adjacency map, geoapi.pt concelho hierarchy, lat/lng distance). Not implemented yet.

### Budget signal

```ts
const ratio = price / budget   // budget = orcamento_max ?? orcamento
```

| Ratio | flag | tier | score |
|---|---|---|---|
| ≤ 1.05 | `green` | `match` | +30 |
| ≤ 1.15 | `yellow` | `match` | +20 |
| ≤ 1.25 | `orange` | `match` | +10 |
| > 1.25 | `red` | `mismatch` | excluded |

Buyer's max budget must cover at least 80% of the listing price. The asymmetric tolerance (only allowing budget *above* price by up to 25%) reflects how negotiations work — buyers won't reach far above their stated max, but properties often sell below ask.

---

## Final filter

```ts
suggestions = scored
  .filter(n => {
    if (n._typeOk === 'mismatch') return false
    if (n._locOk === 'mismatch') return false
    if (n._budgetOk === 'mismatch') return false
    // Need at least one positive signal — all-unknown is excluded
    const typePositive = n._typeOk === 'exact' || n._typeOk === 'compatible'
    return typePositive || n._locOk === 'match' || n._budgetOk === 'match'
  })
  .sort((a, b) => b._score - a._score)
  .slice(0, 25)
```

**Rules:**
1. Any explicit `mismatch` on type, location, or budget kills the row.
2. At least one signal must be positive (`exact` or `compatible` for type; `match` for location/budget). All-unknown buyers are excluded — otherwise the list would fill with negocios that have nothing in common with the property.
3. Sorted by descending score, capped at 25 results.

---

## Frontend cards

Each row shows (left to right):

- **First name** of the buyer's lead
- **Type/typology badge** (gray) — `{tipo_imovel} · T{quartos_min}+`
- **"compatível" badge** (amber) — only when `type_match === 'compatible'`
- **Budget badge** (green) — `até {formatCurrency(maxBudget)}`
- **Location badge** (blue) — buyer's `localizacao` text, with map-pin icon, truncated
- (When the lead is not yours) the colleague's name on the second line
- Action icons: phone, WhatsApp, email, agendar visita, hide/show

The list is grouped into **Os meus leads** (where the negocio's `assigned_consultant_id` or `lead.agent_id` equals the current user) and **Leads de colegas**, with a colleague filter chip row when there are 2+ unique colleagues.

---

## Common reasons no buyers show up

1. **`leads` column rename** — the query references `leads.name` or `leads.phone_primary`, neither exists. Fixed in this codebase but worth checking if you ever extend the select.
2. **Wrong FK name** — the negocios → consultant join must use `negocios_assigned_consultant_id_fkey`, not `negocios_agent_id_fkey` (which doesn't exist). Same trap broke the route once.
3. **URL slug instead of UUID** — the property page has slug URLs but the API expects UUIDs. The fix is to wait for the resolved `property.id` (UUID) before firing sub-resource fetches. See the `propertyId = property?.id` pattern in the page file.
4. **All buyers fail the filter** — most often because every candidate has empty `tipo_imovel` AND empty `localizacao` AND no budget vs price overlap, so `typePositive || locOk === 'match' || budgetOk === 'match'` is false everywhere. Loosening the requirement would mean letting through buyers with zero positive signals, which is rarely what you want — better to populate the missing fields on the negocios.

---

## Where to make changes

| You want to... | Edit |
|---|---|
| Allow new asymmetric type pairs | `TYPE_ACCEPTS` constant in the route file |
| Loosen/tighten budget bands | The `ratio` ladder in the budget signal block |
| Add a new signal (e.g. bedrooms, area) | Add another `*Ok` enum + scoring branch + extend property `select()` to fetch the spec column |
| Change the result cap | `.slice(0, 25)` |
| Add a frontend chip | Surface the field in the route's final `.map(...)` return, pull it into `buildRow` in the page file, render it next to the existing badges |
| Group by something other than mine vs colleagues | Edit the section split in the IIFE that returns the rendered list — search for `myBuyers = all.filter(r => r.isMine)` |

---

**Last updated:** 2026-04-07
