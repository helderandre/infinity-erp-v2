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
 * Resolve the email account for the current request.
 *
 * - If `accountId` is provided and user is email admin → use that account
 * - If `accountId` is provided and user is NOT admin → only allow if it's their own account
 * - If `accountId` is not provided → use user's first active/verified account
 *
 * Returns null with an error message if resolution fails.
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
  const emailAdmin = await isUserEmailAdmin(user.id)

  // Build query
  let query = adminDb
    .from('consultant_email_accounts')
    .select('*')
    .eq('is_verified', true)
    .eq('is_active', true)

  if (accountId) {
    // Specific account requested
    query = query.eq('id', accountId)
  } else {
    // Default: user's own account
    query = query.eq('consultant_id', user.id)
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

  // Authorization check: non-admin can only access own accounts
  if (!emailAdmin && account.consultant_id !== user.id) {
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
