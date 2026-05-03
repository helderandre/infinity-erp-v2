import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { personalExpenseUpdateSchema } from '@/lib/validations/personal-expense'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

function r2KeyFromUrl(url: string | null): string | null {
  if (!url) return null
  if (R2_PUBLIC_DOMAIN && url.startsWith(R2_PUBLIC_DOMAIN + '/')) {
    return url.slice(R2_PUBLIC_DOMAIN.length + 1)
  }
  return null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('agent_personal_expenses')
      .select('*')
      .eq('id', id)
      .eq('agent_id', auth.user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter despesa:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const parsed = personalExpenseUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('agent_personal_expenses')
      .update(parsed.data)
      .eq('id', id)
      .eq('agent_id', auth.user.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar despesa:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Lê para apanhar o receipt_url antes do delete (para limpeza do R2).
    const { data: existing } = await (supabase as any)
      .from('agent_personal_expenses')
      .select('id, receipt_url')
      .eq('id', id)
      .eq('agent_id', auth.user.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const { error } = await (supabase as any)
      .from('agent_personal_expenses')
      .delete()
      .eq('id', id)
      .eq('agent_id', auth.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Best-effort R2 cleanup. Falha não bloqueia.
    const key = r2KeyFromUrl(existing.receipt_url)
    if (key) {
      try {
        const s3 = getR2Client()
        await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      } catch (e) {
        console.warn('Falha ao apagar recibo do R2:', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao apagar despesa:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
