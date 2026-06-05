import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/automacao/variaveis
 * Retorna todas as variáveis de template da tabela tpl_variables,
 * agrupadas por categoria, com cores e valores de exemplo.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("tpl_variables")
      .select("id, key, label, category, source_table, source_column, static_value")
      .eq("is_active", true)
      .order("category")
      .order("order_index")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mapear cores por categoria
    const categoryColors: Record<string, string> = {
      consultor: "#f59e0b",    // amber
      imovel: "#22c55e",       // green
      proprietario: "#a855f7", // purple
      processo: "#3b82f6",     // blue
      sistema: "#6b7280",      // gray
      lead: "#0ea5e9",         // sky
      negocio: "#ec4899",      // pink
    }

    const variables = (data ?? []).map((v) => ({
      key: v.key,
      label: v.label,
      category: v.category,
      color: categoryColors[v.category] ?? "#6b7280",
      sourceTable: v.source_table,
      sourceColumn: v.source_column,
      sampleValue: v.static_value ?? "",
    }))

    return NextResponse.json(variables)
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao carregar variáveis" },
      { status: 500 }
    )
  }
}
