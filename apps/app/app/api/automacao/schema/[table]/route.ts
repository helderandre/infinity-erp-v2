import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { COLUMN_LABELS } from "@/lib/constants-automations"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("auto_get_table_columns", {
      p_table: table,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const columns = rows.map(
      (col: { column_name: string; data_type: string }) => ({
        name: col.column_name,
        label: COLUMN_LABELS[table]?.[col.column_name] || col.column_name,
        type: col.data_type,
      })
    )

    return NextResponse.json({ columns })
  } catch {
    return NextResponse.json(
      { error: "Erro ao carregar colunas" },
      { status: 500 }
    )
  }
}
