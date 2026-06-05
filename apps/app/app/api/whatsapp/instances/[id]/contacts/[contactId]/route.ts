import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertInstanceOwner } from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id: instanceId, contactId } = await params

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const supabase = createAdminClient() as SupabaseAny

    const { data, error } = await supabase
      .from("wpp_contacts")
      .select(`*, owner:owners(id, name, phone, email), lead:leads(id, nome, email, telemovel)`)
      .eq("id", contactId)
      .eq("instance_id", instanceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Contacto não encontrado" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[whatsapp/contacts] GET erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id: instanceId, contactId } = await params

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { owner_id, lead_id } = body

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (owner_id !== undefined) updateData.owner_id = owner_id || null
    if (lead_id !== undefined) updateData.lead_id = lead_id || null

    const { data, error } = await supabase
      .from("wpp_contacts")
      .update(updateData)
      .eq("id", contactId)
      .eq("instance_id", instanceId)
      .select(`*, owner:owners(id, name, phone, email), lead:leads(id, nome, email, telemovel)`)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[whatsapp/contacts] PUT erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
