import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { digitalFichaSchema } from '@/lib/validations/visit-ficha'

// Public endpoint — no auth required
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { property_id, visit_id, signature_data, ...formData } = body

    if (!property_id) {
      return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })
    }

    const parsed = digitalFichaSchema.safeParse(formData)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Verify property exists
    const { data: prop } = await admin
      .from('dev_properties')
      .select('id')
      .eq('id', property_id)
      .single()

    if (!prop) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    // Se foi passado um visit_id (link partilhado a partir de uma visita
    // específica), validar que existe e que pertence a esta propriedade.
    let validatedVisitId: string | null = null
    if (visit_id) {
      const { data: visit } = await admin
        .from('visits')
        .select('id, property_id')
        .eq('id', visit_id)
        .single()
      if (visit && visit.property_id === property_id) {
        validatedVisitId = visit.id
      }
      // Se não bater certo (visita inexistente ou de outra propriedade),
      // ignora-se o visit_id silenciosamente em vez de bloquear o submit —
      // a ficha vale por si só, a ligação à visita é bonus.
    }

    // Upload signature if provided (base64 data URL)
    let signature_url: string | null = null
    if (signature_data && typeof signature_data === 'string' && signature_data.startsWith('data:')) {
      try {
        const { uploadImageToR2 } = await import('@/lib/r2/images')
        const base64 = signature_data.split(',')[1]
        const buffer = Buffer.from(base64, 'base64')
        const fileName = `signature-${Date.now()}.png`
        const result = await uploadImageToR2(buffer, fileName, 'image/png', property_id)
        signature_url = result.url
      } catch (err) {
        console.error('[fichas/public] signature upload error:', err)
      }
    }

    const { data, error } = await admin
      .from('visit_fichas')
      .insert({
        property_id,
        visit_id: validatedVisitId,
        source: 'digital',
        ...parsed.data,
        client_email: parsed.data.client_email || null,
        signature_url,
      })
      .select()
      .single()

    if (error) {
      console.error('[fichas/public POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[fichas/public POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
