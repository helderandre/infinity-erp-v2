import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

function phoneVariants(phone: string): string[] {
  const normalized = phone.replace(/\D/g, "")
  return [
    phone,
    normalized,
    `+${normalized}`,
    normalized.startsWith("351") ? normalized.slice(3) : `351${normalized}`,
  ]
}

export async function POST(request: Request) {
  try {
    const { instance_id } = await request.json()

    if (!instance_id) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
    }

    const supabase = createAdminClient() as SupabaseAny

    // Contactos sem vinculacao
    const { data: contacts, error: contactsError } = await supabase
      .from("wpp_contacts")
      .select("id, phone")
      .eq("instance_id", instance_id)
      .is("owner_id", null)
      .is("lead_id", null)
      .not("phone", "is", null)

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 })
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ matched: 0, total: 0 })
    }

    // Buscar todos os owners e leads para matching local
    const { data: owners } = await supabase
      .from("owners")
      .select("id, phone")
      .not("phone", "is", null)

    // Leads usam colunas PT: telemovel, telefone
    const { data: leads } = await supabase
      .from("leads")
      .select("id, telemovel, telefone")
      .or("telemovel.not.is.null,telefone.not.is.null")

    let matched = 0

    for (const contact of contacts) {
      if (!contact.phone) continue

      const variants = phoneVariants(contact.phone)

      // Tentar match com owners
      let matchedOwnerId: string | null = null
      if (owners) {
        for (const owner of owners) {
          if (!owner.phone) continue
          const ownerVariants = phoneVariants(owner.phone)
          if (variants.some((v: string) => ownerVariants.includes(v))) {
            matchedOwnerId = owner.id
            break
          }
        }
      }

      if (matchedOwnerId) {
        await supabase
          .from("wpp_contacts")
          .update({ owner_id: matchedOwnerId, updated_at: new Date().toISOString() })
          .eq("id", contact.id)
        matched++
        continue
      }

      // Tentar match com leads (telemovel + telefone)
      let matchedLeadId: string | null = null
      if (leads) {
        for (const lead of leads) {
          const leadPhones = [lead.telemovel, lead.telefone].filter(Boolean) as string[]
          for (const leadPhone of leadPhones) {
            const leadVariants = phoneVariants(leadPhone)
            if (variants.some((v: string) => leadVariants.includes(v))) {
              matchedLeadId = lead.id
              break
            }
          }
          if (matchedLeadId) break
        }
      }

      if (matchedLeadId) {
        await supabase
          .from("wpp_contacts")
          .update({ lead_id: matchedLeadId, updated_at: new Date().toISOString() })
          .eq("id", contact.id)
        matched++
      }
    }

    return NextResponse.json({ matched, total: contacts.length })
  } catch (error) {
    console.error("[whatsapp/contacts/auto-match] POST erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
