# Moloni Integration — Portable Implementation Spec

> A framework-agnostic spec for integrating the Moloni v1 REST API into any Node/TypeScript app. Covers authentication, customers, products, invoices, receipts, credit notes, and all the non-obvious gotchas discovered while building the MUBE CRM integration.

**Target stack assumption:** Node.js 18+ with `fetch`. Adapts trivially to Next.js, Express, NestJS, Hono, etc. Storage examples use Supabase/Postgres but any key-value store works for tokens.

---

## 1. What Moloni Is and Why It's Weird

Moloni is a Portuguese invoicing platform certified by the Tax Authority (AT). Invoices issued with `status: 1` (closed) are automatically reported to the AT and become legally binding fiscal documents.

### API quirks you must know

| Quirk | Impact |
|---|---|
| **Every endpoint is `POST`** | Even "get" endpoints. Use a single `moloniPost()` helper. |
| **Token in query string**, not header | `?access_token=XYZ` on every call. |
| **Error responses look like success** | Errors come back as HTTP 200 with an array `[{code, description}]`. Must detect manually. |
| **`company_id` must be in every body** | Inject automatically in the HTTP helper. |
| **Password grant exists but is undocumented** | Preferred for server-to-server (no OAuth redirect needed). |
| **`customers/insert` silently fails** if you don't pass a pile of "zero" fields | `salesman_id`, `payment_day`, `discount`, `credit_limit`, `delivery_method_id` all required even though they're optional. |
| **`invoices/insert` requires a `product_id`** on every line — you cannot invoice an ad-hoc description | Must create a product first. |
| **`getPDFLink` returns HTML**, not a PDF URL | HTML page with a `<meta refresh>` pointing to the real download. |
| **Credit notes require `related_id`** per product line | Not the invoice's `document_id` — the per-line `document_product_id` from `invoices/getOne`. |
| **`receipts/insert` requires `net_value` + `expiration_date`** | Omitting either returns a cryptic error. |
| **Demo company is ID 5** | Skip it when picking the user's real company. |

---

## 2. Environment Variables

```env
# Moloni credentials (get from https://www.moloni.pt/ac/developers/)
MOLONI_DEVELOPER_ID=         # numeric client ID
MOLONI_CLIENT_SECRET=        # secret string
MOLONI_USERNAME=             # Moloni login email (password grant)
MOLONI_PASSWORD=             # Moloni password (password grant)

# Only needed if using the interactive OAuth flow instead of password grant
MOLONI_REDIRECT_URI=https://yourapp.com/api/moloni/callback

# Optional: Portuguese NIF lookup (https://www.nif.pt/ — €5/month)
NIF_PT_API_KEY=
```

**Recommendation:** use password grant. The authorization code flow adds UI friction with zero benefit for a single-company integration.

---

## 3. Database Schema

You need exactly two things stored:

### `moloni_tokens` — one row per company
```sql
create table moloni_tokens (
  id            uuid primary key default gen_random_uuid(),
  company_id    int not null unique,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);
```

### Link Moloni IDs back to your domain entities
```sql
-- on your clients/customers table
alter table clients add column moloni_customer_id int;

-- on your invoices table
alter table invoices add column moloni_document_id int;
alter table invoices add column moloni_document_type text;  -- "invoice" | "receipt" | "credit_note"
alter table invoices add column moloni_status int;          -- 0=draft, 1=closed, 2=cancelled
alter table invoices add column moloni_pdf_url text;
```

---

## 4. The HTTP Client

This is the single most important file. Everything else calls `moloniPost()`.

```typescript
// lib/moloni/client.ts
const MOLONI_API_BASE = "https://api.moloni.pt/v1"

// ─── OAuth ────────────────────────────────────────────────────────────────

export async function authenticateWithPassword() {
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.MOLONI_DEVELOPER_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    username: process.env.MOLONI_USERNAME!,
    password: process.env.MOLONI_PASSWORD!,
  })
  // NOTE: params go in the query string, not the body
  const res = await fetch(`${MOLONI_API_BASE}/grant/?${params}`)
  if (!res.ok) throw new Error(`Moloni password auth failed: ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.MOLONI_DEVELOPER_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    refresh_token: refreshToken,
  })
  const res = await fetch(`${MOLONI_API_BASE}/grant/?${params}`)
  if (!res.ok) throw new Error(`Moloni token refresh failed: ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

// ─── Token persistence (replace with your own store) ─────────────────────

async function loadToken(): Promise<{
  company_id: number
  access_token: string
  refresh_token: string
  expires_at: string
} | null> {
  // e.g. supabase.from("moloni_tokens").select("*").single()
  throw new Error("implement loadToken")
}

async function saveToken(row: {
  company_id: number
  access_token: string
  refresh_token: string
  expires_in: number
}) {
  const expires_at = new Date(Date.now() + row.expires_in * 1000).toISOString()
  // upsert on company_id
  throw new Error("implement saveToken")
}

// ─── Companies ───────────────────────────────────────────────────────────

export async function getCompanies(accessToken: string) {
  const url = `${MOLONI_API_BASE}/companies/getAll/?access_token=${accessToken}&json=true`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  return res.json() as Promise<Array<{
    company_id: number
    name: string
    vat: string
    email: string
  }>>
}

/** Skip Moloni's demo company (ID 5) and prefer the one matching MOLONI_USERNAME. */
export function pickCompany(companies: Array<{ company_id: number; email: string }>) {
  const email = process.env.MOLONI_USERNAME
  if (email) {
    const match = companies.find((c) => c.email === email)
    if (match) return match
  }
  const real = companies.filter((c) => c.company_id !== 5)
  return real[0] ?? companies[0]
}

// ─── Valid token resolver with auto-refresh and first-run bootstrap ──────

async function getValidToken(): Promise<{ accessToken: string; companyId: number }> {
  const row = await loadToken()

  // First run: bootstrap via password grant
  if (!row) {
    const tokens = await authenticateWithPassword()
    const companies = await getCompanies(tokens.access_token)
    if (companies.length === 0) throw new Error("No Moloni companies for this account")
    const company = pickCompany(companies)
    await saveToken({ company_id: company.company_id, ...tokens })
    return { accessToken: tokens.access_token, companyId: company.company_id }
  }

  // Refresh with 5-minute buffer
  const expiresAt = new Date(row.expires_at).getTime()
  if (Date.now() + 5 * 60_000 >= expiresAt) {
    const fresh = await refreshAccessToken(row.refresh_token)
    await saveToken({ company_id: row.company_id, ...fresh })
    return { accessToken: fresh.access_token, companyId: row.company_id }
  }

  return { accessToken: row.access_token, companyId: row.company_id }
}

// ─── The one function you'll call from everywhere ────────────────────────

export async function moloniPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const { accessToken, companyId } = await getValidToken()
  if (body.company_id == null) body.company_id = companyId

  const url = `${MOLONI_API_BASE}/${endpoint}/?access_token=${accessToken}&json=true&human_errors=true`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const json = await res.json()

  // Critical: Moloni returns errors as an array of {code, description}
  // with HTTP 200. Check for this shape before treating as success.
  if (Array.isArray(json) && json.length > 0 && json[0]?.code !== undefined) {
    throw new MoloniError(json)
  }
  return json as T
}

export class MoloniError extends Error {
  errors: Array<{ code: number; description: string }>
  constructor(errors: Array<{ code: number; description: string }>) {
    super(`Moloni API error: ${errors.map((e) => `[${e.code}] ${e.description}`).join("; ")}`)
    this.name = "MoloniError"
    this.errors = errors
  }
}
```

---

## 5. Customers

### Finding by NIF (Portuguese tax ID)

```typescript
export async function getCustomerByVat(vat: string) {
  return moloniPost<Array<{ customer_id: number; name: string; /* ... */ }>>(
    "customers/getByVat",
    { vat }
  )
}
```

### Creating a customer — the required "zero" fields

This is the #1 gotcha. Moloni's docs say most of these are optional. They are not.

```typescript
export async function insertCustomer(data: {
  name: string
  vat: string                  // NIF; use "999999990" for "Consumidor Final"
  email?: string
  address?: string
  city?: string
  zip_code?: string
  phone?: string
}) {
  // You must fetch the next sequential customer number
  const { number } = await moloniPost<{ number: string }>("customers/getNextNumber")

  return moloniPost<{ customer_id: number }>("customers/insert", {
    ...data,
    number,
    language_id: 1,        // 1 = Portuguese
    country_id: 1,         // 1 = Portugal
    // ─── REQUIRED but ignored — set to 0 ──────────────────
    maturity_date_id: 0,
    payment_method_id: 0,
    delivery_method_id: 0,
    document_type_id: 0,
    salesman_id: 0,
    payment_day: 0,
    discount: 0,
    credit_limit: 0,
  })
}
```

### NIF.pt enrichment (optional but recommended)

Portuguese companies publish NIF, name, address, and postal code to a public registry. The nif.pt API gives you this:

```typescript
async function lookupNif(nif: string) {
  const apiKey = process.env.NIF_PT_API_KEY
  if (!apiKey) return null
  const res = await fetch(`https://www.nif.pt/?json=1&q=${nif}&key=${apiKey}`)
  if (!res.ok) return null
  const data = await res.json()
  const record = data.records?.[nif]
  if (!record) return null
  return {
    name: record.title,
    address: record.address,
    city: record.city,
    zip_code: record.pc4 && record.pc3 ? `${record.pc4}-${record.pc3}` : undefined,
  }
}
```

### The idempotent sync pattern

When your app needs to invoice a client:

```typescript
export async function syncClientToMoloni(client: {
  full_name: string
  company_name?: string | null
  nif?: string | null
  email?: string | null
  address?: string | null
  phone?: string | null
}): Promise<number> {
  // 1. Already in Moloni? Return existing ID.
  if (client.nif) {
    const existing = await getCustomerByVat(client.nif)
    if (existing.length > 0) return existing[0].customer_id
  }

  // 2. Enrich with NIF.pt if possible
  const enriched = client.nif && client.nif !== "999999990"
    ? await lookupNif(client.nif)
    : null

  // 3. Create. Prefer app data over enriched.
  const created = await insertCustomer({
    name: enriched?.name || client.company_name || client.full_name,
    vat: client.nif || "999999990",
    email: client.email ?? undefined,
    address: client.address || enriched?.address,
    city: enriched?.city,
    zip_code: enriched?.zip_code,
    phone: client.phone ?? undefined,
  })
  return created.customer_id
}
```

Always store `moloni_customer_id` on your local record so you never re-sync.

---

## 6. Products — why you need them and how to auto-manage them

Moloni's invoice line items are strongly typed to product records. Even a one-off service must reference a `product_id`. Solution: auto-create a product the first time a given service name is invoiced, then reuse it.

### Pattern: one product per unique service description

```typescript
export async function ensureServiceProduct(
  name: string,
  price: number,
  taxId: number
): Promise<number> {
  // Stable reference from the name
  const reference = `SRV-${name.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase().slice(0, 20)}`

  const existing = await moloniPost<Array<{ product_id: number }>>(
    "products/getByReference",
    { reference }
  )
  if (existing.length > 0) return existing[0].product_id

  // Ensure the category exists
  const categoryId = await ensureServiceCategory()
  // Find the "Unidade" measurement unit
  const units = await moloniPost<Array<{ unit_id: number; name: string }>>(
    "measurementUnits/getAll", {}
  )
  const unitId = units.find((u) => u.name === "Unidade")?.unit_id ?? units[0]?.unit_id ?? 1

  const product = await moloniPost<{ product_id: number }>("products/insert", {
    name,
    reference,
    price,
    category_id: categoryId,
    unit_id: unitId,
    type: 2,          // 1=Product, 2=Service
    has_stock: 0,
    stock: 0,
    taxes: [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }],
  })
  return product.product_id
}

async function ensureServiceCategory(): Promise<number> {
  const categories = await moloniPost<Array<{ category_id: number; name: string }>>(
    "productCategories/getAll", {}
  )
  const found = categories.find((c) => c.name === "Serviços")
  if (found) return found.category_id
  const created = await moloniPost<{ category_id: number }>("productCategories/insert", {
    parent_id: 0,
    name: "Serviços",
    description: "Serviços prestados",
  })
  return created.category_id
}
```

---

## 7. Document Sets and Taxes — read once, cache per request

Moloni organizes invoices into "document sets" (sequential numbering series). You pick one per document. Most accounts have a single set. Taxes are a separate catalog.

```typescript
export async function getDocumentSets() {
  return moloniPost<Array<{ document_set_id: number; name: string }>>("documentSets/getAll")
}

export async function getTaxes() {
  // type: 1 = IVA (VAT), 2 = Retenção, etc.
  return moloniPost<Array<{ tax_id: number; name: string; value: number; type: number }>>(
    "taxes/getAll"
  )
}

// Find the IVA tax ID for a given rate
const taxes = await getTaxes()
const iva23 = taxes.find((t) => t.type === 1 && t.value === 23)
if (!iva23) throw new Error("IVA 23% not configured in Moloni")
```

---

## 8. Issuing an Invoice — the full flow

```typescript
// lib/moloni/invoices.ts
export async function createMoloniInvoice(params: {
  customerId: number
  documentSetId: number
  date: string               // "YYYY-MM-DD"
  expirationDate: string     // "YYYY-MM-DD"
  description: string
  amount: number             // net (excl. tax)
  taxId: number
  taxValue: number
  productId: number
  reference?: string         // your own invoice number
  close?: boolean            // true = report to AT, false = draft
}) {
  return moloniPost<{
    document_id: number
    number: string
    net_value: number
    taxes_value: number
    gross_value: number
  }>("invoices/insert", {
    date: params.date,
    expiration_date: params.expirationDate,
    document_set_id: params.documentSetId,
    customer_id: params.customerId,
    our_reference: params.reference,
    products: [{
      product_id: params.productId,
      name: params.description,
      qty: 1,
      price: params.amount,
      taxes: [{
        tax_id: params.taxId,
        value: params.taxValue,
        order: 1,
        cumulative: 0,
      }],
    }],
    status: params.close ? 1 : 0,  // 1 = closed (reported), 0 = draft
  })
}
```

### ⚠ `status: 1` is irreversible

Once closed, the invoice is reported to the Portuguese Tax Authority. You cannot edit it. Only options are:
- **Cancel** via `documents/documentCancel` (marks it as anulled but it still counts in SAF-T)
- **Issue a credit note** to reverse it

### End-to-end: app invoice → Moloni invoice → PDF → email

```typescript
async function issueInvoiceInMoloni(localInvoiceId: string) {
  const invoice = await db.invoices.findUnique(localInvoiceId)   // your ORM
  const client  = await db.clients.findUnique(invoice.client_id)

  // 1. Ensure client exists in Moloni
  let customerId = client.moloni_customer_id
  if (!customerId) {
    customerId = await syncClientToMoloni(client)
    await db.clients.update(client.id, { moloni_customer_id: customerId })
  }

  // 2. Pull catalogs
  const [sets, taxes] = await Promise.all([getDocumentSets(), getTaxes()])
  const documentSetId = sets[0].document_set_id
  const iva = taxes.find((t) => t.type === 1 && t.value === (invoice.tax_rate ?? 23))!

  // 3. Ensure product
  const productId = await ensureServiceProduct(invoice.description, invoice.amount, iva.tax_id)

  // 4. Create in Moloni
  const today    = new Date().toISOString().slice(0, 10)
  const dueDate  = invoice.due_date ?? today
  const doc = await createMoloniInvoice({
    customerId,
    documentSetId,
    date: today,
    expirationDate: dueDate,
    description: invoice.description,
    amount: invoice.amount,
    taxId: iva.tax_id,
    taxValue: iva.value,
    productId,
    reference: invoice.number,
    close: true,
  })

  // 5. Get the PDF binary
  const pdfBuffer = await downloadDocumentPDF(doc.document_id)

  // 6. Persist Moloni IDs
  await db.invoices.update(invoice.id, {
    moloni_document_id: doc.document_id,
    moloni_document_type: "invoice",
    moloni_status: 1,
    status: "sent",
  })

  return { doc, pdfBuffer }
}
```

---

## 9. Downloading the PDF — the meta refresh trick

`documents/getPDFLink` returns a URL. Fetching that URL returns an **HTML page**, not a PDF. The HTML contains a `<meta http-equiv="refresh" content="URL=...">` pointing to the actual download. You must parse it.

```typescript
export async function downloadDocumentPDF(documentId: number): Promise<Buffer> {
  const { url } = await moloniPost<{ url: string }>("documents/getPDFLink", {
    document_id: documentId,
  })

  // Step 1: fetch the HTML wrapper
  const htmlRes = await fetch(url)
  const html = await htmlRes.text()

  // Step 2: extract the meta refresh target
  const match = html.match(/content="URL=([^"]+)"/)
  if (match) {
    const base = new URL(url)
    const downloadUrl = `${base.origin}/downloads/${match[1]}`
    const pdfRes = await fetch(downloadUrl)
    if (pdfRes.ok) {
      const buffer = Buffer.from(await pdfRes.arrayBuffer())
      // Verify it's actually a PDF — avoid silently saving an HTML error page
      if (buffer.slice(0, 5).toString() === "%PDF-") return buffer
    }
  }

  // Fallback: try direct fetch in case Moloni changes behavior someday
  const fallback = await fetch(url)
  return Buffer.from(await fallback.arrayBuffer())
}
```

---

## 10. Marking as Paid — Receipts

Creating a receipt in Moloni associates a payment with an invoice. This makes the invoice show as paid in the Moloni UI and generates a "Recibo" fiscal document.

```typescript
export async function insertReceipt(data: {
  document_set_id: number
  customer_id: number
  date: string                     // payment date
  net_value: number                // the amount actually received
  notes?: string
  associated_documents: Array<{
    associated_id: number          // the invoice's document_id
    value: number                  // amount being paid off
  }>
  payments: Array<{
    payment_method_id: number
    date: string
    value: number
  }>
}) {
  return moloniPost<{ document_id: number }>("receipts/insert", {
    ...data,
    // ─── Both required, even though docs say optional ───
    expiration_date: data.date,
    status: 1,
  })
}

// Fetch payment methods first (transferência, MB Way, etc.)
export async function getPaymentMethods() {
  return moloniPost<Array<{ payment_method_id: number; name: string }>>(
    "paymentMethods/getAll"
  )
}
```

**Withholding tax:** If your clients withhold IRS (retenção na fonte), `net_value` should be the actual amount received (total − withholding), not the invoice total. The difference stays as an unpaid balance on the invoice in Moloni unless you issue multiple receipts.

---

## 11. Credit Notes — the `document_product_id` trap

Credit notes reverse invoices. Moloni requires each credit note line to reference the specific invoice line it's crediting via `related_id`. That `related_id` is **not** `document_id` — it's `document_product_id`, which you get from `invoices/getOne`.

```typescript
// 1. Fetch the original invoice to get its line items with document_product_id
const original = await moloniPost<{
  document_id: number
  products: Array<{
    document_product_id: number   // ← this is what you need
    product_id: number
    name: string
    qty: number
    price: number
    taxes: Array<{ tax_id: number; value: number; order: number; cumulative: number }>
  }>
}>("invoices/getOne", { document_id: invoiceDocumentId })

// 2. Build the credit note, mapping each original line
await moloniPost("creditNotes/insert", {
  document_set_id: documentSetId,
  customer_id: customerId,
  date: today,
  expiration_date: today,
  status: 1,
  associated_documents: [{
    associated_id: original.document_id,
    value: totalToCredit,
  }],
  products: original.products.map((p) => ({
    product_id: p.product_id,
    related_id: p.document_product_id,   // ← the fix
    name: p.name,
    qty: p.qty,
    price: p.price,
    taxes: p.taxes,
  })),
})
```

---

## 12. Cancelling an Invoice

```typescript
export async function cancelDocument(documentId: number) {
  await moloniPost("documents/documentCancel", { document_id: documentId })
}
```

Cancelled invoices still appear in SAF-T reports and in the Moloni UI (marked as anulled). They cannot be deleted. Prefer credit notes for accounting-correct reversal.

---

## 13. Recurring Billing (cron pattern)

If you need scheduled invoices (monthly subscriptions, retainers, etc.):

```typescript
// Pseudocode — run on a daily cron
async function processBillingSchedules() {
  const now = new Date().toISOString()
  const due = await db.schedules.findMany({
    where: { is_active: true, next_run_at: { lte: now } },
  })

  const [sets, taxes] = await Promise.all([getDocumentSets(), getTaxes()])

  for (const schedule of due) {
    try {
      // 1. Create local invoice draft
      const invoice = await db.invoices.create({ ...schedule, status: "draft" })

      // 2. Issue in Moloni
      const customerId = schedule.client.moloni_customer_id
                      ?? await syncClientToMoloni(schedule.client)
      const iva = taxes.find((t) => t.type === 1 && t.value === schedule.tax_rate)!
      const productId = await ensureServiceProduct(schedule.description, schedule.amount, iva.tax_id)
      const doc = await createMoloniInvoice({
        customerId,
        documentSetId: sets[0].document_set_id,
        date: today(),
        expirationDate: addDays(today(), 30),
        description: schedule.description,
        amount: schedule.amount,
        taxId: iva.tax_id,
        taxValue: iva.value,
        productId,
        close: true,
      })

      // 3. Advance next_run_at
      await db.schedules.update(schedule.id, {
        last_run_at: now,
        next_run_at: calculateNextRun(schedule),
      })
    } catch (err) {
      console.error(`Schedule ${schedule.id} failed`, err)
      // Don't throw — keep processing the rest
    }
  }
}

function calculateNextRun(schedule: { frequency: string; day_of_month: number }): string {
  const next = new Date()
  if (schedule.frequency === "monthly")   next.setMonth(next.getMonth() + 1)
  if (schedule.frequency === "quarterly") next.setMonth(next.getMonth() + 3)
  if (schedule.frequency === "yearly")    next.setFullYear(next.getFullYear() + 1)
  // Clamp day of month so Feb 31 → Feb 28/29
  const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(schedule.day_of_month, daysInMonth))
  next.setHours(9, 0, 0, 0)
  return next.toISOString()
}
```

**Scheduling options:** Supabase pg_cron, Vercel Cron, GitHub Actions, `node-cron`, a cloud scheduler. Whatever you pick, protect the endpoint with a shared-secret bearer token.

---

## 14. Full Endpoint Reference

All endpoints are `POST`, take `access_token` in the query string, and require `company_id` in the body (auto-injected by `moloniPost`).

| Endpoint | Purpose |
|---|---|
| `/grant/` | OAuth (password / authorization_code / refresh_token) |
| `/companies/getAll/` | List companies for the authenticated user |
| `/documentSets/getAll/` | List invoice numbering series |
| `/taxes/getAll/` | List tax rates (IVA, withholding, etc.) |
| `/paymentMethods/getAll/` | List payment methods for receipts |
| `/measurementUnits/getAll/` | List product units |
| `/customers/getAll/` | Paginated customer list |
| `/customers/getByVat/` | Find customer by NIF |
| `/customers/getByName/` | Find customer by name |
| `/customers/getOne/` | Get single customer |
| `/customers/getNextNumber/` | Sequential number for new customer |
| `/customers/insert/` | Create customer (see gotchas) |
| `/customers/update/` | Update customer |
| `/productCategories/getAll/` | List product categories |
| `/productCategories/insert/` | Create product category |
| `/products/getByReference/` | Find product by reference (SKU) |
| `/products/getOne/` | Get product by ID |
| `/products/insert/` | Create product |
| `/invoices/insert/` | Create invoice |
| `/invoices/getOne/` | Get invoice (includes `document_product_id` per line) |
| `/invoices/getAll/` | List invoices |
| `/receipts/insert/` | Mark invoice(s) as paid |
| `/creditNotes/insert/` | Reverse an invoice |
| `/supplierInvoices/insert/` | Record a purchase/expense |
| `/documents/getPDFLink/` | Get document PDF (returns HTML wrapper) |
| `/documents/documentCancel/` | Cancel (anular) a document |

---

## 15. Implementation Checklist

Work through these in order. Each step is testable in isolation.

- [ ] Env vars set, Moloni developer app created
- [ ] `moloni_tokens` table created
- [ ] `moloniPost()` helper with error detection
- [ ] Password grant bootstrap working (`getCompanies` returns your real company)
- [ ] Token auto-refresh verified (manually expire `expires_at` in DB)
- [ ] Customer sync: `getCustomerByVat` → found path
- [ ] Customer sync: `insertCustomer` → new path with all required "zero" fields
- [ ] (Optional) NIF.pt enrichment working
- [ ] Product auto-creation (`ensureServiceProduct`)
- [ ] Single invoice end-to-end (`status: 0` draft first to test safely)
- [ ] PDF download via meta refresh parse
- [ ] `status: 1` invoice reported to AT (verify in Moloni dashboard)
- [ ] Receipt creation against an existing invoice
- [ ] Credit note with correct `document_product_id` mapping
- [ ] Invoice cancellation
- [ ] (Optional) Recurring billing cron
- [ ] Error handling: expired tokens, missing company, rate limits

---

## 16. Gotchas Cheat Sheet

| Symptom | Cause | Fix |
|---|---|---|
| HTTP 200 but result is an error array | Moloni's error format | Check for `Array.isArray(json) && json[0]?.code` before treating as success |
| `customers/insert` returns `[{"code":3,"description":"Missing fields"}]` | Missing "zero" required fields | Pass `salesman_id:0, payment_day:0, discount:0, credit_limit:0, delivery_method_id:0` |
| `invoices/insert` fails with "product not found" | No product reference | Use `ensureServiceProduct()` before `createMoloniInvoice()` |
| Wrong company's invoices being created | Demo company (ID 5) picked | Use `pickCompany()` helper |
| PDF "download" is ~2KB of HTML | That's the meta refresh wrapper | Parse `content="URL=..."` and fetch `{origin}/downloads/{path}` |
| `creditNotes/insert` error on `related_id` | Passed `document_id` instead of `document_product_id` | Fetch original via `invoices/getOne` and use the per-line ID |
| `receipts/insert` "invalid parameters" | Missing `net_value` and/or `expiration_date` | Pass both (set `expiration_date = date`) |
| Token refresh fails after 14 days | Refresh token is expired (14-day TTL) | Re-auth via password grant; make sure `loadToken` bootstrap path handles `null` |
| Invoice created as draft in Moloni | Passed `status: 0` | Pass `status: 1` to report to AT (irreversible!) |

---

## 17. Testing Safely

**Always test with `status: 0` (draft) first.** Draft invoices in Moloni can be deleted freely. Closed (`status: 1`) invoices are reported to the Portuguese Tax Authority and become permanent fiscal documents.

Suggested test sequence:
1. Password auth → verify `companies/getAll` returns your real company
2. `customers/insert` with test NIF `999999990` ("Consumidor Final")
3. `invoices/insert` with `status: 0`, verify in Moloni UI, delete manually
4. `invoices/insert` with `status: 1` — this is your first real fiscal doc
5. `receipts/insert` against that invoice
6. `creditNotes/insert` to reverse a second test invoice
7. `documentCancel` on a third test invoice

Keep a dedicated "Dev/Test" customer in Moloni for all test issuance.

---

*Spec derived from the MUBE CRM implementation. Every gotcha here was discovered while building a production integration — trust them.*

