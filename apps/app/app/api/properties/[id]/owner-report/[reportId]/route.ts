import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export const runtime = 'nodejs'

// ── DELETE: remover um relatório do histórico ─────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, reportId } = await params
    const admin = createAdminClient() as any
    const { error } = await admin
      .from('owner_activity_reports')
      .delete()
      .eq('id', reportId)
      .eq('property_id', id)

    if (error) {
      return NextResponse.json({ error: 'Erro ao eliminar relatório' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[owner-report DELETE] erro:', error)
    return NextResponse.json({ error: 'Erro ao eliminar relatório' }, { status: 500 })
  }
}
