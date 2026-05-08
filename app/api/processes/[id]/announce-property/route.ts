import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { INTERNAL_CHAT_CHANNEL_ID, getDmChannelId } from '@/lib/constants'
import { ensureDmMembership } from '@/lib/chat/membership'

/**
 * POST /api/processes/[id]/announce-property
 *
 * Body: { message: string }
 *
 * Insere uma mensagem no canal Geral (`INTERNAL_CHAT_CHANNEL_ID`) a anunciar
 * a publicação da angariação. A mensagem leva o copy editável fornecido pela
 * gestão + um bloco markdown com os detalhes do imóvel. Se houver foto de
 * capa, também cria um row em `internal_chat_attachments` apontado ao mesmo
 * URL do R2 (sem re-upload — re-uso da chave existente).
 *
 * Auth: gated a `isManagementRole` (Broker/CEO + Office Manager + Gestor
 * Processual). Consultores não têm o botão; tentativa via API → 403.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    if (!isManagementRole(auth.roles)) {
      return NextResponse.json(
        { error: 'Apenas a gestão pode anunciar a publicação.' },
        { status: 403 }
      )
    }

    const { id: procId } = await params

    let body: { message?: string; target?: 'general' | 'dm'; recipientId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const editableMessage = (body.message || '').trim()
    if (!editableMessage) {
      return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 })
    }
    const target: 'general' | 'dm' = body.target === 'dm' ? 'dm' : 'general'
    const recipientId = body.recipientId?.trim() || null
    if (target === 'dm') {
      if (!recipientId) {
        return NextResponse.json(
          { error: 'recipientId é obrigatório para DM.' },
          { status: 400 }
        )
      }
      if (recipientId === auth.user.id) {
        return NextResponse.json(
          { error: 'Não podes enviar uma DM a ti próprio.' },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()

    // Carregar processo + imóvel + media + consultor.
    const { data: proc } = await supabase
      .from('proc_instances')
      .select('id, property_id, process_type')
      .eq('id', procId)
      .maybeSingle()
    if (!proc?.property_id) {
      return NextResponse.json({ error: 'Processo sem imóvel.' }, { status: 404 })
    }

    const { data: property } = await supabase
      .from('dev_properties')
      .select(
        `id, slug, title, external_ref, listing_price, business_type, property_type,
         city, zone, address_parish, consultant_id,
         dev_property_specifications(area_util, area_gross, bedrooms, bathrooms, typology),
         dev_property_media(url, is_cover, order_index, media_type)`
      )
      .eq('id', proc.property_id)
      .maybeSingle()
    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    // Cover photo (foto principal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMedia = (property.dev_property_media || []) as any[]
    const photos = allMedia
      .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d' && m.media_type !== 'video')
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const cover = photos.find((m) => m.is_cover) ?? photos[0] ?? null

    // Consultor — nome + foto de perfil (para o card render)
    let consultantName: string | null = null
    let consultantPhoto: string | null = null
    if (property.consultant_id) {
      const { data: consultant } = await supabase
        .from('dev_users')
        .select('id, commercial_name, dev_consultant_profiles(profile_photo_url)')
        .eq('id', property.consultant_id)
        .maybeSingle()
      consultantName = consultant?.commercial_name ?? null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cp = (consultant as any)?.dev_consultant_profiles
      consultantPhoto =
        (Array.isArray(cp) ? cp[0]?.profile_photo_url : cp?.profile_photo_url) ?? null
    }

    // ── Construir conteúdo final em markdown ───────────────────────────
    // Mensagem editável (do utilizador) + bloco estruturado com detalhes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specsRaw = property.dev_property_specifications as any
    const specs = Array.isArray(specsRaw) ? specsRaw[0] : specsRaw

    const lines: string[] = [editableMessage, '']
    const titleLine = property.title || property.external_ref || 'Imóvel'
    lines.push(`**${titleLine}**`)

    const locationParts = [property.address_parish, property.city, property.zone]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
    if (locationParts.length > 0) {
      lines.push(`📍 ${locationParts.join(', ')}`)
    }

    if (property.listing_price && property.listing_price > 0) {
      const priceFmt = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(property.listing_price))
      lines.push(`💶 ${priceFmt}`)
    }

    const specBits: string[] = []
    if (specs?.typology) specBits.push(`🛏️ ${specs.typology}`)
    if (specs?.bedrooms) specBits.push(`${specs.bedrooms} quartos`)
    if (specs?.bathrooms) specBits.push(`🛁 ${specs.bathrooms} WC`)
    if (specs?.area_util) specBits.push(`📐 ${specs.area_util} m²`)
    if (specBits.length > 0) lines.push(specBits.join(' · '))

    if (consultantName) {
      lines.push('')
      lines.push(`Angariador: **${consultantName}**`)
    }

    const propertyUrl = `/dashboard/imoveis/${property.slug || property.id}`
    lines.push('')
    lines.push(`🔗 ${propertyUrl}`)

    const content = lines.join('\n')

    // ── Resolver canal alvo ────────────────────────────────────────────
    let channelId: string = INTERNAL_CHAT_CHANNEL_ID
    if (target === 'dm' && recipientId) {
      channelId = getDmChannelId(auth.user.id, recipientId)
      // Garante que ambos são membros do canal DM antes do INSERT — RLS
      // de internal_chat_messages exige membership.
      const ensure = await ensureDmMembership(
        createAdminClient(),
        channelId,
        [auth.user.id, recipientId]
      )
      if (!ensure.ok) {
        return NextResponse.json(
          { error: 'Não foi possível criar a DM.', details: ensure.error },
          { status: 500 }
        )
      }
    }

    // ── Construir metadata estruturada para render custom no chat panel
    const metadata = {
      kind: 'property_announcement',
      custom_message: editableMessage,
      property: {
        id: property.id,
        slug: property.slug,
        title: property.title,
        external_ref: property.external_ref,
        listing_price: property.listing_price,
        property_type: property.property_type,
        business_type: property.business_type,
        city: property.city,
        zone: property.zone,
        address_parish: property.address_parish,
        cover_url: cover?.url ?? null,
        typology: specs?.typology ?? null,
        bedrooms: specs?.bedrooms ?? null,
        bathrooms: specs?.bathrooms ?? null,
        area_util: specs?.area_util ?? null,
      },
      consultant: property.consultant_id
        ? {
            id: property.consultant_id,
            name: consultantName,
            photo: consultantPhoto,
          }
        : null,
    }

    // ── Inserir mensagem ───────────────────────────────────────────────
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }
    const { data: inserted, error: insertErr } = await db
      .from('internal_chat_messages')
      .insert({
        channel_id: channelId,
        sender_id: auth.user.id,
        content,
        mentions: [],
        metadata,
      })
      .select('id')
      .single()
    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: 'Erro ao publicar mensagem.', details: insertErr?.message },
        { status: 500 }
      )
    }

    // Nota: a foto de capa já vai dentro do `metadata.property.cover_url` —
    // o chat panel renderiza-a inline no card, sem precisar de attachment.
    // Clientes antigos (sem suporte a metadata) caem para o `content` em
    // markdown, que continua a ser preenchido como fallback textual.

    return NextResponse.json({ ok: true, message_id: inserted.id })
  } catch (error) {
    console.error('[announce-property] error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * GET — devolve um payload de "preview" para o editor mostrar antes de
 * enviar (consultor name, cover URL, título, especificações, preço).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id: procId } = await params
    const supabase = await createClient()

    const { data: proc } = await supabase
      .from('proc_instances')
      .select('id, property_id')
      .eq('id', procId)
      .maybeSingle()
    if (!proc?.property_id) {
      return NextResponse.json({ error: 'Processo sem imóvel.' }, { status: 404 })
    }

    const { data: property } = await supabase
      .from('dev_properties')
      .select(
        `id, slug, title, external_ref, listing_price, business_type, property_type,
         city, zone, address_parish, consultant_id,
         dev_property_specifications(area_util, area_gross, bedrooms, bathrooms, typology),
         dev_property_media(url, is_cover, order_index, media_type)`
      )
      .eq('id', proc.property_id)
      .maybeSingle()
    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMedia = (property.dev_property_media || []) as any[]
    const photos = allMedia
      .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d' && m.media_type !== 'video')
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const cover = photos.find((m) => m.is_cover) ?? photos[0] ?? null

    let consultant: { id: string; name: string | null; photo: string | null } | null = null
    if (property.consultant_id) {
      const { data: c } = await supabase
        .from('dev_users')
        .select('id, commercial_name, dev_consultant_profiles(profile_photo_url)')
        .eq('id', property.consultant_id)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cp = (c as any)?.dev_consultant_profiles
      const profilePhoto = (Array.isArray(cp) ? cp[0]?.profile_photo_url : cp?.profile_photo_url) ?? null
      consultant = {
        id: property.consultant_id,
        name: c?.commercial_name ?? null,
        photo: profilePhoto,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specsRaw = property.dev_property_specifications as any
    const specs = Array.isArray(specsRaw) ? specsRaw[0] : specsRaw

    return NextResponse.json({
      property: {
        id: property.id,
        slug: property.slug,
        title: property.title,
        external_ref: property.external_ref,
        listing_price: property.listing_price,
        property_type: property.property_type,
        business_type: property.business_type,
        city: property.city,
        zone: property.zone,
        address_parish: property.address_parish,
        cover_url: cover?.url ?? null,
        typology: specs?.typology ?? null,
        bedrooms: specs?.bedrooms ?? null,
        bathrooms: specs?.bathrooms ?? null,
        area_util: specs?.area_util ?? null,
      },
      consultant,
    })
  } catch (error) {
    console.error('[announce-property] GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
