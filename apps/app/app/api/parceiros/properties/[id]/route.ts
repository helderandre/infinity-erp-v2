// @ts-nocheck
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

/**
 * GET /api/parceiros/properties/[id]
 *
 * Vista read-only do parceiro sobre um imóvel associado a ele — i.e. o imóvel
 * de um pedido de campanha que lhe foi atribuído (marketing_campaigns.partner_id
 * = self) OU o imóvel de origem de uma oportunidade que ele referenciou
 * (negocios.referrer_consultant_id = self). O role "Parceiro" não tem permissão
 * `properties`, por isso `/api/properties/[id]` devolve 403 — este endpoint faz
 * uma leitura bundled via admin client, GATED estritamente à associação acima,
 * e devolve apenas campos públicos (nada de notas internas, donos ou comissões).
 *
 *   { property, specifications, media }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createCrmAdminClient()

    // ── Gate: o parceiro só vê imóveis a que está legitimamente associado. ──
    if (!isManagementRole(auth.roles)) {
      const [{ data: camp }, { data: neg }] = await Promise.all([
        admin
          .from('marketing_campaigns')
          .select('id')
          .eq('partner_id', auth.user.id)
          .eq('property_id', id)
          .limit(1)
          .maybeSingle(),
        admin
          .from('negocios')
          .select('id')
          .eq('referrer_consultant_id', auth.user.id)
          .eq('property_id', id)
          .limit(1)
          .maybeSingle(),
      ])
      if (!camp && !neg) {
        // 404 para não revelar a existência do imóvel.
        return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
      }
    }

    // ── Imóvel + especificações + media, na forma `PropertyDetail` esperada
    //    pelo <PropertyApresentacaoTab> (a mesma vista que um colega consultor
    //    sem ownership vê na secção Imóveis). `dev_property_internal` fica a
    //    NULL de propósito — é onde vivem comissão/notas internas, que o
    //    parceiro não deve ver. `dev_properties` é a tabela do anúncio (sem
    //    dados sensíveis). ──
    const { data: property, error } = await admin
      .from('dev_properties')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const [{ data: specifications }, { data: media }] = await Promise.all([
      admin.from('dev_property_specifications').select('*').eq('property_id', id).maybeSingle(),
      admin
        .from('dev_property_media')
        .select('*')
        .eq('property_id', id)
        .order('is_cover', { ascending: false })
        .order('order_index', { ascending: true }),
    ])

    return NextResponse.json({
      ...property,
      dev_property_specifications: specifications ?? null,
      dev_property_internal: null,
      dev_property_media: media ?? [],
    })
  } catch (error) {
    console.error('Erro ao obter imóvel do parceiro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
