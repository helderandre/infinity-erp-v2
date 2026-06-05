import type { IngestLeadInput } from '@/lib/crm/ingest-lead'
import type { MubeLeadPayload } from '@/lib/mube/types'

/**
 * Map a Mube/Meta lead payload to the unified ingestLead input. Shared by the
 * webhook bridge, the retroactive backfill, and the manual-assign endpoint so
 * the form_data shape (meta_ad_id / meta_adset_id / meta_campaign_id) stays
 * identical across all three — the attribution engine reads those keys.
 */
export function metaLeadToIngestInput(
  lead: MubeLeadPayload,
  adsetId: string | null,
): IngestLeadInput {
  const rawFields: Record<string, string> = {}
  for (const f of lead.field_data ?? []) {
    rawFields[f.name] = f.values?.[0] ?? ''
  }

  // Meta's top-level email/phone are only populated for the STANDARD lead-form
  // fields. Forms that use custom question labels (e.g. "e-mail",
  // "número_de_telefone") deliver those answers only inside field_data, leaving
  // lead.email/lead.phone empty — which previously meant the contact landed
  // with no contactable email/phone. Recover them from the raw fields.
  const email = lead.email?.trim() || pickEmailFromFields(rawFields)
  const phone = lead.phone?.trim() || pickPhoneFromFields(rawFields)
  const name =
    lead.full_name?.trim() ||
    pickNameFromFields(rawFields) ||
    email?.split('@')[0] ||
    'Lead Meta'

  return {
    name,
    email,
    phone,
    source: 'meta_ads',
    form_data: {
      leadgen_id: lead.leadgen_id,
      form_id: lead.form_id,
      page_id: lead.page_id,
      meta_campaign_id: lead.campaign_id,
      meta_ad_id: lead.ad_id,
      meta_adset_id: adsetId,
      raw_fields: rawFields,
    },
  }
}

// ── Field recovery helpers ──────────────────────────────────────────────────
// Meta lead-form question labels are author-defined and locale-specific, so we
// match by key heuristics first, then fall back to value-shape detection.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function pickEmailFromFields(fields: Record<string, string>): string | null {
  // 1. Key looks like an email field ("email", "e-mail", "e_mail", "correo").
  for (const [key, value] of Object.entries(fields)) {
    if (value && /mail|correo/i.test(key) && EMAIL_RE.test(value.trim())) {
      return value.trim()
    }
  }
  // 2. Any value that looks like an email address.
  for (const value of Object.values(fields)) {
    if (value && EMAIL_RE.test(value.trim())) return value.trim()
  }
  return null
}

function pickPhoneFromFields(fields: Record<string, string>): string | null {
  // Key mentions phone in PT/EN/ES ("telefone", "telemóvel", "phone",
  // "contacto", "número").
  for (const [key, value] of Object.entries(fields)) {
    if (value && /tele(fone|m|phone)|phone|contac?to|n[uú]mero/i.test(key)) {
      return value.trim()
    }
  }
  // Fallback: a value that is mostly digits (+ optional leading +).
  for (const value of Object.values(fields)) {
    const v = value?.trim() ?? ''
    if (v && /^\+?[\d\s().-]{7,}$/.test(v)) return v
  }
  return null
}

function pickNameFromFields(fields: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (value && /(nome|name|nombre)/i.test(key) && !/mail/i.test(key)) {
      return value.trim()
    }
  }
  return null
}
