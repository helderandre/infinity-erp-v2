/**
 * Outlook-safe HTML renderer for a grid of property cards.
 *
 * Used by:
 *  - POST /api/negocios/[id]/properties/send  (programmatic send)
 *  - components/email-editor/user/email-property-grid.tsx  (Craft.js block serialiser)
 *
 * The output is a self-contained HTML fragment: only <table>/<tr>/<td>
 * elements with inline styles, plus a single <style> block with a
 * mobile media query that collapses to 1 column under 480px.
 */

export interface PropertyCardInput {
  title: string
  priceLabel: string
  location: string
  specs: string
  imageUrl?: string | null
  href: string
  reference?: string | null
}

export interface RenderPropertyGridOptions {
  ctaLabel?: string
  columns?: number
}

const DEFAULT_CTA = 'Ver imóvel'
const DEFAULT_COLUMNS = 3
const CARD_MAX_WIDTH = 190
const CELL_PADDING = 6

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

export function formatEurosPt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  const rounded = Math.round(Number(value))
  const withThousands = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')
  return `${withThousands}\u00A0€`
}

function renderCard(p: PropertyCardInput, ctaLabel: string): string {
  const image = p.imageUrl
    ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.title)}" width="100%" style="display:block;width:100%;max-width:${CARD_MAX_WIDTH}px;height:140px;object-fit:cover;border:0;outline:0;text-decoration:none;" />`
    : `<div style="display:block;width:100%;height:140px;background-color:#f1f5f9;color:#94a3b8;font-family:Arial,sans-serif;font-size:30px;line-height:140px;text-align:center;">&#127968;</div>`

  const ref = p.reference ? escapeHtml(p.reference) : ''
  const location = p.location ? escapeHtml(p.location) : ''
  const metaParts = [ref, location].filter(Boolean).join(' · ')

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${CARD_MAX_WIDTH}px;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;background:#ffffff;">
  <tr>
    <td style="padding:0;">
      <a href="${escapeAttr(p.href)}" style="display:block;text-decoration:none;color:inherit;" target="_blank" rel="noopener">
        <div style="position:relative;">
          ${image}
          <!--[if !mso]><!-->
          <div style="position:absolute;left:8px;bottom:8px;background:rgba(15,23,42,0.82);color:#ffffff;font-family:Arial,sans-serif;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;">${escapeHtml(p.priceLabel)}</div>
          <!--<![endif]-->
        </div>
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 12px 4px 12px;font-family:Arial,sans-serif;">
      <!--[if mso]><p style="margin:0 0 6px 0;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(p.priceLabel)}</p><![endif]-->
      <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#0f172a;line-height:1.3;">
        <a href="${escapeAttr(p.href)}" style="color:#0f172a;text-decoration:none;" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
      </p>
      ${metaParts ? `<p style="margin:0 0 4px 0;font-size:11px;color:#64748b;line-height:1.3;">${metaParts}</p>` : ''}
      ${p.specs ? `<p style="margin:0 0 8px 0;font-size:11px;color:#64748b;line-height:1.3;">${escapeHtml(p.specs)}</p>` : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:0 12px 12px 12px;font-family:Arial,sans-serif;">
      <a href="${escapeAttr(p.href)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:8px 14px;border-radius:6px;" target="_blank" rel="noopener">${escapeHtml(ctaLabel)}</a>
    </td>
  </tr>
</table>`.trim()
}

export function renderPropertyGrid(
  properties: PropertyCardInput[],
  options: RenderPropertyGridOptions = {}
): string {
  const ctaLabel = options.ctaLabel || DEFAULT_CTA
  const columns = Math.max(1, Math.min(DEFAULT_COLUMNS, options.columns || DEFAULT_COLUMNS))

  if (!properties.length) {
    return '<!-- no properties --><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>&nbsp;</td></tr></table>'
  }

  const cellWidthPct = Math.floor(100 / columns)
  const rows: string[] = []
  for (let i = 0; i < properties.length; i += columns) {
    const chunk = properties.slice(i, i + columns)
    const cells = chunk
      .map(
        (p) =>
          `<td class="property-card-cell" valign="top" width="${cellWidthPct}%" style="width:${cellWidthPct}%;padding:${CELL_PADDING}px;vertical-align:top;box-sizing:border-box;">${renderCard(p, ctaLabel)}</td>`
      )
      .join('')
    const fillers: string[] = []
    if (chunk.length < columns) {
      for (let j = 0; j < columns - chunk.length; j += 1) {
        fillers.push(
          `<td class="property-card-cell property-card-cell--empty" width="${cellWidthPct}%" style="width:${cellWidthPct}%;padding:${CELL_PADDING}px;font-size:0;line-height:0;">&nbsp;</td>`
        )
      }
    }
    rows.push(`<tr>${cells}${fillers.join('')}</tr>`)
  }

  const style = `
<style>
  @media only screen and (max-width: 480px) {
    td.property-card-cell { display: block !important; width: 100% !important; max-width: 100% !important; padding: 6px 0 !important; box-sizing: border-box !important; }
    td.property-card-cell--empty { display: none !important; }
  }
</style>`.trim()

  return `${style}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;">
${rows.join('\n')}
</table>`
}
