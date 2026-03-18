import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySmtp } from '@/lib/email/smtp-client'
import { verifyImap } from '@/lib/email/imap-client'
import { z } from 'zod'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

const setupSchema = z.object({
  email_address: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  display_name: z.string().min(1, 'Nome de exibição é obrigatório'),
  smtp_host: z.string().optional().default('mail.sooma.com'),
  smtp_port: z.number().optional().default(465),
  imap_host: z.string().optional().default('mail.sooma.com'),
  imap_port: z.number().optional().default(993),
})

/**
 * GET /api/email/account — Get current user's email account
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminDb = createAdminClient()
    const { data, error } = await adminDb
      .from('consultant_email_accounts')
      .select('id, consultant_id, email_address, display_name, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, is_verified, is_active, last_sync_at, last_error, created_at, updated_at')
      .eq('consultant_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[email/account] GET error:', error)
      return NextResponse.json({ error: 'Erro ao buscar conta' }, { status: 500 })
    }

    return NextResponse.json({ account: data })
  } catch (err) {
    console.error('[email/account] GET exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/email/account — Setup/verify email account
 */
export async function POST(req: Request) {
  try {
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY não configurada no servidor' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { email_address, password, display_name, smtp_host, smtp_port, imap_host, imap_port } = parsed.data

    // 1. Verify SMTP connection
    const smtpResult = await verifySmtp({
      host: smtp_host,
      port: smtp_port,
      secure: true,
      user: email_address,
      pass: password,
    })

    if (!smtpResult.ok) {
      return NextResponse.json({
        error: 'Falha na verificação SMTP',
        detail: smtpResult.error,
        step: 'smtp',
      }, { status: 422 })
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
      return NextResponse.json({
        error: 'Falha na verificação IMAP',
        detail: imapResult.error,
        step: 'imap',
      }, { status: 422 })
    }

    // 3. Encrypt password and save
    const adminDb = createAdminClient()

    // Encrypt password via SQL function
    const { data: encResult, error: encError } = await adminDb
      .rpc('encrypt_email_password', { p_password: password, p_key: ENCRYPTION_KEY })

    if (encError || !encResult) {
      console.error('[email/account] Encryption error:', encError)
      return NextResponse.json({ error: 'Erro ao encriptar credenciais' }, { status: 500 })
    }

    // Upsert account (one per consultant)
    const { data: account, error: upsertError } = await adminDb
      .from('consultant_email_accounts')
      .upsert({
        consultant_id: user.id,
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
      }, { onConflict: 'consultant_id' })
      .select('id, email_address, display_name, is_verified, is_active, created_at, updated_at')
      .single()

    if (upsertError) {
      console.error('[email/account] Upsert error:', upsertError)
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
 * DELETE /api/email/account — Remove email account
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminDb = createAdminClient()
    const { error } = await adminDb
      .from('consultant_email_accounts')
      .delete()
      .eq('consultant_id', user.id)

    if (error) {
      console.error('[email/account] DELETE error:', error)
      return NextResponse.json({ error: 'Erro ao eliminar conta' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Conta de email removida.' })
  } catch (err) {
    console.error('[email/account] DELETE exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
