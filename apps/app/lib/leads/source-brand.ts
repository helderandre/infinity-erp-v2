/**
 * Brand metadata for lead sources and portals — used by the breakdown lists
 * on /dashboard/crm/analise so each row carries the right logo + tint.
 *
 * Favicons are pulled from Google's S2 service (`s2/favicons?domain=…&sz=64`)
 * for portals — reliable, transparent PNGs, no CORS. Internal sources (Manual,
 * Voz, Walk-in…) use no logo and fall back to a tinted colour dot.
 */

export interface BrandMeta {
  label: string
  color: string
  /** Optional favicon URL (used by portals). Sources without a domain leave this null. */
  logoUrl: string | null
}

const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

/** `leads_entries.source` enum values. Colours pulled from each brand's
 *  primary mark so the breakdown bars match the favicons shown beside them.
 */
export const SOURCE_BRAND: Record<string, BrandMeta> = {
  meta_ads:     { label: 'Meta Ads',      color: '#1877F2', logoUrl: fav('facebook.com') },
  google_ads:   { label: 'Google Ads',    color: '#4285F4', logoUrl: fav('google.com') },
  website:      { label: 'Website',       color: '#0EA5E9', logoUrl: fav('infinitygroup.pt') },
  landing_page: { label: 'Landing Page',  color: '#8B5CF6', logoUrl: null },
  partner:      { label: 'Parceiro',      color: '#F59E0B', logoUrl: null },
  organic:      { label: 'Orgânico',      color: '#10B981', logoUrl: null },
  walk_in:      { label: 'Walk-in',       color: '#22C55E', logoUrl: null },
  phone_call:   { label: 'Chamada',       color: '#06B6D4', logoUrl: null },
  social_media: { label: 'Redes Sociais', color: '#E4405F', logoUrl: fav('instagram.com') },
  manual:       { label: 'Manual',        color: '#64748B', logoUrl: null },
  voice:        { label: 'Voz',           color: '#A855F7', logoUrl: null },
  portal:       { label: 'Portal',        color: '#EAB308', logoUrl: null },
  other:        { label: 'Outro',         color: '#94A3B8', logoUrl: null },
  unknown:      { label: 'Desconhecido',  color: '#94A3B8', logoUrl: null },
}

/** `form_data.portal` slugs. Colours derived from each portal's brand sheet
 *  (Idealista's orange-red, Imovirtual's bright orange, etc.) so the bar fill
 *  matches the favicon rendered beside it.
 */
export const PORTAL_BRAND: Record<string, BrandMeta> = {
  idealista:    { label: 'Idealista',    color: '#E94F1D', logoUrl: fav('idealista.pt') },   // orange-red, OLX/Idealista CTA
  imovirtual:   { label: 'Imovirtual',   color: '#F36F21', logoUrl: fav('imovirtual.com') }, // orange
  casa_sapo:    { label: 'Casa Sapo',    color: '#2D8B3E', logoUrl: fav('casa.sapo.pt') },   // SAPO green
  remax:        { label: 'Remax',        color: '#DC1C2E', logoUrl: fav('remax.pt') },        // Remax red
  era:          { label: 'ERA',          color: '#003DA5', logoUrl: fav('era.pt') },          // ERA navy
  century21:    { label: 'Century 21',   color: '#BEAF87', logoUrl: fav('century21.pt') },    // C21 gold
  habitamais:   { label: 'Habitamais',   color: '#1E3A8A', logoUrl: fav('habitamais.pt') },
  supercasa:    { label: 'Supercasa',    color: '#0066CC', logoUrl: fav('supercasa.pt') },
  predial_net:  { label: 'Predial.net',  color: '#7C3AED', logoUrl: fav('predial.net') },
}

/** Normalise key — API values can arrive in mixed casing or with the dotted
 *  slug ("Casa Sapo" → "casa_sapo", "Idealista" → "idealista"). */
function normaliseKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\./g, '_')
}

export function getSourceBrand(key: string): BrandMeta {
  const k = normaliseKey(key)
  return SOURCE_BRAND[k] ?? { label: key, color: '#94A3B8', logoUrl: null }
}

export function getPortalBrand(key: string): BrandMeta {
  const k = normaliseKey(key)
  return PORTAL_BRAND[k] ?? { label: key, color: '#94A3B8', logoUrl: null }
}
