/**
 * Renders a Craft.js editor state (serialized JSON) into static HTML,
 * replacing template variables like {{proprietario_nome}} with actual values.
 *
 * This renderer uses table-based layout for email client compatibility —
 * Gmail strips <style> blocks and ignores CSS flexbox/grid, and Outlook
 * uses the Word rendering engine which only supports tables. All layout
 * is rendered as <table> elements with inline styles.
 */

type CraftNode = {
  type: { resolvedName: string }
  isCanvas?: boolean
  props: Record<string, unknown>
  nodes: string[]
  linkedNodes: Record<string, string>
  parent: string | null
}

type EditorState = Record<string, CraftNode>
type VariablesMap = Record<string, string>

/** Replace all {{variable}} occurrences in a string with values from the map */
function replaceVariables(text: string, variables: VariablesMap): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const trimmed = key.trim()
    return variables[trimmed] ?? match
  })
}

/** Normalize spacing value: number → "Npx", string → passthrough */
function normalizeSpacing(val: string | number | undefined, fallback: string): string {
  if (val == null) return fallback
  if (typeof val === 'number') return val > 0 ? `${val}px` : '0px'
  return val || fallback
}

/** Build an inline style string from a partial style object */
function inlineStyle(style: Record<string, string | number | undefined>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== '' && v !== undefined)
    .map(([k, v]) => {
      const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${cssKey}: ${typeof v === 'number' ? `${v}px` : v}`
    })
    .join('; ')
}

/**
 * Parse "1fr 2fr" or "50% 200px" column size strings into percentage strings
 * suitable for table <td> width attributes.
 */
function parseColumnWidths(columnSizes: string, columns: number): string[] {
  if (!columnSizes.trim()) {
    const pct = `${(100 / columns).toFixed(2)}%`
    return Array(columns).fill(pct)
  }

  const parts = columnSizes.trim().split(/\s+/)
  const parsed = parts.map((p) => {
    if (p.endsWith('fr')) return { type: 'fr' as const, val: parseFloat(p) || 1 }
    if (p.endsWith('%')) return { type: 'pct' as const, val: parseFloat(p) || 0 }
    return { type: 'fr' as const, val: 1 }
  })

  const totalFr = parsed.filter((p) => p.type === 'fr').reduce((a, b) => a + b.val, 0) || 1
  const usedPct = parsed.filter((p) => p.type === 'pct').reduce((a, b) => a + b.val, 0)
  const remainPct = 100 - usedPct

  return parsed.map((p) =>
    p.type === 'pct'
      ? `${p.val}%`
      : `${((p.val / totalFr) * remainPct).toFixed(2)}%`
  )
}

/**
 * Convert HTML <ul>/<ol> lists to table-based layout for Outlook compatibility.
 * Outlook's Word engine doesn't render list-style-type or padding-left properly.
 */
function convertListsToTables(html: string, fontSize: number, lineHeightPx: string): string {
  // Convert <ul> lists
  html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner: string) => {
    const items = extractListItems(inner)
    return buildListTable(items, '&#8226;', fontSize, lineHeightPx)
  })

  // Convert <ol> lists
  html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    const items = extractListItems(inner)
    return buildListTable(items, 'ordered', fontSize, lineHeightPx)
  })

  return html
}

function extractListItems(inner: string): string[] {
  const items: string[] = []
  const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match
  while ((match = regex.exec(inner)) !== null) {
    items.push(match[1].trim())
  }
  return items
}

function buildListTable(items: string[], bulletType: string, fontSize: number, lineHeightPx: string): string {
  const rows = items
    .map((item, i) => {
      const bullet = bulletType === 'ordered' ? `${i + 1}.` : bulletType
      return (
        `<tr>` +
        `<td width="20" valign="top" style="font-size: ${fontSize}px; line-height: ${lineHeightPx}; mso-line-height-rule: exactly; padding-right: 6px;">${bullet}</td>` +
        `<td style="font-size: ${fontSize}px; line-height: ${lineHeightPx}; mso-line-height-rule: exactly; padding-bottom: 4px;">${item}</td>` +
        `</tr>`
      )
    })
    .join('')

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0.5em 0;">` +
    `<tbody>${rows}</tbody></table>`
  )
}

// ─── Node renderers ───────────────────────────────────────────────────────────

/**
 * EmailContainer — email-safe table layout.
 *
 * direction="column" → stacked <table> rows with gap via padding-bottom.
 * direction="row"    → <table> with <td> columns.
 */
function renderContainer(props: Record<string, unknown>, children: string[]): string {
  const direction = (props.direction as string) || 'column'
  const gap = (props.gap as number) ?? 8
  const padding = normalizeSpacing(props.padding as string | number | undefined, '24px')
  const margin = normalizeSpacing(props.margin as string | number | undefined, '0px')
  const width = (props.width as string) || '100%'
  const background = (props.background as string) || '#ffffff'
  const borderWidth = (props.borderWidth as number) ?? 0
  const borderColor = (props.borderColor as string) || 'transparent'
  const border = (props.border as string)
  const borderRadius = (props.borderRadius as string) || '0px'
  const boxShadow = (props.boxShadow as string) || 'none'
  const minHeight = props.minHeight

  const borderStyle =
    border && border !== 'none'
      ? border
      : borderWidth > 0
        ? `${borderWidth}px solid ${borderColor}`
        : undefined

  const minHeightPx =
    minHeight === 'auto' || minHeight == null
      ? undefined
      : typeof minHeight === 'number'
        ? `${minHeight}px`
        : `${parseInt(String(minHeight)) || 0}px`

  // Build outer table style
  const outerStyle: Record<string, string | number | undefined> = {
    'background-color': background,
    'border-radius': borderRadius !== '0px' ? borderRadius : undefined,
    width,
  }
  if (borderStyle) outerStyle.border = borderStyle
  if (boxShadow !== 'none') outerStyle['box-shadow'] = boxShadow
  if (margin !== '0px') outerStyle.margin = margin

  const outerStyleStr = inlineStyle(outerStyle)

  if (direction === 'row') {
    const align = (props.align as string) || 'stretch'
    const vAlign = align === 'center' ? 'middle' : align === 'flex-end' ? 'bottom' : 'top'
    const cols = children.length || 1
    const colWidthPct = `${(100 / cols).toFixed(2)}%`

    const tds = children
      .map((child, i) => {
        const isLast = i === children.length - 1
        const tdStyle: Record<string, string | number | undefined> = {
          width: colWidthPct,
          'vertical-align': vAlign,
        }
        if (!isLast && gap > 0) tdStyle['padding-right'] = `${gap}px`
        return `<td width="${colWidthPct}" style="${inlineStyle(tdStyle)}">${child}</td>`
      })
      .join('')

    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${outerStyleStr}">` +
      `<tbody><tr><td style="padding: ${padding};">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tbody><tr>${tds}</tr></tbody></table>` +
      `</td></tr></tbody></table>`
    )
  }

  // Column direction: stack children vertically with gap as padding-bottom
  const innerRows = children
    .map((child, i) => {
      const isLast = i === children.length - 1
      const tdStyle = !isLast && gap > 0 ? `padding-bottom: ${gap}px;` : ''
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
        `<tbody><tr><td style="${tdStyle}">${child}</td></tr></tbody></table>`
      )
    })
    .join('')

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${outerStyleStr}">` +
    `<tbody><tr><td style="padding: ${padding};">` +
    `${minHeightPx ? `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="min-height: ${minHeightPx}"><tr><td><![endif]-->` : ''}` +
    innerRows +
    `${minHeightPx ? `<!--[if mso]></td></tr></table><![endif]-->` : ''}` +
    `</td></tr></tbody></table>`
  )
}

/**
 * EmailGrid — multi-column grid rendered as an HTML <table>.
 */
function renderGrid(props: Record<string, unknown>, cells: string[]): string {
  const columns = (props.columns as number) ?? 2
  const rows = (props.rows as number) ?? 1
  const gap = (props.gap as number) ?? 16
  const columnSizes = (props.columnSizes as string) || ''
  const padding = props.padding
  const background = (props.background as string) || 'transparent'
  const borderRadius = (props.borderRadius as string) || '0px'
  const borderColor = (props.borderColor as string) || 'transparent'
  const borderWidth = (props.borderWidth as number) ?? 0
  const boxShadow = (props.boxShadow as string) || 'none'

  const paddingStr =
    typeof padding === 'number'
      ? padding > 0
        ? `${padding}px`
        : undefined
      : padding && padding !== '0px'
        ? String(padding)
        : undefined

  const colWidths = parseColumnWidths(columnSizes, columns)

  const tableStyle: Record<string, string | number | undefined> = {
    width: '100%',
  }
  if (paddingStr) tableStyle.padding = paddingStr
  if (background !== 'transparent') tableStyle['background-color'] = background
  if (borderRadius !== '0px') tableStyle['border-radius'] = borderRadius
  if (borderWidth > 0) tableStyle.border = `${borderWidth}px solid ${borderColor}`
  if (boxShadow !== 'none') tableStyle['box-shadow'] = boxShadow

  const tableStyleStr = inlineStyle(tableStyle)

  let html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${tableStyleStr}"><tbody>`

  for (let r = 0; r < rows; r++) {
    if (r > 0 && gap > 0) {
      html += `<tr><td colspan="${columns}" style="height: ${gap}px; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr>`
    }
    html += '<tr>'
    for (let c = 0; c < columns; c++) {
      const cellIndex = r * columns + c
      const cell = cells[cellIndex] || ''
      const isLast = c === columns - 1
      const tdStyle: Record<string, string | number | undefined> = {
        width: colWidths[c],
        'vertical-align': 'top',
      }
      if (!isLast && gap > 0) tdStyle['padding-right'] = `${gap}px`
      html += `<td width="${colWidths[c]}" style="${inlineStyle(tdStyle)}">${cell}</td>`
    }
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

function renderText(props: Record<string, unknown>, variables: VariablesMap): string {
  let html = replaceVariables(stripVariableSpans((props.html as string) || ''), variables)
  const fontSize = (props.fontSize as number) || 16
  const color = (props.color as string) || '#000000'
  const textAlign = (props.textAlign as string) || 'left'
  const lineHeight = (props.lineHeight as number) || 1.5
  const fontFamily = (props.fontFamily as string) || 'Arial, sans-serif'

  const lineHeightPx = `${Math.round(fontSize * lineHeight)}px`

  // Convert lists to tables for Outlook
  html = convertListsToTables(html, fontSize, lineHeightPx)

  return `<p style="${inlineStyle({
    'font-size': `${fontSize}px`,
    color,
    'text-align': textAlign,
    'line-height': lineHeightPx,
    'mso-line-height-rule': 'exactly',
    'font-family': fontFamily,
    margin: '0',
  })}">${html}</p>`
}

function renderHeading(props: Record<string, unknown>, variables: VariablesMap): string {
  const html = replaceVariables(stripVariableSpans((props.html as string) || ''), variables)
  const level = (props.level as string) || 'h2'
  const fontSize = (props.fontSize as number) || 24
  const fontWeight = (props.fontWeight as string) || '700'
  const color = (props.color as string) || '#000000'
  const textAlign = (props.textAlign as string) || 'left'
  const fontFamily = (props.fontFamily as string) || 'Arial, sans-serif'
  const padding = (props.padding as number) || 0

  const lineHeightPx = `${Math.round(fontSize * 1.3)}px`

  const style: Record<string, string | number | undefined> = {
    'font-size': `${fontSize}px`,
    'font-weight': fontWeight,
    color,
    'text-align': textAlign,
    'font-family': fontFamily,
    margin: '0',
    'line-height': lineHeightPx,
    'mso-line-height-rule': 'exactly',
  }
  if (padding > 0) style.padding = `${padding}px`

  return `<${level} style="${inlineStyle(style)}">${html}</${level}>`
}

function renderImage(props: Record<string, unknown>): string {
  const src = (props.src as string) || ''
  const alt = (props.alt as string) || ''
  const width = (props.width as number) ?? 100
  const height = (props.height as number) ?? 0
  const align = (props.align as string) || 'center'
  const href = (props.href as string) || ''
  const borderRadius = (props.borderRadius as string) || '0px'
  const boxShadow = (props.boxShadow as string) || 'none'

  if (!src) {
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tbody><tr><td align="${align}" style="padding: 0;">` +
      `<div style="padding: 32px; border: 1px dashed #e5e7eb; border-radius: 8px; color: #9ca3af; text-align: center;">[Imagem]</div>` +
      `</td></tr></tbody></table>`
    )
  }

  // Calculate pixel width from percentage (600px email width)
  const widthPx = Math.round(600 * (width / 100))

  const imgStyle: Record<string, string | number | undefined> = {
    display: 'block',
    'max-width': '100%',
    height: height > 0 ? `${height}px` : 'auto',
    border: '0',
  }
  if (borderRadius !== '0px') imgStyle['border-radius'] = borderRadius
  if (height > 0) imgStyle['object-fit'] = 'cover'
  if (boxShadow !== 'none') imgStyle['box-shadow'] = boxShadow

  const img = `<img src="${src}" alt="${alt}" width="${widthPx}" style="${inlineStyle(imgStyle)}" />`
  const content = href ? `<a href="${href}" target="_blank">${img}</a>` : img

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tbody><tr><td align="${align}" style="padding: 0;">` +
    content +
    `</td></tr></tbody></table>`
  )
}

function renderButton(props: Record<string, unknown>, variables: VariablesMap): string {
  const text = replaceVariables((props.text as string) || 'Clique aqui', variables)
  const href = (props.href as string) || '#'
  const backgroundColor = (props.backgroundColor as string) || '#576c98'
  const color = (props.color as string) || '#fafafa'
  const borderRadius = (props.borderRadius as string) || '65px'
  const fontSize = (props.fontSize as number) || 16
  const paddingX = (props.paddingX as number) ?? 24
  const paddingY = (props.paddingY as number) ?? 12
  const align = (props.align as string) || 'center'
  const fullWidth = (props.fullWidth as boolean) || false
  const boxShadow = (props.boxShadow as string) || 'none'

  // Calculate VML dimensions for Outlook
  const btnHeight = fontSize + (paddingY * 2) + 4
  const borderRadiusPx = parseInt(borderRadius) || 0
  const arcsize = btnHeight > 0 ? Math.round((borderRadiusPx / btnHeight) * 100) : 0

  const btnStyle: Record<string, string | number | undefined> = {
    'background-color': backgroundColor,
    color,
    'border-radius': borderRadius,
    'font-size': `${fontSize}px`,
    padding: `${paddingY}px ${paddingX}px`,
    display: fullWidth ? 'block' : 'inline-block',
    width: fullWidth ? '100%' : 'auto',
    'text-decoration': 'none',
    'font-family': 'Arial, sans-serif',
    'text-align': 'center',
    'box-sizing': 'border-box',
    'font-weight': 'bold',
  }
  if (boxShadow !== 'none') btnStyle['box-shadow'] = boxShadow

  // VML roundrect for Outlook (bulletproof button)
  const vmlWidth = fullWidth ? 600 : paddingX * 2 + fontSize * text.length * 0.6
  const vml = (
    `<!--[if mso]>` +
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" ` +
    `href="${href}" ` +
    `style="height:${btnHeight}px; v-text-anchor:middle;${fullWidth ? ' width:100%;' : ` width:${Math.round(vmlWidth)}px;`}" ` +
    `arcsize="${arcsize}%" ` +
    `strokecolor="${backgroundColor}" ` +
    `fillcolor="${backgroundColor}">` +
    `<w:anchorlock/>` +
    `<center style="color:${color}; font-family:Arial,sans-serif; font-size:${fontSize}px; font-weight:bold;">` +
    text +
    `</center>` +
    `</v:roundrect>` +
    `<![endif]-->`
  )

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tbody><tr><td align="${align}" style="padding: 0;">` +
    vml +
    `<!--[if !mso]><!-->` +
    `<a href="${href}" target="_blank" style="${inlineStyle(btnStyle)}">${text}</a>` +
    `<!--<![endif]-->` +
    `</td></tr></tbody></table>`
  )
}

function renderDivider(props: Record<string, unknown>): string {
  const color = (props.color as string) || '#e5e7eb'
  const thickness = (props.thickness as number) ?? 1
  const marginY = (props.marginY as number) ?? 16
  const lineStyle = (props.style as string) || 'solid'

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tbody><tr><td style="padding: ${marginY}px 0;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tbody><tr><td style="border-top: ${thickness}px ${lineStyle} ${color}; font-size: 0; line-height: 0; height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr></tbody>` +
    `</table>` +
    `</td></tr></tbody></table>`
  )
}

function renderSpacer(props: Record<string, unknown>): string {
  const height = (props.height as number) ?? 20
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tbody><tr><td style="height: ${height}px; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr></tbody>` +
    `</table>`
  )
}

/**
 * EmailAttachment — rendered as an email-safe table card with a download link.
 */
function renderAttachment(props: Record<string, unknown>, variables: VariablesMap): string {
  const label = replaceVariables((props.label as string) || 'Documento anexo', variables)
  const description = replaceVariables((props.description as string) || '', variables)
  const required = (props.required as boolean) ?? true
  const fileUrl = (props.fileUrl as string) || ''
  const fileName = (props.fileName as string) || ''
  const fileSize = (props.fileSize as number) || 0

  const badgeColor = required ? '#3b82f6' : '#6b7280'
  const badgeLabel = required ? 'Obrigatório' : 'Opcional'

  let fileInfoHtml = ''
  if (fileUrl && fileName) {
    const sizeStr =
      fileSize > 0
        ? fileSize < 1024
          ? `${fileSize} B`
          : fileSize < 1024 * 1024
            ? `${(fileSize / 1024).toFixed(1)} KB`
            : `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
        : ''
    fileInfoHtml =
      `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${fileName}${sizeStr ? ` (${sizeStr})` : ''}</div>` +
      `<div style="margin-top: 6px;"><a href="${fileUrl}" style="font-size: 12px; color: #3b82f6; text-decoration: underline;">Descarregar ficheiro</a></div>`
  } else if (description) {
    fileInfoHtml = `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${description}</div>`
  } else {
    fileInfoHtml = `<div style="font-size: 12px; color: #6b7280; font-style: italic; margin-top: 4px;">Nenhum ficheiro carregado</div>`
  }

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 8px;">` +
    `<tbody><tr>` +
    `<td style="width: 56px; padding: 16px 8px 16px 16px; vertical-align: top;">` +
    `<div style="width: 40px; height: 40px; background-color: rgba(59,130,246,0.1); border-radius: 6px; text-align: center; line-height: 40px; font-size: 18px;">&#128206;</div>` +
    `</td>` +
    `<td style="padding: 16px 16px 16px 0; vertical-align: top;">` +
    `<div style="margin-bottom: 4px;">` +
    `<span style="font-weight: 500; font-size: 14px; font-family: Arial, sans-serif;">${label}</span>` +
    `<span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background-color: ${badgeColor}; color: white; margin-left: 8px; display: inline-block;">${badgeLabel}</span>` +
    `</div>` +
    fileInfoHtml +
    `</td>` +
    `</tr></tbody></table>`
  )
}

/** Strip the highlighting <span> wrappers from variables, keeping just the raw {{var}} text */
function stripVariableSpans(html: string): string {
  // Strip data-variable-key spans (Tiptap)
  html = html.replace(/<span[^>]*data-variable-key="([^"]*)"[^>]*>.*?<\/span>/g, '{{$1}}')
  // Strip email-variable class spans (legacy contentEditable)
  html = html.replace(/<span class="email-variable"[^>]*>(.*?)<\/span>/g, '$1')
  return html
}

/** Render a single node and its children recursively */
function renderNode(nodeId: string, state: EditorState, variables: VariablesMap): string {
  const node = state[nodeId]
  if (!node) return ''

  const { type, props, nodes, linkedNodes } = node
  const typeName = type.resolvedName

  switch (typeName) {
    case 'EmailContainer': {
      const directChildren = nodes.map((id) => renderNode(id, state, variables))
      const linkedChildren = Object.values(linkedNodes || {}).map((id) =>
        renderNode(id, state, variables)
      )
      return renderContainer(props, [...directChildren, ...linkedChildren])
    }

    case 'EmailGrid': {
      const directCells = nodes.map((id) => renderNode(id, state, variables))
      const linkedCells = Object.values(linkedNodes || {}).map((id) =>
        renderNode(id, state, variables)
      )
      return renderGrid(props, [...directCells, ...linkedCells])
    }

    default: {
      const childrenHtml = nodes.map((id) => renderNode(id, state, variables)).join('')
      const linkedHtml = Object.values(linkedNodes || {})
        .map((id) => renderNode(id, state, variables))
        .join('')
      const allChildren = childrenHtml + linkedHtml

      switch (typeName) {
        case 'EmailText':
          return renderText(props, variables)
        case 'EmailHeading':
          return renderHeading(props, variables)
        case 'EmailImage':
          return renderImage(props)
        case 'EmailButton':
          return renderButton(props, variables)
        case 'EmailDivider':
          return renderDivider(props)
        case 'EmailSpacer':
          return renderSpacer(props)
        case 'EmailAttachment':
          return renderAttachment(props, variables)
        default:
          return allChildren
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a Craft.js editor state to an HTML body fragment with variable replacement.
 * Returns only the body content (no <html>/<body> wrapper) — suitable for preview.
 */
export function renderEmailToHtml(
  editorState: string | Record<string, unknown>,
  variables: VariablesMap = {}
): string {
  let state: EditorState

  if (typeof editorState === 'string') {
    try {
      state = JSON.parse(editorState)
    } catch {
      return '<p style="color: red;">Erro ao processar template</p>'
    }
  } else {
    state = editorState as unknown as EditorState
  }

  const rootId = 'ROOT' in state ? 'ROOT' : Object.keys(state)[0]
  if (!rootId || !state[rootId]) {
    return '<p style="color: red;">Template vazio</p>'
  }

  return renderNode(rootId, state, variables)
}

/**
 * Wrap a rendered email body in a full HTML email boilerplate.
 * Ensures correct rendering across all email clients including Gmail and Outlook.
 */
export function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title></title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td, th { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4;">
    <tbody>
      <tr>
        <td align="center" style="padding: 20px 10px;">
          <!--[if mso]>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td>
          <![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 600px; width: 100%;">
            <tbody>
              <tr>
                <td style="background-color: #ffffff;">${body}</td>
              </tr>
            </tbody>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`
}

/**
 * Extract all EmailAttachment nodes that have a file uploaded.
 * Returns an array ready to be passed to the Resend API as `attachments`.
 */
export function extractAttachmentsFromState(
  editorState: string | Record<string, unknown>
): Array<{ filename: string; path: string }> {
  let state: EditorState
  try {
    state =
      typeof editorState === 'string'
        ? JSON.parse(editorState)
        : (editorState as unknown as EditorState)
  } catch {
    return []
  }

  const attachments: Array<{ filename: string; path: string }> = []

  for (const node of Object.values(state)) {
    if (node.type?.resolvedName === 'EmailAttachment') {
      const fileUrl = node.props.fileUrl as string
      const fileName = node.props.fileName as string
      if (fileUrl && fileName) {
        attachments.push({ filename: fileName, path: fileUrl })
      }
    }
  }

  return attachments
}

/**
 * Extract all variable names used in an editor state.
 * Returns an array of variable keys (without braces), e.g. ['proprietario_nome', 'imovel_ref']
 */
export function extractVariablesFromState(
  editorState: string | Record<string, unknown>
): string[] {
  const json = typeof editorState === 'string' ? editorState : JSON.stringify(editorState)
  const matches = json.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []

  const unique = new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))
  return Array.from(unique)
}
