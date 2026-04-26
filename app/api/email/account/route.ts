import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUserEmailAdmin } from '@/lib/email/resolve-account'
import { verifySmtp } from '@/lib/email/smtp-client'
import { verifyImap } from '@/lib/email/imap-client'
import { z } from 'zod'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

const ACCOUNT_SELECT =
  'id, consultant_id, email_address, display_name, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, is_verified, is_active, last_sync_at, last_error, created_at, updated_at'

const setupSchema = z.object({
  email_address: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  display_name: z.string().min(1, 'Nome de exibição é obrigatório'),
  smtp_host: z.string().optional().default('mail.sooma.com'),
  smtp_port: z.number().optional().default(465),
  imap_host: z.string().optional().default('mail.sooma.com'),
  imap_port: z.number().optional().default(993),
  /** Admin can create accounts for other consultants */
  consultant_id: z.string().uuid().optional(),
})

/**
 * GET /api/email/account — Devolve apenas as contas do próprio utilizador.
 *
 * Política owner-only (Duarte, 2026-04-26): mesmo administradores de email
 * só vêem as suas próprias contas pela UI. Operações automatizadas em
 * background (node-processors / spawner) usam `resolveEmailAccountById`
 * com service-role, sem passar por este endpoint.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminDb = createAdminClient()
    // Mantemos o flag para que a UI possa decidir se expõe ferramentas de
    // gestão (ex.: criar conta para outro consultor), mas não influencia o
    // que esta resposta devolve.
    const emailAdmin = await isUserEmailAdmin(user.id)

    const { data, error } = await adminDb
      .from('consultant_email_accounts')
      .select(ACCOUNT_SELECT)
      .eq('consultant_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[email/account] GET error:', error)
      return NextResponse.json({ error: 'Erro ao buscar contas' }, { status: 500 })
    }

    const accounts = data || []
    return NextResponse.json({
      accounts,
      is_email_admin: emailAdmin,
      // Backward compat: o frontend antigo lê `account` como conta default.
      account: accounts[0] || null,
    })
  } catch (err) {
    console.error('[email/account] GET exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/email/account — Setup/verify a new email account
 */
export async function POST(req: Request) {
  try {
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada no servidor' }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { email_address, password, display_name, smtp_host, smtp_port, imap_host, imap_port, consultant_id } =
      parsed.data

    // Determine target consultant
    let targetConsultantId = user.id
    if (consultant_id && consultant_id !== user.id) {
      const emailAdmin = await isUserEmailAdmin(user.id)
      if (!emailAdmin) {
        return NextResponse.json(
          { error: 'Sem permissão para criar conta para outro consultor' },
          { status: 403 }
        )
      }
      targetConsultantId = consultant_id
    }

    // Check if this email_address already exists
    const adminDb = createAdminClient()
    const { data: existing } = await adminDb
      .from('consultant_email_accounts')
      .select('id')
      .eq('email_address', email_address)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Este endereço de email já está configurado no sistema' },
        { status: 409 }
      )
    }

    // 1. Verify SMTP connection
    const smtpResult = await verifySmtp({
      host: smtp_host,
      port: smtp_port,
      secure: true,
      user: email_address,
      pass: password,
    })

    if (!smtpResult.ok) {
      return NextResponse.json(
        { error: 'Falha na verificação SMTP', detail: smtpResult.error, step: 'smtp' },
        { status: 422 }
      )
    }

    // 2. Verify IMAP connection
    const imapResult = await verifyImap({
      host: imap_host,
      port: imap_port,
      secure: true,
      user: email_address,
      pass: password,
    })

    if (!imapResult.ok) {
      return NextResponse.json(
        { error: 'Falha na verificação IMAP', detail: imapResult.error, step: 'imap' },
        { status: 422 }
      )
    }

    // 3. Encrypt password and save
    const { data: encResult, error: encError } = await adminDb.rpc('encrypt_email_password', {
      p_password: password,
      p_key: ENCRYPTION_KEY,
    })

    if (encError || !encResult) {
      console.error('[email/account] Encryption error:', encError)
      return NextResponse.json({ error: 'Erro ao encriptar credenciais' }, { status: 500 })
    }

    // Insert new account (no upsert — multiple accounts allowed)
    const { data: account, error: insertError } = await adminDb
      .from('consultant_email_accounts')
      .insert({
        consultant_id: targetConsultantId,
        email_address,
        display_name,
        encrypted_password: encResult,
        smtp_host,
        smtp_port,
        smtp_secure: true,
        imap_host,
        imap_port,
        imap_secure: true,
        is_verified: true,
        is_active: true,
        last_error: null,
      })
      .select('id, consultant_id, email_address, display_name, is_verified, is_active, created_at, updated_at')
      .single()

    if (insertError) {
      console.error('[email/account] Insert error:', insertError)
      return NextResponse.json({ error: 'Erro ao guardar conta' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Conta de email verificada e configurada com sucesso.',
      account,
    })
  } catch (err) {
    console.error('[email/account] POST exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/email/account — Remove an email account
 *
 * Query params: ?id=<account-uuid> (required)
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('id')

    const adminDb = createAdminClient()

    if (accountId) {
      // Delete specific account — check ownership or admin
      const { data: account } = await adminDb
        .from('consultant_email_accounts')
        .select('id, consultant_id')
        .eq('id', accountId)
        .single()

      if (!account) {
        return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
      }

      if (account.consultant_id !== user.id) {
        const emailAdmin = await isUserEmailAdmin(user.id)
        if (!emailAdmin) {
          return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
        }
      }

      const { error } = await adminDb
        .from('consultant_email_accounts')
        .delete()
        .eq('id', accountId)

      if (error) {
        return NextResponse.json({ error: 'Erro ao eliminar conta' }, { status: 500 })
      }
    } else {
      // Legacy: delete all user's accounts
      const { error } = await adminDb
        .from('consultant_email_accounts')
        .delete()
        .eq('consultant_id', user.id)

      if (error) {
        return NextResponse.json({ error: 'Erro ao eliminar conta' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Conta de email removida.' })
  } catch (err) {
    console.error('[email/account] DELETE exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
