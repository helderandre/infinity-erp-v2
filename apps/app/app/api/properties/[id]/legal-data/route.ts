import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * `dev_property_legal_data` é a fonte que a Chrome extension MUBE Casa
 * Pronta consome via query directa ao Supabase. Cada imóvel tem no
 * máximo 1 row (PK = property_id). Os campos são extraídos da CRP +
 * Caderneta Predial, ou editados manualmente.
 *
 *   GET  — devolve a row (ou null se ainda não existir)
 *   PUT  — upsert manual; marca verified_at + verified_by quando o
 *          consultor confirma os valores.
 */

const upsertSchema = z.object({
  descricao_ficha: z.string().nullable().optional(),
  descricao_ficha_ano: z.number().int().nullable().optional(),
  conservatoria_crp: z.string().nullable().optional(),
  fracao_autonoma: z.string().nullable().optional(),
  artigo_matricial: z.string().nullable().optional(),
  artigo_matricial_tipo: z.enum(['urbano', 'rustico', 'misto']).nullable().optional(),
  freguesia_fiscal: z.string().nullable().optional(),
  distrito: z.string().nullable().optional(),
  concelho: z.string().nullable().optional(),
  freguesia: z.string().nullable().optional(),
  codigo_ine_freguesia: z.string().nullable().optional(),
  quota_parte: z.string().nullable().optional(),
  verified: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { data, error } = await adminDb
      .from('dev_property_legal_data')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? null })
  } catch (err) {
    console.error('[GET legal-data]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const body = await request.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { verified, ...fields } = parsed.data
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const upsertPayload: Record<string, unknown> = {
      property_id: propertyId,
      ...fields,
    }
    if (verified) {
      upsertPayload.verified_by = auth.user.id
      upsertPayload.verified_at = new Date().toISOString()
    }

    const { data, error } = await adminDb
      .from('dev_property_legal_data')
      .upsert(upsertPayload, { onConflict: 'property_id' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PUT legal-data]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
