/**
 * Variante de resolveEmailAccount para contextos service-role (worker, spawner)
 * que não têm sessão Supabase do utilizador. Aceita `accountId` explícito e
 * desencripta a password via RPC sem verificar ownership.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ""

export interface ResolvedAccountAdmin {
  account: {
    id: string
    consultant_id: string
    email_address: string
    display_name: string
    smtp_host: string
    smtp_port: number
    smtp_secure: boolean
    is_verified: boolean
    is_active: boolean
  }
  password: string
}

export async function resolveEmailAccountById(
  supabaseAdmin: SupabaseClient,
  accountId: string,
): Promise<
  | { ok: true; data: ResolvedAccountAdmin }
  | { ok: false; error: string }
> {
  if (!ENCRYPTION_KEY) {
    return { ok: false, error: "ENCRYPTION_KEY não configurada" }
  }

  const { data: account, error } = await (supabaseAdmin as any)
    .from("consultant_email_accounts")
    .select(
      "id, consultant_id, email_address, display_name, encrypted_password, smtp_host, smtp_port, smtp_secure, is_verified, is_active",
    )
    .eq("id", accountId)
    .maybeSingle()

  if (error || !account) {
    return { ok: false, error: error?.message || "Conta SMTP não encontrada" }
  }
  if (!account.is_active || !account.is_verified) {
    return { ok: false, error: "Conta SMTP inactiva ou não verificada" }
  }

  const { data: password, error: decErr } = await (supabaseAdmin as any).rpc(
    "decrypt_email_password",
    { p_encrypted: account.encrypted_password, p_key: ENCRYPTION_KEY },
  )
  if (decErr || !password) {
    return { ok: false, error: "Erro ao desencriptar credenciais" }
  }

  const { encrypted_password: _omit, ...rest } = account
  return { ok: true, data: { account: rest, password } }
}
