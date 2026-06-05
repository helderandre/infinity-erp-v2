// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { updateReportStatusSchema } from '@/lib/validations/training'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = updateReportStatusSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const updateData: any = {
      status: validation.data.status,
      updated_at: new Date().toISOString(),
    }

    if (validation.data.status === 'resolved' || validation.data.status === 'dismissed') {
      updateData.resolved_by = auth.user.id
      updateData.resolved_at = new Date().toISOString()
      if (validation.data.resolution_note) {
        updateData.resolution_note = validation.data.resolution_note
      }
    }

    const { data, error } = await supabase
      .from('forma_training_lesson_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro ao actualizar report:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
