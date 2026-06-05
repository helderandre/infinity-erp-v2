import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertContactOwner } from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params

    const auth = await assertContactOwner(contactId)
    if (!auth.ok) return auth.response

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

          // Buscar tarefas UPLOAD pendentes dos processos activos
          const activeProcessIds = processes
            .filter((p: any) => ['in_progress', 'active'].includes(p.current_status))
            .map((p: any) => p.id)

          if (activeProcessIds.length > 0) {
            // Buscar tarefas UPLOAD pendentes
            const { data: pendingTasks } = await supabase
              .from("proc_tasks")
              .select("id, title, config, proc_instance_id, stage_name, action_type, status")
              .in("proc_instance_id", activeProcessIds)
              .in("status", ["pending", "in_progress"])

            const taskIds = (pendingTasks || []).map((t: any) => t.id)

            // Buscar subtarefas UPLOAD pendentes (config->type = 'upload')
            let pendingSubtasks: any[] = []
            if (taskIds.length > 0) {
              const { data: subtasks } = await supabase
                .from("proc_subtasks")
                .select("id, title, config, proc_task_id, owner_id, is_completed")
                .in("proc_task_id", taskIds)
                .eq("is_completed", false)

              pendingSubtasks = (subtasks || []).filter(
                (st: any) => st.config?.type === "upload"
              )
            }

            // Enriquecer processos com tarefas e subtarefas pendentes
            for (const proc of processes) {
              const procTasks = (pendingTasks || []).filter(
                (t: any) => t.proc_instance_id === proc.id
              )

              // Tarefas UPLOAD directas (sem subtarefas)
              proc.pending_upload_tasks = procTasks
                .filter((t: any) => t.action_type === "UPLOAD" && t.status === "pending")
                .map((t: any) => ({
                  id: t.id,
                  title: t.title,
                  doc_type_id: t.config?.doc_type_id || null,
                  stage_name: t.stage_name,
                  type: "task" as const,
                }))

              // Subtarefas UPLOAD pendentes
              const procTaskIds = procTasks.map((t: any) => t.id)
              const procSubtasks = pendingSubtasks
                .filter((st: any) => procTaskIds.includes(st.proc_task_id))
                .map((st: any) => {
                  const parentTask = procTasks.find((t: any) => t.id === st.proc_task_id)
                  return {
                    id: st.id,
                    title: st.title,
                    doc_type_id: st.config?.doc_type_id || null,
                    stage_name: parentTask?.stage_name || null,
                    type: "subtask" as const,
                    proc_task_id: st.proc_task_id,
                    owner_id: st.owner_id || null,
                  }
                })

              proc.pending_upload_items = [
                ...proc.pending_upload_tasks,
                ...procSubtasks,
              ]
            }
          }
        }

        ownerData = { ...owner, properties, processes }
      }
    }

    // Dados do lead (colunas PT: nome, telemovel, estado, temperatura, origem)
    if (contact.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, email, telemovel, telefone, estado, temperatura, origem, forma_contacto, lead_type, observacoes, tags, localidade, concelho, distrito")
        .eq("id", contact.lead_id)
        .single()

      if (lead) {
        const { data: negocios } = await supabase
          .from("negocios")
          .select("id, tipo, estado, temperatura, tipo_imovel, quartos, quartos_min, localizacao, concelho, distrito, orcamento, orcamento_max, preco_venda, renda_pretendida, renda_max_mensal, expected_close_date, probability_pct, created_at, leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type)")
          .eq("lead_id", contact.lead_id)
          .order("created_at", { ascending: false })

        // Mapear nomes PT para interface esperada pelo frontend
        leadData = {
          id: lead.id,
          name: lead.nome,
          email: lead.email,
          phone_primary: lead.telemovel,
          telefone: lead.telefone,
          status: lead.estado,
          score: null,
          source: lead.origem,
          lead_type: lead.lead_type || lead.forma_contacto,
          priority: lead.temperatura,
          observacoes: lead.observacoes,
          tags: lead.tags || [],
          localidade: lead.localidade,
          concelho: lead.concelho,
          distrito: lead.distrito,
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
