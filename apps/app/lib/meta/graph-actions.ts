'use server'

/**
 * Write actions against the live Meta Graph API for the CRM → Análise → Meta
 * tab (management only): pause/activate a campaign or ad, and create a new
 * campaign (campaign → adset → creative → ad, all PAUSED).
 *
 * Credentials come from env (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID), mirroring
 * the (now-retired) /dashboard/meta-ads module. After a status toggle we also
 * patch the synced mirror row so the UI reflects the change without waiting for
 * the next sync.
 */

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

const GRAPH = 'https://graph.facebook.com/v21.0'

async function requireManagement(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuth()
  if (!auth.authorized) return { ok: false, error: 'Não autenticado' }
  if (!isManagementRole(auth.roles)) return { ok: false, error: 'Sem permissão' }
  return { ok: true }
}

function accountId(): string | null {
  const raw = process.env.META_AD_ACCOUNT_ID
  if (!raw) return null
  return raw.startsWith('act_') ? raw : `act_${raw}`
}

export interface MetaPage {
  id: string
  name: string
}

/**
 * Pause/activate a campaign or ad. Patches the live entity, then mirrors the new
 * status into meta_campaigns_raw / meta_ads_raw so the grid updates immediately.
 */
export async function toggleMetaEntityStatus(
  level: 'campaign' | 'adset' | 'ad',
  entityId: string,
  newStatus: 'ACTIVE' | 'PAUSED',
): Promise<{ success: boolean; error: string | null }> {
  const gate = await requireManagement()
  if (!gate.ok) return { success: false, error: gate.error }

  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return { success: false, error: 'META_ACCESS_TOKEN não configurado' }

  try {
    const res = await fetch(`${GRAPH}/${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, access_token: accessToken }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      return { success: false, error: err?.error?.message ?? `HTTP ${res.status}` }
    }

    // Best-effort mirror update so the UI reflects the new status right away.
    // Adsets aren't synced as their own entity, so there's nothing to patch.
    if (level !== 'adset') {
      try {
        const db = createCrmAdminClient()
        const table = level === 'campaign' ? 'meta_campaigns_raw' : 'meta_ads_raw'
        const idCol = level === 'campaign' ? 'campaign_id' : 'ad_id'
        await db.schema('meta').from(table).update({ status: newStatus }).eq(idCol, entityId)
      } catch {
        // non-fatal — next sync corrects it
      }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

/**
 * Get the Facebook Pages available for the ad creative's page_id (create form).
 */
export async function getMetaPagesAction(): Promise<MetaPage[]> {
  const gate = await requireManagement()
  if (!gate.ok) return []

  const accessToken = process.env.META_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN
  if (!accessToken) return []

  try {
    let pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name&access_token=${accessToken}`, {
      next: { revalidate: 3600 },
    })

    if (!pagesRes.ok) {
      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET
      if (appId && appSecret) {
        const debugRes = await fetch(
          `${GRAPH}/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
        )
        if (debugRes.ok) {
          const debugData = await debugRes.json()
          const userId = debugData?.data?.user_id as string | undefined
          if (userId) {
            pagesRes = await fetch(`${GRAPH}/${userId}/accounts?fields=id,name&access_token=${accessToken}`, {
              next: { revalidate: 3600 },
            })
          }
        }
      }
    }

    if (!pagesRes.ok) return []
    const body = await pagesRes.json()
    return (body.data ?? []).map((p: Record<string, string>) => ({ id: p.id, name: p.name }))
  } catch {
    return []
  }
}

export interface CreateMetaCampaignParams {
  name: string
  objective: string
  dailyBudget: number
  targeting: { ageMin: number; ageMax: number; countries: string[]; genders?: number[] }
  adCreative: {
    pageId: string
    imageUrl?: string
    videoUrl?: string
    headline: string
    body: string
    linkUrl: string
    callToAction: string
  }
}

/**
 * Create a campaign + adset + creative + ad (all PAUSED). The consultant then
 * reviews & activates it in Meta Ads Manager (or here via the toggle).
 */
export async function createMetaCampaignAction(
  params: CreateMetaCampaignParams,
): Promise<{ success: boolean; campaignId: string | null; error: string | null }> {
  const gate = await requireManagement()
  if (!gate.ok) return { success: false, campaignId: null, error: gate.error }

  const accessToken = process.env.META_ACCESS_TOKEN
  const account = accountId()
  if (!accessToken || !account) {
    return { success: false, campaignId: null, error: 'Credenciais Meta não configuradas' }
  }

  try {
    // 1. Campaign
    const campaignRes = await fetch(`${GRAPH}/${account}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        objective: params.objective,
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: accessToken,
      }),
    })
    if (!campaignRes.ok) {
      const err = await campaignRes.json().catch(() => null)
      return { success: false, campaignId: null, error: err?.error?.message ?? 'Erro ao criar campanha' }
    }
    const campaignId = (await campaignRes.json()).id as string

    // 2. Ad Set
    const targeting: Record<string, unknown> = {
      age_min: params.targeting.ageMin,
      age_max: params.targeting.ageMax,
      geo_locations: { countries: params.targeting.countries },
    }
    if (params.targeting.genders?.length) targeting.genders = params.targeting.genders

    const adSetRes = await fetch(`${GRAPH}/${account}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${params.name} — Ad Set`,
        campaign_id: campaignId,
        daily_budget: Math.round(params.dailyBudget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: params.objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'LINK_CLICKS',
        targeting,
        status: 'PAUSED',
        access_token: accessToken,
      }),
    })
    if (!adSetRes.ok) {
      const err = await adSetRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? 'Erro ao criar conjunto de anúncios' }
    }
    const adSetId = (await adSetRes.json()).id as string

    // 3. Creative
    const storySpec: Record<string, unknown> = { page_id: params.adCreative.pageId }
    if (params.adCreative.videoUrl) {
      storySpec.video_data = {
        video_url: params.adCreative.videoUrl,
        title: params.adCreative.headline,
        message: params.adCreative.body,
        link_description: params.adCreative.headline,
        call_to_action: { type: params.adCreative.callToAction, value: { link: params.adCreative.linkUrl } },
      }
    } else {
      storySpec.link_data = {
        image_url: params.adCreative.imageUrl,
        link: params.adCreative.linkUrl,
        message: params.adCreative.body,
        name: params.adCreative.headline,
        call_to_action: { type: params.adCreative.callToAction, value: { link: params.adCreative.linkUrl } },
      }
    }

    const creativeRes = await fetch(`${GRAPH}/${account}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${params.name} — Creative`,
        object_story_spec: storySpec,
        access_token: accessToken,
      }),
    })
    if (!creativeRes.ok) {
      const err = await creativeRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? 'Erro ao criar criativo' }
    }
    const creativeId = (await creativeRes.json()).id as string

    // 4. Ad
    const adRes = await fetch(`${GRAPH}/${account}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${params.name} — Ad`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
        access_token: accessToken,
      }),
    })
    if (!adRes.ok) {
      const err = await adRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? 'Erro ao criar anúncio' }
    }

    return { success: true, campaignId, error: null }
  } catch (err) {
    return { success: false, campaignId: null, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}
