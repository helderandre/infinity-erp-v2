import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMAIL_ADMIN_ROLES } from '@/lib/auth/roles'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

export interface ResolvedAccount {
  account: {
    id: string
    consultant_id: string
    email_address: string
    display_name: string
    encrypted_password: string
    smtp_host: string
    smtp_port: number
    smtp_secure: boolean
    imap_host: string
    imap_port: number
    imap_secure: boolean
    is_verified: boolean
    is_active: boolean
    last_sync_at: string | null
    last_error: string | null
    created_at: string
    updated_at: string
  }
  password: string
  userId: string
  isEmailAdmin: boolean
}

/**
 * Check if the current user has email admin privileges (can access all accounts).
 */
export async function isUserEmailAdmin(userId: string): Promise<boolean> {
  const adminDb = createAdminClient()
  const { data: userRoles } = await adminDb
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', userId)

  if (!userRoles) return false

  return userRoles.some((ur) => {
    const roleName = (ur.role as unknown as { name: string })?.name
    return EMAIL_ADMIN_ROLES.some(
      (ar) => ar.toLowerCase() === roleName?.toLowerCase()
    )
  })
}

/**
 * Resolve the email account for the current request — strict owner-only.
 *
 * Política (definida pelo Duarte em 2026-04-26):
 *   "Quero que cada pessoa veja só o seu próprio email, independentemente de
 *    ser gestão ou não. Quando os processos precisam de enviar email a partir
 *    da conta de outro utilizador, isso passa pelo path service-role
 *    (`resolveEmailAccountById`) — não por aqui."
 *
 * Implicações:
 * - Independentemente do `isEmailAdmin`, este resolver SÓ devolve contas
 *   onde `consultant_id = auth.uid()`.
 * - O flag `isEmailAdmin` continua exposto no resultado para a UI poder
 *   mostrar/esconder ferramentas de gestão noutros contextos, mas NÃO afecta
 *   a resolução da conta.
 * - O envio automatizado em background (node-processors / spawner) usa
 *   `resolveEmailAccountById` em [lib/email/resolve-account-admin.ts] que é
 *   service-role e não toca neste path.
 */
export async function resolveEmailAccount(
  accountId?: string | null
): Promise<
  | { ok: true; data: ResolvedAccount }
  | { ok: false; error: string; status: number }
> {
  if (!ENCRYPTION_KEY) {
    return { ok: false, error: 'ENCRYPTION_KEY não configurada', status: 500 }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Não autorizado', status: 401 }
  }

  const adminDb = createAdminClient()
  // Mantemos o lookup do flag para outras superfícies da UI (ex.: mostrar
  // dashboards de gestão), mas ele não influencia a resolução abaixo.
  const emailAdmin = await isUserEmailAdmin(user.id)

  // Owner-only: a query por si só já restringe a conta ao próprio.
  let query = adminDb
    .from('consultant_email_accounts')
    .select('*')
    .eq('is_verified', true)
    .eq('is_active', true)
    .eq('consultant_id', user.id)

  if (accountId) {
    query = query.eq('id', accountId)
  }

  const { data: account, error: accError } = await query
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (accError || !account) {
    return {
      ok: false,
      error: 'Conta de email não configurada ou não verificada',
      status: 404,
    }
  }

  // Defesa extra (paranoia) — se alguma vez a query mudar, este invariante
  // continua a falhar fechado em vez de devolver dados de outro utilizador.
  if (account.consultant_id !== user.id) {
    return {
      ok: false,
      error: 'Sem permissão para aceder a esta conta de email',
      status: 403,
    }
  }

  // Decrypt password
  const { data: password, error: decError } = await adminDb.rpc(
    'decrypt_email_password',
    {
      p_encrypted: account.encrypted_password,
      p_key: ENCRYPTION_KEY,
    }
  )

  if (decError || !password) {
    return {
      ok: false,
      error: 'Erro ao desencriptar credenciais',
      status: 500,
    }
  }

  return {
    ok: true,
    data: {
      account,
      password,
      userId: user.id,
      isEmailAdmin: emailAdmin,
    },
  }
}
