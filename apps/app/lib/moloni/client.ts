// ─── Moloni HTTP client ─────────────────────────────────────────────────────
// The single most important file: everything else calls `moloniPost()`.
//
// Quirks handled here (see moloni-integration-portable-spec.md):
//   • Every endpoint is POST, even "get" ones.
//   • access_token goes in the query string, not a header.
//   • company_id must be in every body — injected automatically.
//   • Errors come back as HTTP 200 with an array [{ code, description }].
//   • Password grant (undocumented) is preferred for server-to-server.
//   • Tokens auto-refresh with a 5-minute buffer; first run bootstraps via
//     password grant and picks the real company (skipping Moloni's demo ID 5).
//
// Token persistence: single row in `moloni_tokens` (service-role only).

import { createAdminClient } from '@/lib/supabase/admin'
import {
  MoloniError,
  type MoloniCompany,
  type MoloniGrantResponse,
  type MoloniTokenRow,
} from './types'

const MOLONI_API_BASE = 'https://api.moloni.pt/v1'
const REFRESH_BUFFER_MS = 5 * 60_000

/** True when all credentials needed for the password grant are present. */
export function moloniConfigured(): boolean {
  return !!(
    process.env.MOLONI_DEVELOPER_ID &&
    process.env.MOLONI_CLIENT_SECRET &&
    process.env.MOLONI_USERNAME &&
    process.env.MOLONI_PASSWORD
  )
}

// ─── OAuth grants ────────────────────────────────────────────────────────────

async function authenticateWithPassword(): Promise<MoloniGrantResponse> {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.MOLONI_DEVELOPER_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    username: process.env.MOLONI_USERNAME!,
    password: process.env.MOLONI_PASSWORD!,
  })
  // NOTE: params go in the query string, not the body.
  const res = await fetch(`${MOLONI_API_BASE}/grant/?${params}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) {
    throw new MoloniError([
      { code: res.status, description: `Falha na autenticação Moloni: ${json?.error_description ?? json?.error ?? res.statusText}` },
    ])
  }
  return json as MoloniGrantResponse
}

async function refreshAccessToken(refreshToken: string): Promise<MoloniGrantResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.MOLONI_DEVELOPER_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    refresh_token: refreshToken,
  })
  const res = await fetch(`${MOLONI_API_BASE}/grant/?${params}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) {
    throw new MoloniError([
      { code: res.status, description: `Falha ao renovar token Moloni (re-autenticar): ${json?.error_description ?? res.statusText}` },
    ])
  }
  return json as MoloniGrantResponse
}

// ─── Token persistence (service role) ────────────────────────────────────────

async function loadToken(): Promise<MoloniTokenRow | null> {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('moloni_tokens')
    .select('company_id, access_token, refresh_token, expires_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as MoloniTokenRow) ?? null
}

async function saveToken(row: {
  company_id: number
  access_token: string
  refresh_token: string
  expires_in: number
}): Promise<void> {
  const admin = createAdminClient() as any
  const expires_at = new Date(Date.now() + row.expires_in * 1000).toISOString()
  const { error } = await admin
    .from('moloni_tokens')
    .upsert(
      {
        company_id: row.company_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    )
  if (error) throw new MoloniError([{ code: 500, description: `Erro a guardar token: ${error.message}` }])
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function getCompanies(accessToken: string): Promise<MoloniCompany[]> {
  const res = await fetch(
    `${MOLONI_API_BASE}/companies/getAll/?access_token=${encodeURIComponent(accessToken)}&json=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  )
  const json = await res.json().catch(() => null)
  if (!Array.isArray(json)) {
    throw new MoloniError([{ code: res.status, description: 'Não foi possível listar empresas Moloni' }])
  }
  return json as MoloniCompany[]
}

/**
 * Choose the Moloni company to emit from. Priority:
 *   1. MOLONI_COMPANY_ID (explicit — use when the account has several companies)
 *   2. the company matching MOLONI_USERNAME's email
 *   3. the first non-demo company (demo is ID 5)
 */
export function pickCompany(companies: MoloniCompany[]): MoloniCompany {
  const explicitId = process.env.MOLONI_COMPANY_ID?.trim()
  if (explicitId) {
    const byId = companies.find((c) => String(c.company_id) === explicitId)
    if (byId) return byId
  }
  const email = process.env.MOLONI_USERNAME
  if (email) {
    const match = companies.find((c) => c.email === email)
    if (match) return match
  }
  const real = companies.filter((c) => c.company_id !== 5)
  return real[0] ?? companies[0]
}

// ─── Valid-token resolver (serialized to avoid refresh races) ────────────────
// Moloni rotates the refresh_token on each use, so two concurrent refreshes
// would invalidate one another. We serialize token acquisition per process.

let tokenChain: Promise<unknown> = Promise.resolve()

function withTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tokenChain.then(fn, fn)
  tokenChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function getValidToken(): Promise<{ accessToken: string; companyId: number }> {
  return withTokenLock(async () => {
    const row = await loadToken()

    // First run: bootstrap via password grant + pick the real company.
    if (!row) {
      const tokens = await authenticateWithPassword()
      const companies = await getCompanies(tokens.access_token)
      if (companies.length === 0) {
        throw new MoloniError([{ code: 404, description: 'Nenhuma empresa Moloni associada a esta conta' }])
      }
      const company = pickCompany(companies)
      await saveToken({ company_id: company.company_id, ...tokens })
      return { accessToken: tokens.access_token, companyId: company.company_id }
    }

    // Refresh with a 5-minute buffer.
    if (Date.now() + REFRESH_BUFFER_MS >= new Date(row.expires_at).getTime()) {
      try {
        const fresh = await refreshAccessToken(row.refresh_token)
        await saveToken({ company_id: row.company_id, ...fresh })
        return { accessToken: fresh.access_token, companyId: row.company_id }
      } catch {
        // Refresh token likely expired (14-day TTL) — fall back to password grant.
        const tokens = await authenticateWithPassword()
        await saveToken({ company_id: row.company_id, ...tokens })
        return { accessToken: tokens.access_token, companyId: row.company_id }
      }
    }

    return { accessToken: row.access_token, companyId: row.company_id }
  })
}

/** Resolve + return the current Moloni company (bootstraps on first call). */
export async function getActiveCompany(): Promise<{ companyId: number; name: string }> {
  const { accessToken, companyId } = await getValidToken()
  const companies = await getCompanies(accessToken)
  const match = companies.find((c) => c.company_id === companyId)
  return { companyId, name: match?.name ?? `Empresa #${companyId}` }
}

// ─── The one function you'll call from everywhere ────────────────────────────

export async function moloniPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  if (!moloniConfigured()) {
    throw new MoloniError([{ code: -1, description: 'Moloni não configurado (faltam variáveis MOLONI_*)' }])
  }

  const { accessToken, companyId } = await getValidToken()
  if (body.company_id == null) body.company_id = companyId

  const url = `${MOLONI_API_BASE}/${endpoint}/?access_token=${encodeURIComponent(
    accessToken,
  )}&json=true&human_errors=true`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)

  // Critical: Moloni returns errors as an array of { code, description } with
  // HTTP 200. Detect that shape before treating the response as success.
  if (Array.isArray(json) && json.length > 0 && json[0]?.code !== undefined) {
    throw new MoloniError(json as Array<{ code: number; description: string }>)
  }
  if (!res.ok) {
    throw new MoloniError([{ code: res.status, description: `HTTP ${res.status} em ${endpoint}` }])
  }

  return json as T
}
