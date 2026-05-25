/**
 * Types para os dois endpoints internos do meta-api consumidos pelo scope picker:
 *   - GET  /api/internal/scope/preview?connection_id=&include_client=
 *   - POST /api/internal/scope/commit
 *
 * Auth: ambos exigem header X-Admin-Secret. Server-side only.
 */

export interface AdAccountListItem {
  /** Formato "act_<num>" */
  ad_account_id: string
  name: string | null
  currency: string | null
  /** 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, etc. */
  account_status: number | null
  business_id: string | null
}

export interface ScopePreviewPage {
  page_id: string
  page_name: string | null
  /** null quando a Page não está em nenhum Business Manager */
  business: { id: string; name: string | null } | null
}

export interface ScopePreviewBusinessManager {
  id: string
  name: string | null
  owned_ad_accounts: AdAccountListItem[]
  /** Vazio se a preview foi pedida com include_client=false */
  client_ad_accounts: AdAccountListItem[]
}

export interface ScopePreviewCurrentRules {
  /** BMs onde todos os ad_accounts owned são allow por defeito */
  allow_business_managers: string[]
  /** ad_account_ids com allow explícito (override avulsa) */
  allow_ad_accounts: string[]
  /** ad_account_ids com deny explícito (override de BM allow) */
  deny_ad_accounts: string[]
}

export interface ScopePreviewResponse {
  connection_id: string
  tenant_id: string
  pages: ScopePreviewPage[]
  business_managers: ScopePreviewBusinessManager[]
  current_rules: ScopePreviewCurrentRules
  /** Mensagens não-fatais (ex.: "Page X não está em nenhum BM") */
  warnings: string[]
}

export interface CommitScopePayload {
  connection_id: string
  allowed_business_manager_ids: string[]
  allowed_ad_account_ids: string[]
  denied_ad_account_ids: string[]
  /** UUID do user admin que clicou Confirm — para audit em meta.tenant_scopes */
  created_by?: string
}

export interface CommitScopeResponse {
  connection_id: string
  tenant_id: string
  /** Total de regras persistidas (BM + ad_account) */
  total_rules: number
  sync_started: true
}

/**
 * Discriminated union para retornos das server actions.
 * `data` é o payload tipado em sucesso. Erro carrega código string +
 * HTTP status (200..599) quando disponível.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }
