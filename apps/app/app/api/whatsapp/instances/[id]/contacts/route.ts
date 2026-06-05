import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertInstanceOwner } from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search") || ""
    const linked = searchParams.get("linked") // "owner" | "lead" | "none" | null
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    let query = supabase
      .from("wpp_contacts")
      .select(
        `*, owner:owners(id, name, phone, email), lead:leads(id, nome, email, telemovel)`,
        { count: "exact" }
      )
      .eq("instance_id", instanceId)
      .eq("is_group", false)

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    if (linked === "owner") {
      query = query.not("owner_id", "is", null)
    } else if (linked === "lead") {
      query = query.not("lead_id", "is", null)
    } else if (linked === "none") {
      query = query.is("owner_id", null).is("lead_id", null)
    }

    query = query
      .order("name", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ contacts: data ?? [], total: count ?? 0 })
  } catch (error) {
    console.error("[whatsapp/instances/contacts] GET erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-chats-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "sync_contacts",
        instance_id: instanceId,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao sincronizar contactos" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/instances/contacts] POST erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
