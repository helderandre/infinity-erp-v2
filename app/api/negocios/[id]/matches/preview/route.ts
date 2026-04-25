import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { hydrateMatches } from '@/lib/matching/hydrate-matches'
import type { GeoSource } from '@/lib/matching'
import { z } from 'zod'

const previewBodySchema = z.object({
  zonas: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('admin'),
          area_id: z.string().uuid(),
          label: z.string(),
        }),
        z.object({
          kind: z.literal('polygon'),
          id: z.string(),
          label: z.string(),
          geometry: z.object({
            type: z.literal('Polygon'),
            coordinates: z.array(z.array(z.array(z.number()))),
          }),
        }),
      ])
    )
    .default([]),
  strict: z.boolean().optional(),
})

/**
 * POST /api/negocios/[id]/matches/preview
 *
 * Calcula matches em tempo real com um conjunto de zonas em rascunho,
 * sem persistir. Usado pelo `<ZonasMapPicker>` para feedback live.
 *
 * Body: { zonas: NegocioZone[]; strict?: boolean }
 * Resposta: { data: PropertyMatch[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const parsed = previewBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { zonas, strict = false } = parsed.data

    // 1. Critérios flexíveis do negócio
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select(
        `area_min_m2, estado_imovel, orcamento, orcamento_max,
         tem_garagem, tem_estacionamento, tem_elevador, tem_piscina,
         tem_varanda, tem_arrumos, tem_exterior, tem_porteiro`
      )
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // 2. Bloqueantes via SQL preview function (zones em runtime)
    const { data: rpcResult, error: rpcError } = await (
      supabase as unknown as {
        rpc: (
          fn: 'match_properties_preview',
          args: { p_negocio_id: string; p_zonas: unknown }
        ) => Promise<{
          data: Array<{ property_id: string; geo_source: GeoSource }> | null
          error: { message: string } | null
        }>
      }
    ).rpc('match_properties_preview', {
      p_negocio_id: id,
      p_zonas: zonas,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const blocking = rpcResult ?? []

    // 3. Hidrata + badges + ordenação (mesmo helper que /matches)
    const results = await hydrateMatches(
      supabase as unknown as Parameters<typeof hydrateMatches>[0],
      negocio as Parameters<typeof hydrateMatches>[1],
      blocking,
      { strict }
    )

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Erro no preview de matches:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
