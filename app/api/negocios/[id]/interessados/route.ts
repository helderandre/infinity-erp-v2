import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'
import { computeBuyerMismatches } from '@/lib/matching'
import type { SellerProfile, BuyerProfile } from '@/lib/matching'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const AMENITY_LABELS: Record<string, string> = {
  tem_elevador: 'Elevador', tem_estacionamento: 'Estacionamento', tem_garagem: 'Garagem',
  tem_exterior: 'Espaço Exterior', tem_varanda: 'Varanda', tem_piscina: 'Piscina',
  tem_porteiro: 'Porteiro', tem_arrumos: 'Arrumos', tem_carregamento_ev: 'Carregamento EV',
  tem_praia: 'Próximo da Praia', tem_quintal: 'Quintal', tem_terraco: 'Terraço',
  tem_jardim: 'Jardim', tem_mobilado: 'Mobilado', tem_arrecadacao: 'Arrecadação',
  tem_aquecimento: 'Aquecimento', tem_cozinha_equipada: 'Cozinha Equipada',
  tem_campo: 'Zona Rural', tem_urbano: 'Zona Urbana', tem_ar_condicionado: 'Ar Condicionado',
  tem_energias_renovaveis: 'Energias Renováveis', tem_gas: 'Gás Canalizado',
  tem_seguranca: 'Segurança/Alarme', tem_transportes: 'Perto de Transportes',
  tem_vistas: 'Vistas Exteriores',
}

function extractAmenities(data: Record<string, unknown>, suffix = ''): string[] {
  return Object.entries(AMENITY_LABELS)
    .filter(([field]) => data[field + suffix] === true)
    .map(([, label]) => label)
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
    // strict (default true) — quando false relaxa: banda de preço ±30% (em vez
    // de ±15%) e ignora tipo / overlap de zonas / quartos mínimos.
    const strict = searchParams.get('strict') !== 'false'
    const admin = createAdminClient() as any

    // Fetch the seller negócio with all fields
    const { data: negocio, error: negError } = await admin
      .from('negocios')
      .select('*, leads!lead_id(agent_id)')
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    if (!['Venda', 'Compra e Venda'].includes(negocio.tipo)) {
      return NextResponse.json({ data: [] })
    }

    // Use assigned_consultant_id first, fallback to lead.agent_id
    const currentAgentId = negocio.assigned_consultant_id || negocio.leads?.agent_id || null
    const isCompraEVenda = negocio.tipo === 'Compra e Venda'

    // Extract seller property profile
    const sellerPrice = negocio.preco_venda || null
    const sellerType = isCompraEVenda ? (negocio.tipo_imovel_venda || negocio.tipo_imovel) : negocio.tipo_imovel
    const sellerLocation = isCompraEVenda ? (negocio.localizacao_venda || negocio.localizacao) : negocio.localizacao
    const sellerRooms = negocio.quartos || null
    const sellerAmenities = extractAmenities(negocio, isCompraEVenda ? '_venda' : '')

    // Perfil estruturado do imóvel à venda — usado para computar mismatches
    // por comprador. Lê os mesmos campos `tem_*[_venda]` que o resto do flow.
    const amenitySuffix = isCompraEVenda ? '_venda' : ''
    const sellerProfileForBadges: SellerProfile = {
      preco_venda: sellerPrice,
      tipo_imovel: sellerType ?? null,
      localizacao: sellerLocation ?? null,
      quartos: sellerRooms,
      casas_banho: negocio.casas_banho ?? null,
      area_m2: negocio.area_m2 ?? null,
      estado_imovel: negocio.estado_imovel ?? null,
      amenities: {
        tem_garagem: negocio[`tem_garagem${amenitySuffix}`] ?? null,
        tem_estacionamento: negocio[`tem_estacionamento${amenitySuffix}`] ?? null,
        tem_elevador: negocio[`tem_elevador${amenitySuffix}`] ?? null,
        tem_piscina: negocio[`tem_piscina${amenitySuffix}`] ?? null,
        tem_varanda: negocio[`tem_varanda${amenitySuffix}`] ?? null,
        tem_arrumos: negocio[`tem_arrumos${amenitySuffix}`] ?? null,
        tem_exterior: negocio[`tem_exterior${amenitySuffix}`] ?? null,
        tem_porteiro: negocio[`tem_porteiro${amenitySuffix}`] ?? null,
      },
    }

    // ── Fetch buyer negócios with pipeline stage ──
    const { data: buyerNegocios, error } = await admin
      .from('negocios')
      .select(`
        *,
        leads_pipeline_stages!pipeline_stage_id(id, name, color, is_terminal, terminal_type, order_index),
        leads!lead_id(
          nome,
          agent_id,
          agent:dev_users(
            commercial_name,
            professional_email,
            profile:dev_consultant_profiles(phone_commercial)
          )
        ),
        dev_users!assigned_consultant_id(
          commercial_name,
          professional_email,
          profile:dev_consultant_profiles(phone_commercial)
        )
      `)
      .in('tipo', ['Compra', 'Compra e Venda'])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Hard filters (keep all non-terminal, including own buyers) ──
    // Em modo strict, todos os filtros aplicam-se. Em loose: preço ±30% e
    // resto opcional (tipo, zonas, quartos não filtram).
    const priceFactor = strict ? 0.15 : 0.30
    const filtered = (buyerNegocios || []).filter((n: any) => {
      // Exclude terminal (won/lost) negócios
      if (n.leads_pipeline_stages?.is_terminal) return false

      // Budget — strict ±15%, loose ±30%
      if (sellerPrice) {
        const buyerMax = n.orcamento_max || n.orcamento
        const buyerMin = n.orcamento || 0
        if (buyerMax && buyerMax < sellerPrice * (1 - priceFactor)) return false
        if (buyerMin && buyerMin > sellerPrice * (1 + priceFactor)) return false
      }

      if (strict) {
        // Property type must match (skip if either is not set)
        if (sellerType && n.tipo_imovel) {
          if (!sellerType.toLowerCase().includes(n.tipo_imovel.toLowerCase()) &&
              !n.tipo_imovel.toLowerCase().includes(sellerType.toLowerCase())) {
            return false
          }
        }

        // Location overlap (skip if either is not set)
        if (sellerLocation && n.localizacao) {
          const sellerZones = sellerLocation.split(',').map((z: string) => z.trim().toLowerCase()).filter(Boolean)
          const buyerZones = n.localizacao.split(',').map((z: string) => z.trim().toLowerCase()).filter(Boolean)
          const hasOverlap = sellerZones.some((sz: string) =>
            buyerZones.some((bz: string) => sz.includes(bz) || bz.includes(sz))
          )
          if (!hasOverlap) return false
        }

        // Rooms: seller must have >= buyer's minimum
        if (sellerRooms && n.quartos_min && sellerRooms < n.quartos_min) return false
      }

      return true
    })

    // Build result objects
    const results = filtered.map((n: any) => {
      const lead = n.leads || {}
      const nome = lead.nome || ''
      const firstName = nome.split(' ')[0] || nome

      // Determine if this is our own buyer
      const buyerAgentId = n.assigned_consultant_id || lead.agent_id
      const isMine = !!(currentAgentId && buyerAgentId === currentAgentId)

      // Prefer assigned consultant, fallback to lead's agent
      const contactSource = n.dev_users || lead.agent || {}
      const profile = contactSource.profile || {}

      const stageName = n.leads_pipeline_stages?.name || n.estado || null
      const stageColor = n.leads_pipeline_stages?.color || null

      const buyerProfileForBadges: BuyerProfile = {
        orcamento: n.orcamento ?? null,
        orcamento_max: n.orcamento_max ?? null,
        tipo_imovel: n.tipo_imovel ?? null,
        localizacao: n.localizacao ?? null,
        quartos_min: n.quartos_min ?? null,
        wc_min: n.wc_min ?? null,
        area_min_m2: n.area_min_m2 ?? null,
        estado_imovel: n.estado_imovel ?? null,
        amenities: {
          tem_garagem: n.tem_garagem ?? null,
          tem_estacionamento: n.tem_estacionamento ?? null,
          tem_elevador: n.tem_elevador ?? null,
          tem_piscina: n.tem_piscina ?? null,
          tem_varanda: n.tem_varanda ?? null,
          tem_arrumos: n.tem_arrumos ?? null,
          tem_exterior: n.tem_exterior ?? null,
          tem_porteiro: n.tem_porteiro ?? null,
        },
      }
      const badges = computeBuyerMismatches(sellerProfileForBadges, buyerProfileForBadges)

      return {
        negocioId: n.id,
        firstName,
        isMine,
        // user_id do consultor responsável pelo lead — usado para sugerir
        // ao colega via WA (phone) ou chat interno (DM).
        consultantId: buyerAgentId || null,
        colleague: contactSource.commercial_name || 'Sem consultor',
        phone: profile.phone_commercial || null,
        email: contactSource.professional_email || null,
        stageName,
        stageColor,
        badges,
        // For AI scoring
        _buyerProfile: {
          tipo_imovel: n.tipo_imovel,
          localizacao: n.localizacao,
          orcamento_min: n.orcamento,
          orcamento_max: n.orcamento_max,
          quartos_min: n.quartos_min,
          wc_min: n.wc_min,
          area_min_m2: n.area_min_m2,
          estado_imovel: n.estado_imovel,
          observacoes: n.observacoes,
          amenidades: extractAmenities(n),
        },
      }
    })

    // Sort: own buyers first, then colleagues
    results.sort((a: any, b: any) => {
      if (a.isMine && !b.isMine) return -1
      if (!a.isMine && b.isMine) return 1
      return 0
    })

    // Without AI scoring, return hard-filtered results only
    if (!withAiScore || results.length === 0) {
      const basic = results.map((r: any) => {
        const { _buyerProfile, ...rest } = r
        return rest
      })
      return NextResponse.json({ data: basic })
    }

    // ── AI scoring (only when ?score=true) ──
    const sellerProfile = {
      preco_venda: sellerPrice,
      tipo_imovel: sellerType,
      localizacao: sellerLocation,
      quartos: sellerRooms,
      casas_banho: negocio.casas_banho || null,
      area_m2: negocio.area_m2 || null,
      estado_imovel: negocio.estado_imovel || null,
      observacoes: negocio.observacoes || null,
      amenidades: sellerAmenities,
    }

    const buyerSummaries = results.map((r: any) => ({
      id: r.negocioId,
      nome: r.firstName,
      colega: r.colleague,
      ...r._buyerProfile,
    }))

    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `És um assistente imobiliário português. Recebes o perfil de um imóvel à venda e uma lista de compradores que já passaram filtros mínimos (orçamento, tipo, localização, quartos).

A tua tarefa é avaliar a COMPATIBILIDADE de cada comprador com o imóvel, de 0 a 100%.

Critérios de avaliação:
- Orçamento: O preço de venda encaixa no orçamento do comprador? Dentro = melhor, no limite = penalizar
- Tipo de imóvel: Correspondência exacta
- Localização: Zona exacta vs cidade apenas
- Quartos/WC: O imóvel tem os mínimos pedidos, bónus se tem mais
- Área: O imóvel cumpre a área mínima pedida
- Amenidades: Quantas das amenidades desejadas pelo comprador o imóvel tem
- Estado do imóvel: Corresponde ao desejado
- Observações: Notas livres do comprador que indicam preferências específicas, cruzar com o perfil do imóvel

Responde APENAS com JSON: { "scores": [ { "id": "<negocio-id>", "score": <0-100>, "reason": "<razão curta em PT, max 15 palavras>" } ] }
Ordena por score decrescente.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              imovel_a_venda: sellerProfile,
              compradores: buyerSummaries,
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

        const scored = results.map((r: any) => {
          const ai = scoreMap.get(r.negocioId)
          const { _buyerProfile, ...rest } = r
          return {
            ...rest,
            match_score: ai?.score ?? null,
            match_reason: ai?.reason ?? null,
          }
        })

        scored.sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0))
        return NextResponse.json({ data: scored })
      }
    } catch (aiError) {
      console.error('[interessados] AI scoring failed:', aiError)
    }

    // Fallback
    const fallback = results.map((r: any) => {
      const { _buyerProfile, ...rest } = r
      return rest
    })

    return NextResponse.json({ data: fallback })
  } catch (error) {
    console.error('Erro ao obter interessados:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
