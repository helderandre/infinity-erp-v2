/**
 * Sugestão cross-consultor a partir da tab Interessados de uma angariação.
 *
 * A mensagem **não** linka para um imóvel — descreve em texto o que o
 * vendedor tem (specs do negócio) para o colega avaliar contra o perfil
 * dos seus compradores. Razão: muitas angariações ainda não geraram um
 * row em `dev_properties`; e mesmo quando há, queremos que o colega volte
 * a falar connosco em vez de saltar para o sistema público.
 *
 * Dois canais:
 *  • WhatsApp — para o telemóvel do colega (1 mensagem por colega)
 *  • Chat interno — DM via getDmChannelId, ideal para envio em lote
 *    (vários leads do mesmo colega numa só mensagem)
 */

import { resolveLeadChat } from './send-properties-whatsapp'
import { getDmChannelId } from '@/lib/constants'

/** Specs derivadas de um row em `negocios` (lado vendedor / arrendador). */
export interface NegocioSpecs {
  /** Tipo do negócio: 'Venda' | 'Arrendador' (etc.). */
  tipo: string
  tipoImovel: string | null
  /** Preço de venda OU renda pretendida (em euros). */
  amount: number | null
  /** Etiqueta do amount: 'price' (€) ou 'rent' (€/mês). */
  amountKind: 'price' | 'rent' | null
  localizacao: string | null
  quartos: number | null
  areaM2: number | null
  /** Labels textuais das amenidades activas (já formatadas). */
  features: string[]
  observacoes: string | null
}

interface BuildCaptionOpts {
  /** Nomes dos leads do colega que podem estar interessados. */
  leadNames: string[]
  /** Primeiro nome do colega — saúdo opcional. */
  colleagueFirstName?: string | null
  /** Linguagem ligeiramente diferente entre canais (ex.: emojis). */
  variant: 'whatsapp' | 'internal-chat'
}

function fmtEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v)
}

function buildSpecsCaption(specs: NegocioSpecs, opts: BuildCaptionOpts): string {
  const { leadNames, colleagueFirstName } = opts
  const lines: string[] = []

  if (colleagueFirstName) {
    lines.push(`Olá ${colleagueFirstName} 👋`)
    lines.push('')
  }

  lines.push('Tenho a seguinte angariação:')
  lines.push('')

  if (specs.tipoImovel) {
    lines.push(`🏠 *${specs.tipoImovel}*`)
  }

  if (specs.amount != null) {
    const tag = specs.amountKind === 'rent' ? '/mês' : ''
    lines.push(`💰 ${fmtEur(specs.amount)}${tag}`)
  }

  const meta = [
    specs.localizacao,
    specs.quartos != null ? `${specs.quartos} quartos` : null,
    specs.areaM2 != null ? `${specs.areaM2}m²` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  if (meta) lines.push(`📍 ${meta}`)

  if (specs.features.length > 0) {
    lines.push(`✨ ${specs.features.slice(0, 6).join(', ')}`)
  }

  if (specs.observacoes && specs.observacoes.trim().length > 0) {
    lines.push('')
    lines.push(specs.observacoes.trim().slice(0, 400))
  }

  lines.push('')
  if (leadNames.length === 1) {
    lines.push(`Pode ser interessante para o teu cliente *${leadNames[0]}*. Avisa se quiseres mais detalhes 🙌`)
  } else if (leadNames.length > 1) {
    lines.push(`Pode ser interessante para os teus clientes:`)
    leadNames.forEach((n) => lines.push(`• ${n}`))
    lines.push('')
    lines.push('Avisa se quiseres mais detalhes 🙌')
  } else {
    lines.push('Avisa se houver fit para algum cliente 🙌')
  }

  return lines.join('\n')
}

// ────────────────────────────────────────────────────────────────────────
// WhatsApp
// ────────────────────────────────────────────────────────────────────────

export async function suggestNegocioToColleagueViaWhatsApp(args: {
  specs: NegocioSpecs
  colleaguePhone: string
  colleagueFirstName?: string | null
  leadNames: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const chatId = await resolveLeadChat(
    args.colleaguePhone,
    args.colleagueFirstName || 'Colega',
  )
  if (!chatId) {
    return { ok: false, error: 'Não foi possível abrir conversa com o colega' }
  }

  const text = buildSpecsCaption(args.specs, {
    leadNames: args.leadNames,
    colleagueFirstName: args.colleagueFirstName,
    variant: 'whatsapp',
  })

  const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send_text', text }),
  })
  return res.ok
    ? { ok: true }
    : { ok: false, error: 'Erro ao enviar mensagem' }
}

// ────────────────────────────────────────────────────────────────────────
// Chat interno
// ────────────────────────────────────────────────────────────────────────

export async function suggestNegocioToColleagueViaInternalChat(args: {
  specs: NegocioSpecs
  currentUserId: string
  colleagueUserId: string
  colleagueFirstName?: string | null
  leadNames: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const channelId = getDmChannelId(args.currentUserId, args.colleagueUserId)
  const content = buildSpecsCaption(args.specs, {
    leadNames: args.leadNames,
    colleagueFirstName: args.colleagueFirstName,
    variant: 'internal-chat',
  })

  try {
    const res = await fetch('/api/chat/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId,
        dm_recipient_id: args.colleagueUserId,
        content,
        mentions: [],
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || 'Erro ao enviar' }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Helper para construir NegocioSpecs a partir de um row de negocios
// ────────────────────────────────────────────────────────────────────────

const AMENITY_LABELS: Array<{ field: string; label: string }> = [
  { field: 'tem_elevador', label: 'elevador' },
  { field: 'tem_estacionamento', label: 'estacionamento' },
  { field: 'tem_garagem', label: 'garagem' },
  { field: 'tem_varanda', label: 'varanda' },
  { field: 'tem_terraco', label: 'terraço' },
  { field: 'tem_jardim', label: 'jardim' },
  { field: 'tem_quintal', label: 'quintal' },
  { field: 'tem_piscina', label: 'piscina' },
  { field: 'tem_arrumos', label: 'arrumos' },
  { field: 'tem_arrecadacao', label: 'arrecadação' },
  { field: 'tem_cozinha_equipada', label: 'cozinha equipada' },
  { field: 'tem_mobilado', label: 'mobilado' },
  { field: 'tem_aquecimento', label: 'aquecimento' },
  { field: 'tem_ar_condicionado', label: 'ar condicionado' },
  { field: 'tem_energias_renovaveis', label: 'energias renováveis' },
  { field: 'tem_seguranca', label: 'segurança' },
  { field: 'tem_porteiro', label: 'porteiro' },
  { field: 'tem_carregamento_ev', label: 'carregamento EV' },
  { field: 'tem_vistas', label: 'vistas' },
  { field: 'tem_praia', label: 'perto de praia' },
  { field: 'tem_transportes', label: 'transportes' },
]

export function buildNegocioSpecs(negocio: any): NegocioSpecs {
  const tipo = (negocio?.tipo as string) || ''
  const isVenda = tipo === 'Venda' || tipo === 'Compra e Venda'
  const isArrendador = tipo === 'Arrendador'

  const amount = isArrendador
    ? (negocio?.renda_pretendida ?? null)
    : (negocio?.preco_venda ?? null)
  const amountKind: 'price' | 'rent' | null = amount != null
    ? isArrendador
      ? 'rent'
      : 'price'
    : null

  const features: string[] = []
  for (const a of AMENITY_LABELS) {
    if (negocio?.[a.field]) features.push(a.label)
  }

  return {
    tipo,
    tipoImovel: negocio?.tipo_imovel ?? null,
    amount,
    amountKind,
    localizacao: negocio?.localizacao ?? null,
    quartos: negocio?.quartos ?? null,
    areaM2: negocio?.area_m2 ?? null,
    features,
    observacoes: negocio?.observacoes ?? null,
  }
}
