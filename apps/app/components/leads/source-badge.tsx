'use client'

/**
 * Origem / portal → company icon (Google favicon service) + colour-coded tag.
 *
 * For `source='portal'` the specific portal lives in `form_data.portal`
 * (e.g. "idealista", "imovirtual"), so callers pass it via the `portal` prop.
 * Unknown sources fall back to a generic globe icon.
 */

import type { ElementType } from 'react'
import { Globe, Building2, Handshake, Mic, Pencil, Phone } from 'lucide-react'
import { ENTRY_SOURCE_LABELS } from '@/lib/constants-leads-crm'
import { cn } from '@/lib/utils'

export interface SourceBrand {
  label: string
  color: string
  /** Domain for the Google favicon; when absent, `Icon` is used instead. */
  domain?: string
  Icon?: ElementType
}

const SOURCE_BRAND: Record<string, SourceBrand> = {
  meta_ads:     { label: 'Meta Ads',      color: '#1877F2', domain: 'facebook.com' },
  google_ads:   { label: 'Google Ads',    color: '#EA4335', domain: 'google.com' },
  website:      { label: 'Website',       color: '#10b981', domain: 'infinitygroup.pt' },
  landing_page: { label: 'Landing Page',  color: '#6366f1', domain: 'infinitygroup.pt' },
  partner:      { label: 'Parceiro',      color: '#f59e0b', Icon: Handshake },
  organic:      { label: 'Orgânico',      color: '#22c55e', domain: 'google.com' },
  walk_in:      { label: 'Presencial',    color: '#f97316', Icon: Building2 },
  phone_call:   { label: 'Chamada',       color: '#06b6d4', Icon: Phone },
  social_media: { label: 'Redes Sociais', color: '#ec4899', domain: 'instagram.com' },
  manual:       { label: 'Manual',        color: '#64748b', Icon: Pencil },
  voice:        { label: 'Voz',           color: '#a855f7', Icon: Mic },
  portal:       { label: 'Portal',        color: '#0ea5e9', Icon: Globe },
  other:        { label: 'Outro',         color: '#64748b', Icon: Globe },
}

// Keyed by the portal slug with non-letters stripped (so "casa_sapo",
// "Casa Sapo" and "casasapo" all match).
const PORTAL_BRAND: Record<string, SourceBrand> = {
  idealista:   { label: 'Idealista',  color: '#A2B400', domain: 'idealista.pt' },
  imovirtual:  { label: 'Imovirtual', color: '#00B0A6', domain: 'imovirtual.com' },
  casasapo:    { label: 'Casa Sapo',  color: '#E2001A', domain: 'casa.sapo.pt' },
  sapo:        { label: 'Casa Sapo',  color: '#E2001A', domain: 'casa.sapo.pt' },
  custojusto:  { label: 'CustoJusto', color: '#ff6600', domain: 'custojusto.pt' },
  olx:         { label: 'OLX',        color: '#002F34', domain: 'olx.pt' },
  supercasa:   { label: 'SuperCasa',  color: '#0d6efd', domain: 'supercasa.pt' },
  bpiexpressoimobiliario: { label: 'BPI Expresso', color: '#0d6efd', domain: 'bpiexpressoimobiliario.pt' },
}

function normalizePortal(p?: string | null): string {
  return (p || '').toLowerCase().replace(/[^a-z]/g, '')
}

export function resolveSourceBrand(source: string, portal?: string | null): SourceBrand {
  if (source === 'portal') {
    const key = normalizePortal(portal)
    return PORTAL_BRAND[key] ?? SOURCE_BRAND.portal
  }
  return (
    SOURCE_BRAND[source] ?? {
      label: ENTRY_SOURCE_LABELS[source as keyof typeof ENTRY_SOURCE_LABELS] ?? source,
      color: '#64748b',
      Icon: Globe,
    }
  )
}

export function SourceBadge({
  source,
  portal,
  size = 'sm',
  className,
}: {
  source: string
  portal?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  const cfg = resolveSourceBrand(source, portal)
  const Icon = cfg.Icon
  const box = size === 'md' ? 'h-7 w-7' : 'h-6 w-6'
  const img = size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4'
  const glyph = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const tag = size === 'md' ? 'text-[11px]' : 'text-[10px]'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span
        className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md', box)}
        style={{ backgroundColor: `${cfg.color}1f` }}
      >
        {cfg.domain ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://www.google.com/s2/favicons?domain=${cfg.domain}&sz=64`}
            alt=""
            className={img}
            loading="lazy"
          />
        ) : Icon ? (
          <Icon className={glyph} style={{ color: cfg.color }} />
        ) : null}
      </span>
      <span
        className={cn('truncate rounded-full px-2 py-0.5 font-semibold', tag)}
        style={{ backgroundColor: `${cfg.color}1f`, color: cfg.color }}
      >
        {cfg.label}
      </span>
    </span>
  )
}
