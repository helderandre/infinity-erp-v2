import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * DELETE /api/properties/[id]/presentation/[presentationId]
 * Removes a single brochure/presentation row. The PDF blob in R2 is left in
 * place (presigned URLs eventually expire) — this is a best-effort cleanup of
 * the database row only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; presentationId: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, presentationId } = await params
    const admin = createAdminClient() as any

    const { error } = await admin
      .from('property_presentations')
      .delete()
      .eq('id', presentationId)
      .eq('property_id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar brochura', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[presentation DELETE] erro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
