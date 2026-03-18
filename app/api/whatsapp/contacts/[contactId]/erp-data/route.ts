import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params
    const supabase = createAdminClient() as SupabaseAny

    // Buscar contacto para obter owner_id e lead_id
    const { data: contact, error: contactError } = await supabase
      .from("wpp_contacts")
      .select("id, owner_id, lead_id")
      .eq("id", contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contacto não encontrado" }, { status: 404 })
    }

    let ownerData = null
    let leadData = null

    // Dados do proprietario
    if (contact.owner_id) {
      const { data: owner } = await supabase
        .from("owners")
        .select("id, name, email, phone, nif, person_type")
        .eq("id", contact.owner_id)
        .single()

      if (owner) {
        // Imoveis do proprietario
        const { data: propertyOwners } = await supabase
          .from("property_owners")
          .select(`
            ownership_percentage,
            is_main_contact,
            property:dev_properties(id, title, slug, status, listing_price, property_type, city)
          `)
          .eq("owner_id", contact.owner_id)

        const properties = (propertyOwners || [])
          .map((po: any) => ({
            ...po.property,
            ownership_percentage: po.ownership_percentage,
            is_main_contact: po.is_main_contact,
          }))
          .filter((p: any) => p.id)

        // Processos dos imoveis do owner
        const propertyIds = properties.map((p: any) => p.id)
        let processes: any[] = []

        if (propertyIds.length > 0) {
          const { data: procs } = await supabase
            .from("proc_instances")
            .select("id, external_ref, current_status, percent_complete, property_id")
            .in("property_id", propertyIds)

          processes = procs || []
        }

        ownerData = { ...owner, properties, processes }
      }
    }

    // Dados do lead (colunas PT: nome, telemovel, estado, temperatura, origem)
    if (contact.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, email, telemovel, estado, temperatura, origem, forma_contacto")
        .eq("id", contact.lead_id)
        .single()

      if (lead) {
        const { data: negocios } = await supabase
          .from("negocios")
          .select("id, tipo, estado, tipo_imovel, localizacao, orcamento_max")
          .eq("lead_id", contact.lead_id)

        // Mapear nomes PT para interface esperada pelo frontend
        leadData = {
          id: lead.id,
          name: lead.nome,
          email: lead.email,
          phone_primary: lead.telemovel,
          status: lead.estado,
          score: null,
          source: lead.origem,
          lead_type: lead.forma_contacto,
          priority: lead.temperatura,
          negocios: negocios || [],
        }
      }
    }

    return NextResponse.json({ owner: ownerData, lead: leadData })
  } catch (error) {
    console.error("[whatsapp/contacts/erp-data] GET erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
