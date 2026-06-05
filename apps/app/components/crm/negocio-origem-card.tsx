'use client'

import { useState } from 'react'
import { ChevronDown, FileText, Home, ExternalLink, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  website: 'Website',
  landing_page: 'Landing Page',
  partner: 'Parceiro',
  organic: 'Orgânico',
  walk_in: 'Presencial',
  phone_call: 'Chamada',
  social_media: 'Redes Sociais',
  manual: 'Manual',
  portal: 'Portal',
  other: 'Outro',
}

// Internal/plumbing keys we don't want to surface as "form answers".
const HIDDEN_FORM_KEYS = new Set([
  'leadgen_id', 'form_id', 'meta_campaign_id', 'meta_adset_id', 'meta_ad_id',
  'property_id', 'property_external_ref', 'portal', 'raw_fields',
])

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nome',
  name: 'Nome',
  email: 'Email',
  phone: 'Telefone',
  phone_number: 'Telefone',
  message: 'Mensagem',
  mensagem: 'Mensagem',
  budget: 'Orçamento',
  zona: 'Zona',
  localizacao: 'Localização',
}

type Pair = { key: string; label: string; value: string }

function prettyLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function toScalar(v: unknown): string | null {
  if (v == null) return null
  if (Array.isArray(v)) {
    const joined = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')
    return joined || null
  }
  if (typeof v === 'object') return null
  const s = String(v).trim()
  return s || null
}

/** Flatten a form_data blob into displayable answer pairs. Handles Meta's
 *  `raw_fields` (object or array of {name, values}) and flat website/portal
 *  payloads alike. */
function extractPairs(formData: Record<string, unknown> | null | undefined): Pair[] {
  if (!formData || typeof formData !== 'object') return []
  const pairs: Pair[] = []
  const push = (key: string, value: unknown) => {
    const s = toScalar(value)
    if (s) pairs.push({ key, label: prettyLabel(key), value: s })
  }

  const raw = (formData as Record<string, unknown>).raw_fields
  if (Array.isArray(raw)) {
    for (const f of raw as Array<Record<string, unknown>>) {
      const name = (f.name ?? f.field ?? f.key) as string | undefined
      const value = f.values ?? f.value
      if (name) push(name, value)
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) push(k, v)
  }

  for (const [k, v] of Object.entries(formData)) {
    if (HIDDEN_FORM_KEYS.has(k)) continue
    push(k, v)
  }
  // De-dup by key (raw_fields wins since it's pushed first).
  const seen = new Set<string>()
  return pairs.filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)))
}

interface NegocioOrigemCardProps {
  negocio: any
  onPreviewProperty?: (propertyId: string) => void
}

/**
 * Surfaces where the opportunity came from — the property the lead manifested
 * interest in (Meta Ads / portal attribution) and the original form they
 * submitted. Both were captured on the lead entry and were previously lost
 * once the lead was qualified into a négocio. Renders nothing when there's no
 * originating entry/property to show (e.g. manually-created deals).
 */
export function NegocioOrigemCard({ negocio, onPreviewProperty }: NegocioOrigemCardProps) {
  const [open, setOpen] = useState(false)

  const property = negocio?.origin_property ?? null
  const entry = negocio?.entry ?? null
  const source = (entry?.source ?? negocio?.origem) as string | null
  const sourceLabel = source ? SOURCE_LABELS[source] ?? source : null
  const pairs = extractPairs(entry?.form_data)
  const formUrl = entry?.form_url as string | null
  const utms = [entry?.utm_source, entry?.utm_medium, entry?.utm_campaign]
    .filter(Boolean) as string[]

  // Nothing meaningful to show.
  if (!property && !entry) return null

  return (
    <section className="rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">Origem do lead</h3>
        {sourceLabel && (
          <span className="ml-auto inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sourceLabel}
          </span>
        )}
      </div>

      {/* Property of origin — the listing the lead came from. */}
      {property && (
        <button
          type="button"
          onClick={() => onPreviewProperty?.(property.id)}
          disabled={!onPreviewProperty}
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5 text-left transition-colors',
            onPreviewProperty && 'hover:bg-muted/50',
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <Home className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {property.title || property.external_ref || 'Imóvel'}
            </span>
            {[property.external_ref, property.city].filter(Boolean).length > 0 && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {[property.external_ref, property.city].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          {onPreviewProperty && (
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </button>
      )}

      {/* Original form submitted by the lead. */}
      {(pairs.length > 0 || formUrl || utms.length > 0) && (
        <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px] font-medium">Formulário</span>
            {pairs.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{pairs.length}</span>
            )}
            <ChevronDown
              className={cn(
                'ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
          {open && (
            <div className="border-t border-border/50 px-3 py-2.5 space-y-2">
              {pairs.length > 0 && (
                <dl className="space-y-1.5">
                  {pairs.map((p) => (
                    <div key={p.key} className="flex gap-2 text-[12px]">
                      <dt className="w-28 shrink-0 text-muted-foreground truncate">{p.label}</dt>
                      <dd className="min-w-0 flex-1 break-words font-medium">{p.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {utms.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {utms.map((u, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {u}
                    </span>
                  ))}
                </div>
              )}
              {formUrl && (
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir formulário
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
