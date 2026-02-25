/**
 * Renders a Craft.js editor state (serialized JSON) into static HTML,
 * replacing template variables like {{proprietario_nome}} with actual values.
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

/** Convert a style object to an inline CSS string */
function styleToString(style: Record<string, string | number | undefined>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== '' && v !== undefined)
    .map(([k, v]) => {
      const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${cssKey}: ${typeof v === 'number' ? `${v}px` : v}`
    })
    .join('; ')
}

/** Render a single node and its children recursively */
function renderNode(
  nodeId: string,
  state: EditorState,
  variables: VariablesMap
): string {
  const node = state[nodeId]
  if (!node) return ''

  const { type, props, nodes, linkedNodes } = node
  const typeName = type.resolvedName

  // Render children
  const childrenHtml = nodes.map((id) => renderNode(id, state, variables)).join('')

  // Also render linked nodes (used by canvas containers like Grid)
  const linkedHtml = Object.values(linkedNodes || {})
    .map((id) => renderNode(id, state, variables))
    .join('')

  const allChildren = childrenHtml + linkedHtml

  switch (typeName) {
    case 'EmailContainer':
      return renderContainer(props, allChildren)
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
    case 'EmailGrid':
      return renderGrid(props, allChildren)
    default:
      return allChildren
  }
}

function renderContainer(props: Record<string, unknown>, children: string): string {
  const direction = (props.direction as string) || 'column'
  const align = (props.align as string) || 'stretch'
  const justify = (props.justify as string) || 'flex-start'
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

  const style: Record<string, string | number | undefined> = {
    display: 'flex',
    'flex-direction': direction,
    'align-items': align,
    'justify-content': justify,
    gap: gap > 0 ? `${gap}px` : undefined,
    padding,
    margin: margin !== '0px' ? margin : undefined,
    width,
    background,
    border: borderStyle,
    'border-radius': borderRadius,
    'box-shadow': boxShadow !== 'none' ? boxShadow : undefined,
    'min-height':
      minHeight === 'auto' || minHeight == null
        ? undefined
        : typeof minHeight === 'number'
          ? `${minHeight}px`
          : `${parseInt(String(minHeight)) || 0}px`,
  }

  return `<div style="${styleToString(style)}">${children}</div>`
}

function renderText(props: Record<string, unknown>, variables: VariablesMap): string {
  const html = replaceVariables(stripVariableSpans((props.html as string) || ''), variables)
  const fontSize = (props.fontSize as number) || 16
  const color = (props.color as string) || '#000000'
  const textAlign = (props.textAlign as string) || 'left'
  const lineHeight = (props.lineHeight as number) || 1.5
  const fontFamily = (props.fontFamily as string) || 'Arial, sans-serif'

  const style: Record<string, string | number | undefined> = {
    'font-size': `${fontSize}px`,
    color,
    'text-align': textAlign,
    'line-height': String(lineHeight),
    'font-family': fontFamily,
    margin: '0',
  }

  return `<p style="${styleToString(style)}">${html}</p>`
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

  const style: Record<string, string | number | undefined> = {
    'font-size': `${fontSize}px`,
    'font-weight': fontWeight,
    color,
    'text-align': textAlign,
    'font-family': fontFamily,
    padding: padding > 0 ? `${padding}px` : undefined,
    margin: '0',
  }

  return `<${level} style="${styleToString(style)}">${html}</${level}>`
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
    return `<div style="text-align: ${align}"><div style="padding: 32px; border: 1px dashed #e5e7eb; border-radius: 8px; color: #9ca3af; text-align: center;">[Imagem]</div></div>`
  }

  const imgStyle: Record<string, string | number | undefined> = {
    width: `${width}%`,
    height: height > 0 ? `${height}px` : 'auto',
    'border-radius': borderRadius,
    display: 'block',
    'max-width': '100%',
    'object-fit': height > 0 ? 'cover' : undefined,
    'box-shadow': boxShadow !== 'none' ? boxShadow : undefined,
  }

  const img = `<img src="${src}" alt="${alt}" style="${styleToString(imgStyle)}" />`
  const content = href ? `<a href="${href}">${img}</a>` : img

  return `<div style="text-align: ${align}">${content}</div>`
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

  const style: Record<string, string | number | undefined> = {
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
    'box-shadow': boxShadow !== 'none' ? boxShadow : undefined,
  }

  return `<div style="text-align: ${align}"><a href="${href}" style="${styleToString(style)}">${text}</a></div>`
}

function renderDivider(props: Record<string, unknown>): string {
  const color = (props.color as string) || '#e5e7eb'
  const thickness = (props.thickness as number) ?? 1
  const marginY = (props.marginY as number) ?? 16
  const lineStyle = (props.style as string) || 'solid'

  return `<hr style="border-top: ${thickness}px ${lineStyle} ${color}; border-bottom: none; border-left: none; border-right: none; margin-top: ${marginY}px; margin-bottom: ${marginY}px;" />`
}

function renderSpacer(props: Record<string, unknown>): string {
  const height = (props.height as number) ?? 20
  return `<div style="height: ${height}px; min-height: ${height}px;"></div>`
}

function renderAttachment(props: Record<string, unknown>, variables: VariablesMap): string {
  const label = replaceVariables((props.label as string) || 'Documento anexo', variables)
  const description = replaceVariables((props.description as string) || '', variables)
  const required = (props.required as boolean) ?? true
  const fileUrl = (props.fileUrl as string) || ''
  const fileName = (props.fileName as string) || ''
  const fileSize = (props.fileSize as number) || 0

  const badgeColor = required ? '#3b82f6' : '#6b7280'
  const badgeLabel = required ? 'Obrigatório' : 'Opcional'

  let fileInfo = ''
  if (fileUrl && fileName) {
    const sizeStr = fileSize > 0
      ? fileSize < 1024
        ? `${fileSize} B`
        : fileSize < 1024 * 1024
          ? `${(fileSize / 1024).toFixed(1)} KB`
          : `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      : ''
    fileInfo = `<div style="font-size: 12px; color: #6b7280;">${fileName}${sizeStr ? ` (${sizeStr})` : ''}</div>`
  } else if (description) {
    fileInfo = `<div style="font-size: 12px; color: #6b7280;">${description}</div>`
  } else {
    fileInfo = `<div style="font-size: 12px; color: #6b7280; font-style: italic;">Nenhum ficheiro carregado</div>`
  }

  return `<div style="display: flex; align-items: flex-start; gap: 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 16px;">
    <div style="width: 40px; height: 40px; border-radius: 6px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px;">📎</div>
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 500; font-size: 14px;">${label}</span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: ${badgeColor}; color: white;">${badgeLabel}</span>
      </div>
      ${fileInfo}
    </div>
  </div>`
}

function renderGrid(props: Record<string, unknown>, children: string): string {
  const columns = (props.columns as number) ?? 2
  const rows = (props.rows as number) ?? 1
  const gap = (props.gap as number) ?? 16
  const columnSizes = (props.columnSizes as string) || ''
  const rowSizes = (props.rowSizes as string) || ''
  const padding = props.padding
  const background = (props.background as string) || 'transparent'
  const borderRadius = (props.borderRadius as string) || '0px'
  const borderColor = (props.borderColor as string) || 'transparent'
  const borderWidth = (props.borderWidth as number) ?? 0
  const boxShadow = (props.boxShadow as string) || 'none'
  const minHeight = (props.minHeight as number) ?? 60

  const gridTemplateColumns = columnSizes.trim() || `repeat(${columns}, 1fr)`
  const gridTemplateRows = rowSizes.trim() || (rows > 1 ? `repeat(${rows}, auto)` : 'auto')

  const paddingStr =
    typeof padding === 'number'
      ? padding > 0
        ? `${padding}px`
        : undefined
      : padding && padding !== '0px'
        ? String(padding)
        : undefined

  const style: Record<string, string | number | undefined> = {
    display: 'grid',
    'grid-template-columns': gridTemplateColumns,
    'grid-template-rows': gridTemplateRows,
    gap: `${gap}px`,
    padding: paddingStr,
    background: background !== 'transparent' ? background : undefined,
    'border-radius': borderRadius,
    'border-color': borderColor,
    'border-width': borderWidth > 0 ? `${borderWidth}px` : undefined,
    'border-style': borderWidth > 0 ? 'solid' : undefined,
    'box-shadow': boxShadow !== 'none' ? boxShadow : undefined,
    'min-height': `${minHeight}px`,
  }

  return `<div style="${styleToString(style)}">${children}</div>`
}

/** Strip the highlighting <span> wrappers from variables, keeping just the raw {{var}} text */
function stripVariableSpans(html: string): string {
  return html.replace(
    /<span class="email-variable"[^>]*>(.*?)<\/span>/g,
    '$1'
  )
}

/**
 * Render a Craft.js editor state to HTML with variable replacement.
 *
 * @param editorState - The serialized Craft.js state (JSON object or string)
 * @param variables - A map of variable names (without braces) to replacement values
 * @returns The rendered HTML string
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

  // Find ROOT node
  const rootId = 'ROOT' in state ? 'ROOT' : Object.keys(state)[0]
  if (!rootId || !state[rootId]) {
    return '<p style="color: red;">Template vazio</p>'
  }

  return renderNode(rootId, state, variables)
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
