// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * One-shot migration: copies `leads.observacoes` (legacy single-textarea) to
 * a new dated observation in `leads_activities` then NULLs the column.
 *
 * - `occurred_at` = `lead.created_at` (the field was always undated, this is
 *   the closest honest stamp).
 * - `subject` = "Observação inicial (migrada)" so the timeline labels it.
 * - Idempotent: returns 200 with `{migrated: false}` if there's nothing to
 *   migrate.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, observacoes, created_at')
      .eq('id', id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 })
    }

    const text = (lead.observacoes ?? '').trim()
    if (!text) {
      return NextResponse.json({ migrated: false })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('leads_activities')
      .insert({
        contact_id: id,
        activity_type: 'note',
        subject: 'Observação inicial (migrada)',
        description: text,
        occurred_at: lead.created_at,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const { error: nullErr } = await supabase
      .from('leads')
      .update({ observacoes: null })
      .eq('id', id)

    if (nullErr) {
      // Insertion succeeded but null failed — log + return success anyway,
      // worst case the user sees the legacy banner once more and clicks again
      console.error('Failed to null leads.observacoes after migration:', nullErr)
    }

    return NextResponse.json({ migrated: true, activity_id: inserted.id })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
