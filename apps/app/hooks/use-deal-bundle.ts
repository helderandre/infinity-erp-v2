'use client'

import { useCallback, useEffect, useState } from 'react'

// ─── Shared deal/negócio bundle loader ───────────────────────────────────────
//
// Single source of truth for the rich deal detail view (rendered by
// `<DealDetailTabs>` on BOTH `/dashboard/negocios/[id]` and
// `/dashboard/financeiro/deals/[id]`).
//
// Accepts EITHER a `negocio_id` OR a `deal_id` and resolves the full bundle:
//   1. GET /api/negocios/{id}/related            → negócio-linked bundle
//   2. 404 → GET /api/deals/{id}
//        • deal has negocio_id → load related for it (resolvedNegocioId set so
//          the negócios route can canonicalize its URL)
//        • deal has NO negocio_id → build a deal-only bundle (negocio: null)
//
// The financeiro route ignores `resolvedNegocioId` (it stays at
// /dashboard/financeiro/deals/[id]); the negócios route uses it to replace the
// URL with the canonical negocio_id.

export interface NegocioBundle {
  negocio: {
    id: string
    tipo: string | null
    pipeline_stage_id: string | null
    pipeline_stage?: { id: string; name: string; color: string | null; pipeline_type: string } | null
    expected_value: number | null
    expected_close_date: string | null
    won_date: string | null
    lost_date: string | null
    lost_reason: string | null
    temperatura: string | null
    origem: string | null
    classe_imovel: string | null
    quartos: number | null
    area_m2: number | null
    orcamento: number | null
    orcamento_max: number | null
    financiamento_necessario: boolean | null
    credito_pre_aprovado: boolean | null
    valor_credito: number | null
    observacoes: string | null
    property_id: string | null
    assigned_consultant_id: string | null
    lead?: {
      id: string
      nome: string
      full_name: string | null
      email: string | null
      telemovel: string | null
      empresa: string | null
      nipc: string | null
    } | null
  } | null
  property: {
    id: string
    address_street: string | null
    city: string | null
    zone?: string | null
    title?: string | null
    external_ref?: string | null
    listing_price?: number | null
    property_type?: string | null
  } | null
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url: string | null
    email: string | null
    phone: string | null
  } | null
  deal: {
    id: string
    reference: string | null
    pv_number?: string | null
    status: string | null
    deal_type: string | null
    deal_value: number | null
    deal_date: string | null
    commission_pct: number | null
    commission_total: number | null
    payment_structure: string | null
    contract_signing_date: string | null
    max_deadline: string | null
    proc_instance_id: string | null
    property_id?: string | null
    external_property_link?: string | null
    external_property_zone?: string | null
    external_property_typology?: string | null
    external_property_type?: string | null
    external_property_construction_year?: string | null
    external_property_extra?: string | null
  } | null
  payments: Array<{
    id: string
    payment_moment: string | null
    payment_pct: number | null
    amount: number | null
    network_amount: number | null
    agency_amount: number | null
    consultant_amount: number | null
    is_signed: boolean | null
    is_received: boolean | null
    signed_date: string | null
    received_date: string | null
  }>
  proc_instance: {
    id: string
    external_ref: string | null
    current_status: string | null
  } | null
  moments: Array<{
    id: string
    moment_type: 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'
    photo_urls: string[]
    manual_caption: string | null
    ai_description: string | null
    created_at: string
  }>
}

type ConsultantRaw =
  | {
      id: string
      commercial_name: string
      professional_email: string | null
      dev_consultant_profiles?:
        | { profile_photo_url: string | null; phone_commercial: string | null }
        | { profile_photo_url: string | null; phone_commercial: string | null }[]
        | null
    }
  | null

/** Flatten the joined consultant payload (`dev_consultant_profiles` may be an array). */
function mapConsultant(raw: ConsultantRaw): NegocioBundle['consultant'] {
  if (!raw) return null
  const profile = raw.dev_consultant_profiles
    ? Array.isArray(raw.dev_consultant_profiles)
      ? raw.dev_consultant_profiles[0]
      : raw.dev_consultant_profiles
    : null
  return {
    id: raw.id,
    commercial_name: raw.commercial_name,
    profile_photo_url: profile?.profile_photo_url ?? null,
    email: raw.professional_email ?? null,
    phone: profile?.phone_commercial ?? null,
  }
}

/** Map the `/api/negocios/[id]/related` payload to the normalized bundle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRelated(payload: any): NegocioBundle {
  const propertyRaw = payload.negocio?.property ?? null
  const property = propertyRaw
    ? {
        id: propertyRaw.id,
        address_street: propertyRaw.address_street ?? null,
        city: propertyRaw.city ?? null,
        zone: propertyRaw.zone ?? null,
        title: propertyRaw.title ?? null,
        external_ref: propertyRaw.external_ref ?? null,
        listing_price: propertyRaw.listing_price ?? null,
        property_type: propertyRaw.property_type ?? null,
      }
    : null

  return {
    negocio: payload.negocio ?? null,
    property,
    consultant: mapConsultant((payload.negocio?.consultant ?? null) as ConsultantRaw),
    deal: payload.deal ?? null,
    payments: payload.payments ?? [],
    proc_instance: payload.proc_instance ?? null,
    moments: payload.moments ?? [],
  }
}

/**
 * Build a deal-only bundle (negocio: null) from a `/api/deals/[id]` payload.
 * Used for drafts that have no linked negócio. The Financeiro / Momentos /
 * Compliance tabs self-fetch by `deal_id`, so they still work; Resumo and
 * Documentos (negócio-scoped) show empty states.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDealOnly(deal: any): NegocioBundle {
  const propertyRaw = deal.property ?? null
  const property = propertyRaw
    ? {
        id: propertyRaw.id,
        address_street: propertyRaw.address_street ?? null,
        city: propertyRaw.city ?? null,
        zone: propertyRaw.zone ?? null,
        title: propertyRaw.title ?? null,
        external_ref: propertyRaw.external_ref ?? null,
        listing_price: propertyRaw.listing_price ?? null,
        property_type: propertyRaw.property_type ?? null,
      }
    : null

  return {
    negocio: null,
    property,
    consultant: deal.consultant
      ? {
          id: deal.consultant.id,
          commercial_name: deal.consultant.commercial_name,
          profile_photo_url: null,
          email: null,
          phone: null,
        }
      : null,
    deal: {
      id: deal.id,
      reference: deal.reference ?? null,
      pv_number: deal.pv_number ?? null,
      status: deal.status ?? null,
      deal_type: deal.deal_type ?? null,
      deal_value: deal.deal_value ?? null,
      deal_date: deal.deal_date ?? null,
      commission_pct: deal.commission_pct ?? null,
      commission_total: deal.commission_total ?? null,
      payment_structure: deal.payment_structure ?? null,
      contract_signing_date: deal.contract_signing_date ?? null,
      max_deadline: deal.max_deadline ?? null,
      proc_instance_id: deal.proc_instance_id ?? null,
      property_id: deal.property_id ?? null,
      external_property_link: deal.external_property_link ?? null,
      external_property_zone: deal.external_property_zone ?? null,
      external_property_typology: deal.external_property_typology ?? null,
      external_property_type: deal.external_property_type ?? null,
      external_property_construction_year: deal.external_property_construction_year ?? null,
      external_property_extra: deal.external_property_extra ?? null,
    },
    payments: [],
    proc_instance: deal.proc_instance_id
      ? { id: deal.proc_instance_id, external_ref: null, current_status: null }
      : null,
    moments: [],
  }
}

export interface UseDealBundleResult {
  bundle: NegocioBundle | null
  isLoading: boolean
  error: string | null
  /** The negocio_id the input id resolved to (null for deal-only). */
  resolvedNegocioId: string | null
  refetch: (opts?: { silent?: boolean }) => Promise<void>
}

export function useDealBundle(id: string): UseDealBundleResult {
  const [bundle, setBundle] = useState<NegocioBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvedNegocioId, setResolvedNegocioId] = useState<string | null>(null)

  const fetchBundle = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setIsLoading(true)
      setError(null)
      try {
        // 1. Probe as a negocio_id.
        const probe = await fetch(`/api/negocios/${id}/related`)
        if (probe.ok) {
          const payload = await probe.json()
          setBundle(mapRelated(payload))
          setResolvedNegocioId(payload.negocio?.id ?? null)
          return
        }
        if (probe.status !== 404) throw new Error('Erro a carregar oportunidade')

        // 2. Not a negocio_id — try as a deal_id.
        const dRes = await fetch(`/api/deals/${id}`)
        if (!dRes.ok) throw new Error('Oportunidade não encontrada')
        const deal = await dRes.json()
        const negocioId: string | null = deal?.negocio_id ?? deal?.data?.negocio_id ?? null

        if (negocioId) {
          const rel = await fetch(`/api/negocios/${negocioId}/related`)
          if (!rel.ok) throw new Error('Oportunidade não encontrada')
          const payload = await rel.json()
          setBundle(mapRelated(payload))
          setResolvedNegocioId(negocioId)
          return
        }

        // 3. Deal with no linked negócio — deal-only bundle.
        setBundle(mapDealOnly(deal))
        setResolvedNegocioId(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro a carregar oportunidade')
      } finally {
        if (!opts.silent) setIsLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    void fetchBundle()
  }, [fetchBundle])

  return { bundle, isLoading, error, resolvedNegocioId, refetch: fetchBundle }
}
