import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'
import { computeFlexibleBadges, computeHardMismatches } from '@/lib/matching'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Amenity field → human-readable label
const AMENITY_LABELS: Record<string, string> = {
  tem_elevador: 'Elevador',
  tem_estacionamento: 'Estacionamento',
  tem_garagem: 'Garagem',
  tem_exterior: 'Espaço Exterior',
  tem_varanda: 'Varanda',
  tem_piscina: 'Piscina',
  tem_porteiro: 'Porteiro',
  tem_arrumos: 'Arrumos',
  tem_carregamento_ev: 'Carregamento EV',
  tem_praia: 'Próximo da Praia',
  tem_quintal: 'Quintal',
  tem_terraco: 'Terraço',
  tem_jardim: 'Jardim',
  tem_mobilado: 'Mobilado',
  tem_arrecadacao: 'Arrecadação',
  tem_aquecimento: 'Aquecimento',
  tem_cozinha_equipada: 'Cozinha Equipada',
  tem_campo: 'Zona Rural',
  tem_urbano: 'Zona Urbana',
  tem_ar_condicionado: 'Ar Condicionado',
  tem_energias_renovaveis: 'Energias Renováveis',
  tem_gas: 'Gás Canalizado',
  tem_seguranca: 'Segurança/Alarme',
  tem_transportes: 'Perto de Transportes',
  tem_vistas: 'Vistas Exteriores',
}

function extractBuyerAmenities(neg: Record<string, unknown>): string[] {
  return Object.entries(AMENITY_LABELS)
    .filter(([field]) => neg[field] === true)
    .map(([, label]) => label)
}

function extractPropertyFeatures(specs: Record<string, unknown> | null): string[] {
  if (!specs) return []
  const features = (specs.features as string[]) || []
  const extras: string[] = []
  if (specs.has_elevator) extras.push('Elevador')
  if (specs.parking_spaces && (specs.parking_spaces as number) > 0) extras.push('Estacionamento')
  return [...features, ...extras]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const withAiScore = searchParams.get('score') === 'true'
    // strict (default true) — quando false relaxa: banda de preço ±30%
    // (em vez de ±15%) e dispensa o filtro estrito de tipo + localização.
    const strict = searchParams.get('strict') !== 'false'
    const admin = createAdminClient() as any

    // Get full negocio buyer profile (including amenities)
    const { data: neg, error: negError } = await admin
      .from('negocios')
      .select('*')
      .eq('id', id)
      .single()

    if (negError || !neg) {
      return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    }

    // Get already-added property IDs
    const { data: existing } = await admin
      .from('negocio_properties')
      .select('property_id')
      .eq('negocio_id', id)
      .not('property_id', 'is', null)

    const excludeIds = (existing || []).map((e: any) => e.property_id).filter(Boolean)

    // ── Hard filters (SQL) ──
    // Include `draft` (off-market — just created via angariação) so consultors
    // can match buyers against properties that aren't public yet. Only hide
    // fully cancelled ones.
    let query = admin
      .from('dev_properties')
      .select(`
        id, title, external_ref, listing_price, property_type, status, city, zone, slug, description, property_condition,
        dev_property_specifications(bedrooms, bathrooms, area_gross, area_util, parking_spaces, garage_spaces, has_elevator, features, construction_year, solar_orientation, views, equipment, balcony_area, pool_area, attic_area, pantry_area),
        dev_property_media(url, is_cover)
      `)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50)

    // Hard: property type — só enforced em strict
    if (strict && neg.tipo_imovel) {
      query = query.ilike('property_type', `%${neg.tipo_imovel}%`)
    }

    // Hard: price range — strict ±15%, loose ±30% (do max budget)
    const budget = neg.orcamento_max || neg.orcamento
    if (budget) {
      const factor = strict ? 0.15 : 0.30
      const min = budget * (1 - factor)
      const max = budget * (1 + factor)
      query = query.gte('listing_price', min).lte('listing_price', max)
    }

    // Hard: location — só enforced em strict
    if (strict && neg.localizacao) {
      const zones = neg.localizacao.split(',').map((z: string) => z.trim()).filter(Boolean)
      if (zones.length > 0) {
        const orFilter = zones.map((z: string) => `city.ilike.%${z}%,zone.ilike.%${z}%`).join(',')
        query = query.or(orFilter)
      }
    }

    // Nota: `quartos_min` / `wc_min` não são aplicados aqui em SQL porque
    // estão na tabela `dev_property_specifications` (1:1 join). O filtro
    // é feito a seguir, junto com a remoção de mismatches em modo estrito.

    // Exclude already-added
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[property-matches]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // ── Price + off-market flags + mismatch badges (determinístico) ──
    const negocioFlex = {
      area_min_m2: neg.area_min_m2 ?? null,
      estado_imovel: neg.estado_imovel ?? null,
      tem_garagem: neg.tem_garagem ?? null,
      tem_estacionamento: neg.tem_estacionamento ?? null,
      tem_elevador: neg.tem_elevador ?? null,
      tem_piscina: neg.tem_piscina ?? null,
      tem_varanda: neg.tem_varanda ?? null,
      tem_arrumos: neg.tem_arrumos ?? null,
      tem_exterior: neg.tem_exterior ?? null,
      tem_porteiro: neg.tem_porteiro ?? null,
    }
    const negocioHard = {
      tipo_imovel: neg.tipo_imovel ?? null,
      localizacao: neg.localizacao ?? null,
      orcamento: neg.orcamento ?? null,
      orcamento_max: neg.orcamento_max ?? null,
      quartos_min: neg.quartos_min ?? null,
      wc_min: neg.wc_min ?? null,
    }

    const withFlags = data.map((p: any) => {
      let price_flag: string | null = null
      if (budget && p.listing_price) {
        const ratio = p.listing_price / budget
        if (ratio <= 1.0) price_flag = 'green'
        else if (ratio <= 1.05) price_flag = 'yellow'
        else if (ratio <= 1.10) price_flag = 'orange'
        else price_flag = 'red'
      }
      // `off_market` = property not yet publicly listed. For now only `draft`
      // (fresh angariação), but this is the single source of truth so it's
      // easy to broaden later (e.g. pending_approval).
      const off_market = p.status === 'draft'

      const specs = p.dev_property_specifications ?? null
      const hard = computeHardMismatches(negocioHard, {
        property_type: p.property_type ?? null,
        city: p.city ?? null,
        zone: p.zone ?? null,
        listing_price: p.listing_price ?? null,
        bedrooms: specs?.bedrooms ?? null,
        bathrooms: specs?.bathrooms ?? null,
      })
      const soft = computeFlexibleBadges(
        negocioFlex,
        {
          property_condition: p.property_condition ?? null,
          specifications: specs
            ? {
                area_util: specs.area_util ?? null,
                area_gross: specs.area_gross ?? null,
                bedrooms: specs.bedrooms ?? null,
                bathrooms: specs.bathrooms ?? null,
                has_elevator: specs.has_elevator ?? null,
                garage_spaces: specs.garage_spaces ?? null,
                parking_spaces: specs.parking_spaces ?? null,
                balcony_area: specs.balcony_area ?? null,
                pool_area: specs.pool_area ?? null,
                attic_area: specs.attic_area ?? null,
                pantry_area: specs.pantry_area ?? null,
                features: specs.features ?? null,
                equipment: specs.equipment ?? null,
              }
            : null,
        },
        'no_filter',
      )
      // Em modo ESTRITO, hard mismatches devem EXCLUIR a propriedade (não
      // aparecer com badge). Em modo SOLTO, mostram-se como aviso.
      // Só queremos negativos (warning) e info — escondemos positives nesta vista densa.
      const badges = strict
        ? soft.filter((b) => b.type !== 'positive')
        : [...hard, ...soft].filter((b) => b.type !== 'positive')

      const hasHardMismatch = hard.length > 0

      return { ...p, price_flag, off_market, badges, _hasHardMismatch: hasHardMismatch }
    })
      // Em modo estrito: descartar quaisquer propriedades com hard mismatch
      // (cobre os casos que o SQL não filtra — quartos_min/wc_min em specs).
      .filter((p: any) => !strict || !p._hasHardMismatch)
      .map((p: any) => {
        const { _hasHardMismatch, ...rest } = p
        return rest
      })

    // ── AI Scoring (soft criteria) — only when ?score=true ──
    if (!withAiScore) {
      return NextResponse.json({ data: withFlags })
    }

    const buyerAmenities = extractBuyerAmenities(neg)

    const buyerProfile = {
      tipo_imovel: neg.tipo_imovel || null,
      localizacao: neg.localizacao || null,
      orcamento_min: neg.orcamento || null,
      orcamento_max: neg.orcamento_max || null,
      quartos_min: neg.quartos_min || null,
      wc_min: neg.wc_min || null,
      area_min_m2: neg.area_min_m2 || null,
      estado_imovel: neg.estado_imovel || null,
      amenidades_desejadas: buyerAmenities,
      observacoes: neg.observacoes || null,
    }

    const propertySummaries = withFlags.map((p: any) => ({
      id: p.id,
      titulo: p.title,
      preco: p.listing_price,
      tipo: p.property_type,
      cidade: p.city,
      zona: p.zone,
      estado: p.property_condition,
      quartos: p.dev_property_specifications?.bedrooms || null,
      wc: p.dev_property_specifications?.bathrooms || null,
      area_util: p.dev_property_specifications?.area_util || null,
      area_bruta: p.dev_property_specifications?.area_gross || null,
      estacionamento: p.dev_property_specifications?.parking_spaces || 0,
      caracteristicas: extractPropertyFeatures(p.dev_property_specifications),
      ano_construcao: p.dev_property_specifications?.construction_year || null,
      descricao: p.description ? p.description.substring(0, 300) : null,
    }))

    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Ès um assistente imobiliário português. Recebes o perfil de procura de um comprador e uma lista de imóveis que já passaram filtros mínimos (tipo, preço, localização, quartos).

A tua tarefa é avaliar a COMPATIBILIDADE de cada imóvel com o perfil do comprador, de 0 a 100%.

Critérios de avaliação (pesos sugeridos):
- Preço: Quão bem encaixa no orçamento (dentro = melhor, acima = penalizar proporcionalmente)
- Área: Se tem a área mínima pedida, bónus se for maior
- Quartos/WC: Exactamente o pedido = bom, mais = bónus ligeiro
- Amenidades: Quantas das amenidades desejadas o imóvel tem
- Estado do imóvel: Se corresponde ao desejado (novo, renovado, etc.)
- Localização: Zona exacta vs cidade apenas
- Observações do comprador: Notas livres que podem indicar preferências específicas (ex: "quer vista mar", "precisa de garagem para 2 carros"). Cruzar com a descrição e características do imóvel
- Descrição do imóvel: Pode conter detalhes que complementam as características estruturadas

Responde APENAS com JSON: { "scores": [ { "id": "<property-id>", "score": <0-100>, "reason": "<razão curta em PT, max 15 palavras>" } ] }
Ordena por score decrescente.`
          },
          {
            role: 'user',
            content: JSON.stringify({
              perfil_comprador: buyerProfile,
              imoveis: propertySummaries,
            }),
          },
        ],
      })

      const content = aiResponse.choices[0]?.message?.content
      if (content) {
        const parsed = JSON.parse(content)
        const scoreMap = new Map<string, { score: number; reason: string }>()
        for (const s of parsed.scores || []) {
          scoreMap.set(s.id, { score: s.score, reason: s.reason })
        }

        // Merge scores and sort
        const scored = withFlags.map((p: any) => {
          const ai = scoreMap.get(p.id)
          return {
            ...p,
            match_score: ai?.score ?? null,
            match_reason: ai?.reason ?? null,
          }
        })

        scored.sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0))
        return NextResponse.json({ data: scored })
      }
    } catch (aiError) {
      console.error('[property-matches] AI scoring failed, returning unsorted:', aiError)
    }

    // Fallback: return without AI scores
    return NextResponse.json({ data: withFlags })
  } catch (err) {
    console.error('[property-matches]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * POST — Score specific property IDs against the buyer profile.
 * Body: { property_ids: string[] }
 * Returns: { scores: { id, score, reason }[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const { property_ids } = await request.json()

    if (!Array.isArray(property_ids) || property_ids.length === 0) {
      return NextResponse.json({ error: 'property_ids required' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Buyer profile
    const { data: neg, error: negError } = await admin
      .from('negocios')
      .select('*')
      .eq('id', id)
      .single()

    if (negError || !neg) {
      return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    }

    // Fetch the specific properties
    const { data: props, error: propError } = await admin
      .from('dev_properties')
      .select(`
        id, title, external_ref, listing_price, property_type, status, city, zone, description, property_condition,
        dev_property_specifications(bedrooms, bathrooms, area_gross, area_util, parking_spaces, has_elevator, features, construction_year)
      `)
      .in('id', property_ids)

    if (propError || !props || props.length === 0) {
      return NextResponse.json({ scores: [] })
    }

    const buyerAmenities = extractBuyerAmenities(neg)
    const buyerProfile = {
      tipo_imovel: neg.tipo_imovel || null,
      localizacao: neg.localizacao || null,
      orcamento_min: neg.orcamento || null,
      orcamento_max: neg.orcamento_max || null,
      quartos_min: neg.quartos_min || null,
      wc_min: neg.wc_min || null,
      area_min_m2: neg.area_min_m2 || null,
      estado_imovel: neg.estado_imovel || null,
      amenidades_desejadas: buyerAmenities,
      observacoes: neg.observacoes || null,
    }

    const propertySummaries = props.map((p: any) => ({
      id: p.id,
      titulo: p.title,
      preco: p.listing_price,
      tipo: p.property_type,
      cidade: p.city,
      zona: p.zone,
      estado: p.property_condition,
      quartos: p.dev_property_specifications?.bedrooms || null,
      wc: p.dev_property_specifications?.bathrooms || null,
      area_util: p.dev_property_specifications?.area_util || null,
      area_bruta: p.dev_property_specifications?.area_gross || null,
      estacionamento: p.dev_property_specifications?.parking_spaces || 0,
      caracteristicas: extractPropertyFeatures(p.dev_property_specifications),
      ano_construcao: p.dev_property_specifications?.construction_year || null,
      descricao: p.description ? p.description.substring(0, 300) : null,
    }))

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente imobiliário português. Recebes o perfil de procura de um comprador e uma lista de imóveis.

Avalia a COMPATIBILIDADE de cada imóvel com o perfil do comprador, de 0 a 100%.

Critérios:
- Preço vs orçamento
- Área vs mínimo pedido
- Quartos/WC vs mínimos
- Amenidades desejadas vs disponíveis
- Estado do imóvel
- Localização
- Observações do comprador vs descrição do imóvel

Responde APENAS com JSON: { "scores": [ { "id": "<property-id>", "score": <0-100>, "reason": "<razão curta em PT, max 15 palavras>" } ] }`
        },
        {
          role: 'user',
          content: JSON.stringify({ perfil_comprador: buyerProfile, imoveis: propertySummaries }),
        },
      ],
    })

    const content = aiResponse.choices[0]?.message?.content
    if (content) {
      const parsed = JSON.parse(content)
      return NextResponse.json({ scores: parsed.scores || [] })
    }

    return NextResponse.json({ scores: [] })
  } catch (err) {
    console.error('[property-matches POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
