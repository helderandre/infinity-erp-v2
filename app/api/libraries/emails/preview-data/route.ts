import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface TplVariable {
  key: string
  source_entity: string
  source_table: string | null
  source_column: string | null
  format_type: string
  format_config: Record<string, unknown> | null
  static_value: string | null
}

/**
 * POST /api/libraries/emails/preview-data
 *
 * Dynamically resolves template variables by reading their mapping from
 * the tpl_variables table and fetching the corresponding entity data.
 *
 * Body: { property_id?: string, owner_id?: string, consultant_id?: string, process_id?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { property_id, owner_id, consultant_id, process_id } = body as {
      property_id?: string
      owner_id?: string
      consultant_id?: string
      process_id?: string
    }

    // 1. Fetch all active variable definitions
    const { data: varDefs, error: varError } = await supabase
      .from('tpl_variables')
      .select('key, source_entity, source_table, source_column, format_type, format_config, static_value')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (varError || !varDefs) {
      return NextResponse.json({ error: 'Erro ao carregar variáveis' }, { status: 500 })
    }

    // Map entity type → selected ID
    const entityIdMap: Record<string, string | undefined> = {
      property: property_id,
      owner: owner_id,
      consultant: consultant_id,
      process: process_id,
    }

    // Map entity type → ID column used in WHERE clause
    const entityIdColumn: Record<string, string> = {
      property: 'id',
      owner: 'id',
      consultant: 'id',
      process: 'id',
    }

    // For tables where the FK column is different from 'id'
    const tableIdOverrides: Record<string, string> = {
      dev_consultant_profiles: 'user_id',
    }

    // 2. Group variables by (source_table + entity) to batch queries
    const tableGroups = new Map<string, { columns: Set<string>; vars: TplVariable[] }>()

    for (const v of varDefs as TplVariable[]) {
      if (v.source_entity === 'system' || !v.source_table) continue

      const entityId = entityIdMap[v.source_entity]
      if (!entityId) continue // entity not selected — skip

      const groupKey = `${v.source_entity}::${v.source_table}`

      if (!tableGroups.has(groupKey)) {
        tableGroups.set(groupKey, { columns: new Set(), vars: [] })
      }
      const group = tableGroups.get(groupKey)!

      // Collect columns needed
      if (v.format_type === 'concat' && v.format_config) {
        const cols = (v.format_config as { columns?: string[] }).columns || []
        cols.forEach((c) => group.columns.add(c))
      } else if (v.source_column) {
        group.columns.add(v.source_column)
      }

      group.vars.push(v)
    }

    // 3. Execute batched queries
    const entityData = new Map<string, Record<string, unknown>>()

    for (const [groupKey, group] of tableGroups) {
      const [entityType, tableName] = groupKey.split('::')
      const entityId = entityIdMap[entityType]
      if (!entityId || group.columns.size === 0) continue

      const idColumn = tableIdOverrides[tableName] || entityIdColumn[entityType] || 'id'
      const selectStr = Array.from(group.columns).join(', ')

      const { data } = await supabase
        .from(tableName)
        .select(selectStr)
        .eq(idColumn, entityId)
        .single()

      if (data) {
        entityData.set(groupKey, data as Record<string, unknown>)
      }
    }

    // 4. Resolve each variable
    const variables: Record<string, string> = {}

    for (const v of varDefs as TplVariable[]) {
      // System variables
      if (v.source_entity === 'system') {
        if (v.format_type === 'date') {
          variables[v.key] = new Date().toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        } else if (v.static_value) {
          variables[v.key] = v.static_value
        }
        continue
      }

      const entityId = entityIdMap[v.source_entity]
      if (!entityId || !v.source_table) continue

      const groupKey = `${v.source_entity}::${v.source_table}`
      const row = entityData.get(groupKey)
      if (!row) continue

      // Format the value based on format_type
      const resolved = formatValue(v, row)
      if (resolved !== null) {
        variables[v.key] = resolved
      }
    }

    return NextResponse.json({ variables })
  } catch (error) {
    console.error('Erro ao buscar dados de pré-visualização:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/** Formats a variable value based on its format_type and the fetched row data */
function formatValue(
  v: TplVariable,
  row: Record<string, unknown>
): string | null {
  switch (v.format_type) {
    case 'text': {
      if (!v.source_column) return null
      const val = row[v.source_column]
      return val != null ? String(val) : ''
    }

    case 'currency': {
      if (!v.source_column) return null
      const num = row[v.source_column]
      if (num == null) return ''
      const config = (v.format_config || {}) as { currency?: string; locale?: string }
      return new Intl.NumberFormat(config.locale || 'pt-PT', {
        style: 'currency',
        currency: config.currency || 'EUR',
        minimumFractionDigits: 0,
      }).format(Number(num))
    }

    case 'date': {
      if (!v.source_column) return null
      const dateVal = row[v.source_column]
      if (!dateVal) return ''
      const config = (v.format_config || {}) as { locale?: string }
      return new Date(String(dateVal)).toLocaleDateString(config.locale || 'pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }

    case 'concat': {
      const config = (v.format_config || {}) as { columns?: string[]; separator?: string }
      const columns = config.columns || []
      const separator = config.separator ?? ', '
      return columns
        .map((col) => row[col])
        .filter(Boolean)
        .join(separator) || ''
    }

    default:
      return null
  }
}
