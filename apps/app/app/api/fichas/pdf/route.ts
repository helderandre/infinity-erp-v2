import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { fillFichaVisita } from '@/lib/pdf/fill-ficha-visita'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const property_id = searchParams.get('property_id')
    if (!property_id) return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })

    const admin = createAdminClient() as any
    const { data: property } = await admin
      .from('dev_properties')
      .select('id, title, external_ref, city, zone, address_street, slug')
      .eq('id', property_id)
      .single()

    if (!property) return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })

    const pdfBytes = await fillFichaVisita({
      angariacao: property.external_ref || property.slug || '—',
      morada: property.address_street || property.title || '—',
      concelho: [property.city, property.zone].filter(Boolean).join(', ') || '—',
    })

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ficha-visita-${property.external_ref || property.slug || property.id}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[fichas/pdf GET]', err)
    return NextResponse.json({ error: 'Erro ao gerar PDF.' }, { status: 500 })
  }
}
