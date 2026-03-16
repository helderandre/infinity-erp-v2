// @ts-nocheck
'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PortalUser {
  id: string
  name: string
  email: string
  role: 'buyer' | 'seller' | 'both'
}

export interface ProcessSummary {
  id: string
  external_ref: string
  status: string
  percent_complete: number
  current_stage_name: string | null
  stages: ProcessStage[]
}

export interface ProcessStage {
  id: string
  name: string
  order_index: number
  status: 'completed' | 'active' | 'pending'
}

export interface PendingAction {
  id: string
  type: 'document' | 'visit' | 'message'
  title: string
  description: string
  href: string
  urgency: 'low' | 'medium' | 'high'
}

export interface PortalProperty {
  id: string
  title: string
  city: string | null
  zone: string | null
  listing_price: number | null
  status: string
  property_type: string | null
  cover_url: string | null
  typology: string | null
  area_util: number | null
  bedrooms: number | null
  days_on_market: number
  visits_count: number
  interested_count: number
  is_favorite: boolean
}

export interface ProcessDocument {
  id: string
  name: string
  status: 'missing' | 'pending' | 'approved' | 'rejected'
  uploaded_at: string | null
}

export interface ProcessEvent {
  id: string
  description: string
  created_at: string
}

export interface PortalProcessData {
  process: ProcessSummary | null
  documents: ProcessDocument[]
  events: ProcessEvent[]
}

export interface MessagePreview {
  id: string
  consultant_name: string
  content: string
  created_at: string
  is_read: boolean
}

export interface PortalHomeData {
  user: PortalUser
  process: ProcessSummary | null
  pending_actions: PendingAction[]
  properties: PortalProperty[]
  last_message: MessagePreview | null
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getPortalHome(): Promise<PortalHomeData> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) throw new Error('Não autenticado')

  // Get user profile
  const { data: devUser } = await supabase
    .from('dev_users')
    .select('id, commercial_name, professional_email')
    .eq('id', authUser.id)
    .single()

  const name = devUser?.commercial_name || authUser.email?.split('@')[0] || 'Cliente'

  // Get active process (if any)
  const { data: procData } = await supabase
    .from('proc_instances')
    .select(`
      id, external_ref, current_status, percent_complete,
      tpl_stages:current_stage_id (name)
    `)
    .eq('current_status', 'in_progress')
    .limit(1)
    .maybeSingle()

  let process: ProcessSummary | null = null
  if (procData) {
    const { data: tasks } = await supabase
      .from('proc_tasks')
      .select('stage_name, stage_order_index, status')
      .eq('proc_instance_id', procData.id)
      .order('stage_order_index')

    const stageMap = new Map<string, ProcessStage>()
    for (const t of tasks || []) {
      if (!t.stage_name || stageMap.has(t.stage_name)) continue
      const allTasksForStage = (tasks || []).filter(x => x.stage_name === t.stage_name)
      const allDone = allTasksForStage.every(x => x.status === 'completed' || x.status === 'skipped')
      const anyActive = allTasksForStage.some(x => x.status === 'in_progress')
      stageMap.set(t.stage_name, {
        id: t.stage_name,
        name: t.stage_name,
        order_index: t.stage_order_index,
        status: allDone ? 'completed' : anyActive ? 'active' : 'pending',
      })
    }

    const stageName = (procData as Record<string, unknown>).tpl_stages
    process = {
      id: procData.id,
      external_ref: procData.external_ref,
      status: procData.current_status,
      percent_complete: procData.percent_complete || 0,
      current_stage_name: typeof stageName === 'object' && stageName !== null && 'name' in stageName
        ? (stageName as { name: string }).name
        : null,
      stages: Array.from(stageMap.values()).sort((a, b) => a.order_index - b.order_index),
    }
  }

  // Get properties
  const { data: properties } = await supabase
    .from('dev_properties')
    .select(`
      id, title, city, zone, listing_price, status, property_type,
      dev_property_specifications (typology, area_util, bedrooms),
      dev_property_media (url, is_cover)
    `)
    .in('status', ['active', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(4)

  const portalProperties: PortalProperty[] = (properties || []).map(p => {
    const specs = Array.isArray(p.dev_property_specifications) ? p.dev_property_specifications[0] : p.dev_property_specifications
    const media = Array.isArray(p.dev_property_media) ? p.dev_property_media : []
    const cover = media.find((m: Record<string, unknown>) => m.is_cover) || media[0]
    return {
      id: p.id,
      title: p.title || 'Sem titulo',
      city: p.city,
      zone: p.zone,
      listing_price: p.listing_price,
      status: p.status,
      property_type: p.property_type,
      cover_url: cover?.url || null,
      typology: specs?.typology || null,
      area_util: specs?.area_util || null,
      bedrooms: specs?.bedrooms || null,
      days_on_market: 0,
      visits_count: 0,
      interested_count: 0,
      is_favorite: false,
    }
  })

  return {
    user: { id: authUser.id, name, email: authUser.email || '', role: 'buyer' },
    process,
    pending_actions: [],
    properties: portalProperties,
    last_message: null,
  }
}

export async function getPortalProperties(): Promise<{
  properties: PortalProperty[]
  user_role: 'buyer' | 'seller' | 'both'
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: properties } = await supabase
    .from('dev_properties')
    .select(`
      id, title, city, zone, listing_price, status, property_type, created_at,
      dev_property_specifications (typology, area_util, bedrooms),
      dev_property_media (url, is_cover)
    `)
    .in('status', ['active', 'pending_approval', 'sold', 'rented'])
    .order('created_at', { ascending: false })
    .limit(50)

  const now = Date.now()
  const portalProperties: PortalProperty[] = (properties || []).map(p => {
    const specs = Array.isArray(p.dev_property_specifications) ? p.dev_property_specifications[0] : p.dev_property_specifications
    const media = Array.isArray(p.dev_property_media) ? p.dev_property_media : []
    const cover = media.find((m: Record<string, unknown>) => m.is_cover) || media[0]
    const createdMs = p.created_at ? new Date(p.created_at).getTime() : now
    return {
      id: p.id,
      title: p.title || 'Sem titulo',
      city: p.city,
      zone: p.zone,
      listing_price: p.listing_price,
      status: p.status,
      property_type: p.property_type,
      cover_url: cover?.url || null,
      typology: specs?.typology || null,
      area_util: specs?.area_util || null,
      bedrooms: specs?.bedrooms || null,
      days_on_market: Math.max(0, Math.floor((now - createdMs) / 86400000)),
      visits_count: 0,
      interested_count: 0,
      is_favorite: false,
    }
  })

  return { properties: portalProperties, user_role: 'buyer' }
}

export async function getPortalProcess(): Promise<PortalProcessData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: procData } = await supabase
    .from('proc_instances')
    .select(`
      id, external_ref, current_status, percent_complete,
      tpl_stages:current_stage_id (name)
    `)
    .in('current_status', ['in_progress', 'draft', 'on_hold'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!procData) return { process: null, documents: [], events: [] }

  const { data: tasks } = await supabase
    .from('proc_tasks')
    .select('id, title, stage_name, stage_order_index, status, is_mandatory, completed_at')
    .eq('proc_instance_id', procData.id)
    .order('stage_order_index')

  const stageMap = new Map<string, ProcessStage>()
  const documents: ProcessDocument[] = []

  for (const t of tasks || []) {
    if (t.stage_name && !stageMap.has(t.stage_name)) {
      const allTasksForStage = (tasks || []).filter(x => x.stage_name === t.stage_name)
      const allDone = allTasksForStage.every(x => x.status === 'completed' || x.status === 'skipped')
      const anyActive = allTasksForStage.some(x => x.status === 'in_progress')
      stageMap.set(t.stage_name, {
        id: t.stage_name,
        name: t.stage_name,
        order_index: t.stage_order_index,
        status: allDone ? 'completed' : anyActive ? 'active' : 'pending',
      })
    }
    documents.push({
      id: t.id,
      name: t.title,
      status: t.status === 'completed' ? 'approved' : t.status === 'in_progress' ? 'pending' : 'missing',
      uploaded_at: t.completed_at || null,
    })
  }

  const stageName = (procData as Record<string, unknown>).tpl_stages
  const process: ProcessSummary = {
    id: procData.id,
    external_ref: procData.external_ref,
    status: procData.current_status,
    percent_complete: procData.percent_complete || 0,
    current_stage_name: typeof stageName === 'object' && stageName !== null && 'name' in stageName
      ? (stageName as { name: string }).name
      : null,
    stages: Array.from(stageMap.values()).sort((a, b) => a.order_index - b.order_index),
  }

  return { process, documents, events: [] }
}

export async function requestVisit(data: {
  property_id: string
  preferred_date: string
  preferred_time: string
  alternative_date?: string
  message?: string
}): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Placeholder - would insert into visits table
  console.log('Visit request:', { user_id: user.id, ...data })
  return { success: true }
}

export async function toggleFavorite(propertyId: string): Promise<{ is_favorite: boolean }> {
  // Placeholder - would toggle in portal_favorites table
  console.log('Toggle favorite:', propertyId)
  return { is_favorite: true }
}

// ─── Messages ──────────────────────────────────────────────────────────────

export interface PortalConversation {
  id: string
  consultant_name: string
  consultant_id: string
  last_message: string
  last_message_at: string
  unread_count: number
}

export interface PortalMessage {
  id: string
  sender_type: 'client' | 'consultant'
  content: string
  is_read: boolean
  created_at: string
}

export async function getPortalMessages(conversationId?: string): Promise<{
  conversations: PortalConversation[]
  messages: PortalMessage[]
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { conversations: [], messages: [], error: 'Não autenticado' }

    const admin = createAdminClient()

    if (conversationId) {
      // Get messages for this conversation
      const { data: msgs } = await (admin as any).from('temp_portal_messages')
        .select('id, sender_type, content, is_read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      // Mark as read
      await (admin as any).from('temp_portal_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'consultant')
        .eq('is_read', false)

      return { conversations: [], messages: (msgs ?? []) as PortalMessage[], error: null }
    }

    // List conversations — get distinct conversation_ids for this user
    const { data: allMsgs } = await (admin as any).from('temp_portal_messages')
      .select('conversation_id, sender_type, sender_id, content, is_read, created_at')
      .or(`sender_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    // Group by conversation
    const convMap = new Map<string, { msgs: any[]; consultantId: string }>()
    for (const m of (allMsgs ?? [])) {
      if (!convMap.has(m.conversation_id)) {
        const consultantId = m.sender_type === 'consultant' ? m.sender_id : m.conversation_id
        convMap.set(m.conversation_id, { msgs: [], consultantId })
      }
      convMap.get(m.conversation_id)!.msgs.push(m)
    }

    // Build conversations list
    const conversations: PortalConversation[] = []
    for (const [convId, { msgs, consultantId }] of convMap) {
      const { data: consultant } = await admin.from('dev_users')
        .select('commercial_name').eq('id', consultantId).single()

      const lastMsg = msgs[0]
      const unread = msgs.filter((m: any) => m.sender_type === 'consultant' && !m.is_read).length

      conversations.push({
        id: convId,
        consultant_name: consultant?.commercial_name ?? 'Consultor',
        consultant_id: consultantId,
        last_message: lastMsg?.content ?? '',
        last_message_at: lastMsg?.created_at ?? '',
        unread_count: unread,
      })
    }

    return { conversations, messages: [], error: null }
  } catch (err: any) {
    return { conversations: [], messages: [], error: err.message }
  }
}

export async function sendPortalMessage(conversationId: string, content: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

    const admin = createAdminClient()
    const { error } = await (admin as any).from('temp_portal_messages').insert({
      conversation_id: conversationId,
      sender_type: 'client',
      sender_id: user.id,
      content,
    })

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ─── Profile ───────────────────────────────────────────────────────────────

export interface PortalProfile {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  nif: string | null
}

export async function getPortalProfile(): Promise<{ profile: PortalProfile | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { profile: null, error: 'Não autenticado' }

    const admin = createAdminClient()
    const { data: dbUser } = await admin.from('dev_users')
      .select('id, commercial_name, professional_email')
      .eq('id', user.id)
      .single()

    if (!dbUser) return { profile: null, error: 'Utilizador não encontrado' }

    // Try to find owner record for extra data
    const { data: owner } = await admin.from('owners')
      .select('phone, nif, address')
      .eq('email', dbUser.professional_email)
      .maybeSingle()

    return {
      profile: {
        id: dbUser.id,
        name: dbUser.commercial_name ?? '',
        email: dbUser.professional_email ?? user.email ?? '',
        phone: owner?.phone ?? null,
        address: owner?.address ?? null,
        postal_code: null,
        city: null,
        nif: owner?.nif ?? null,
      },
      error: null,
    }
  } catch (err: any) {
    return { profile: null, error: err.message }
  }
}

export async function updatePortalProfile(data: {
  name?: string; phone?: string; address?: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

    const admin = createAdminClient()
    if (data.name) {
      await admin.from('dev_users').update({ commercial_name: data.name }).eq('id', user.id)
    }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
