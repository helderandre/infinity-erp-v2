import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { generateMarketingCaption } from '@/lib/processes/neg/generate-marketing-caption'

/**
 * POST /api/deals/[id]/marketing-moments/[mmId]/generate-caption
 *
 * Re-gera (ou gera pela primeira vez) a `ai_description` de um momento
 * de marketing. Usa o contexto actual do deal + property + consultant.
 * Não toca em `manual_caption` — esse fica preservado para edição.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; mmId: string }> }
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId, mmId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Fetch the moment + deal context in one go
    const { data: mm } = await adminDb
      .from('deal_marketing_moments')
      .select('id, moment_type, deal_id')
      .eq('id', mmId)
      .eq('deal_id', dealId)
      .maybeSingle()

    if (!mm) {
      return NextResponse.json({ error: 'Momento não encontrado' }, { status: 404 })
    }

    const moment = mm as { id: string; moment_type: string; deal_id: string }

    const { data: dealCtx } = await adminDb
      .from('deals')
      .select(`
        business_type,
        property:dev_properties!deals_property_id_fkey(
          address_street, city,
          specs:dev_property_specifications(typology)
        ),
        consultant:dev_users!deals_consultant_id_fkey(commercial_name)
      `)
      .eq('id', dealId)
      .maybeSingle()

    const dc = dealCtx as
      | {
          business_type: string | null
          property?: { address_street: string | null; city: string | null; specs?: { typology: string | null } | null } | null
          consultant?: { commercial_name: string | null } | null
        }
      | null

    const propertyAddress = dc?.property
      ? [dc.property.address_street, dc.property.city].filter(Boolean).join(', ')
      : null

    const result = await generateMarketingCaption({
      moment_type: moment.moment_type as 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves',
      property_address: propertyAddress,
      property_typology: dc?.property?.specs?.typology ?? null,
      consultant_name: dc?.consultant?.commercial_name ?? null,
      business_type: dc?.business_type ?? null,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Falha ao gerar legenda IA' },
        { status: 502 }
      )
    }

    const { data: updated, error: updateErr } = await adminDb
      .from('deal_marketing_moments')
      .update({
        ai_description: result.caption,
        ai_description_model: result.model,
        ai_description_generated_at: new Date().toISOString(),
      })
      .eq('id', mmId)
      .select('*')
      .maybeSingle()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[generate-caption]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
