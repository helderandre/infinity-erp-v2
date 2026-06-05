// ============================================================
// template-engine.ts — Motor de renderização de variáveis
// Fase 2 do Sistema de Automações
//
// Suporta:
// - {{variável}}                    — substituição simples
// - {{variável|texto alternativo}}  — fallback quando variável vazia
// - {{#se variável}}...{{/se}}      — condicional simples
// - {{#se variável}}...{{senão}}...{{/se}} — condicional com else
//
// NOTA: Internamente usa {{var}} mas a UI nunca mostra esta sintaxe.
// A UI mostra pills visuais que são convertidas para {{var}} no save.
// ============================================================

/**
 * Renderiza um template substituindo variáveis pelos seus valores.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template

  // 1. Processar condicionais {{#se campo}}...{{senão}}...{{/se}}
  result = result.replace(
    /\{\{#se\s+(\w+)\}\}([\s\S]*?)(?:\{\{senão\}\}([\s\S]*?))?\{\{\/se\}\}/g,
    (_match, key: string, ifBlock: string, elseBlock?: string) => {
      const value = variables[key]
      const hasValue = value !== null && value !== undefined && value.trim() !== ""
      return hasValue ? ifBlock.trim() : (elseBlock?.trim() ?? "")
    }
  )

  // 2. Processar variáveis com fallback {{variável|fallback}}
  result = result.replace(
    /\{\{(\w+)\|([^}]+)\}\}/g,
    (_match, key: string, fallback: string) => {
      const value = variables[key]
      return value !== null && value !== undefined && value.trim() !== ""
        ? value
        : fallback.trim()
    }
  )

  // 3. Processar variáveis simples {{variável}}
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => variables[key] ?? ""
  )

  return result
}

/**
 * Extrai todas as variáveis únicas de um template.
 */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>()
  const patterns = [
    /\{\{(\w+)\}\}/g,
    /\{\{(\w+)\|[^}]+\}\}/g,
    /\{\{#se\s+(\w+)\}\}/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(template)) !== null) {
      vars.add(match[1])
    }
  }
  return Array.from(vars).sort()
}

/**
 * Extrai variáveis de todos os nodes de um fluxo.
 * Percorre mensagens WhatsApp, emails, condições, queries, etc.
 */
export function extractVariablesFromNodes(
  nodes: Array<{ data: Record<string, unknown> }>
): string[] {
  const allVars = new Set<string>()

  for (const node of nodes) {
    const d = node.data
    const type = d.type as string

    // WhatsApp — mensagens inline
    if (type === "whatsapp" && Array.isArray(d.messages)) {
      for (const msg of d.messages as Array<{ content?: string; caption?: string }>) {
        for (const v of extractVariables(msg.content || "")) allVars.add(v)
        for (const v of extractVariables(msg.caption || "")) allVars.add(v)
      }
    }

    // Email
    if (type === "email") {
      for (const v of extractVariables((d.subject as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.bodyHtml as string) || "")) allVars.add(v)
    }

    // Webhook Response
    if (type === "webhook_response") {
      for (const v of extractVariables((d.responseBody as string) || "")) allVars.add(v)
    }

    // HTTP Request
    if (type === "http_request") {
      for (const v of extractVariables((d.url as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.body as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.headers as string) || "")) allVars.add(v)
    }

    // Notification
    if (type === "notification") {
      for (const v of extractVariables((d.title as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.body as string) || "")) allVars.add(v)
    }

    // Set Variable — valores
    if (type === "set_variable" && Array.isArray(d.assignments)) {
      for (const a of d.assignments as Array<{ value?: string }>) {
        for (const v of extractVariables(a.value || "")) allVars.add(v)
      }
    }

    // Supabase Query — filtros e dados
    if (type === "supabase_query") {
      for (const f of (d.filters as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(f.value || "")) allVars.add(v)
      }
      for (const item of (d.data as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(item.value || "")) allVars.add(v)
      }
      for (const p of (d.rpcParams as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(p.value || "")) allVars.add(v)
      }
    }

    // Condition — campos
    if (type === "condition" && Array.isArray(d.rules)) {
      for (const r of d.rules as Array<{ field?: string; value?: string }>) {
        if (r.field) allVars.add(r.field)
      }
    }

    // Task Lookup
    if (type === "task_lookup") {
      const lv = d.lookupVariable as string
      if (lv) for (const v of extractVariables(lv)) allVars.add(v)
    }

    // Webhook Trigger — mappings produzem variáveis
    if (type === "trigger_webhook" && Array.isArray(d.webhookMappings)) {
      for (const m of d.webhookMappings as Array<{ variableKey?: string }>) {
        if (m.variableKey) allVars.add(m.variableKey)
      }
    }
  }

  return Array.from(allVars).sort()
}
