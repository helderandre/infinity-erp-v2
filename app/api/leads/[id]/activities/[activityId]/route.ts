// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateActivitySchema } from '@/lib/validations/leads-crm'

/**
 * PATCH and DELETE for a single observation/activity attached to a lead
 * (contact). Same row lives in `leads_activities`; the `:id` is the lead id
 * (kept in the URL for symmetry with the rest of the leads API).
 */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: leadId, activityId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Ensure the activity belongs to this contact before update
    const { data: existing, error: lookupErr } = await supabase
      .from('leads_activities')
      .select('id, contact_id')
      .eq('id', activityId)
      .single()

    if (lookupErr || !existing || existing.contact_id !== leadId) {
      return NextResponse.json({ error: 'Actividade não encontrada' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('leads_activities')
      .update(parsed.data)
      .eq('id', activityId)
      .select('*, dev_users!created_by(id, commercial_name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: leadId, activityId } = await params
    const supabase = await createClient()

    const { data: existing, error: lookupErr } = await supabase
      .from('leads_activities')
      .select('id, contact_id')
      .eq('id', activityId)
      .single()

    if (lookupErr || !existing || existing.contact_id !== leadId) {
      return NextResponse.json({ error: 'Actividade não encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('leads_activities')
      .delete()
      .eq('id', activityId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
