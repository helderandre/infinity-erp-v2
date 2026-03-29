import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const reassignSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1, "Seleccione pelo menos uma entrada"),
  target_agent_id: z.string().uuid("ID do consultor inválido"),
})

const pullOverdueSchema = z.object({
  agent_id: z.string().uuid("ID do consultor inválido"),
  target_agent_id: z.string().uuid().nullable().optional(), // null = gestora pool
})

/**
 * POST /api/crm/gestora/reassign
 * Bulk reassign lead entries to a different agent.
 *
 * Body options:
 * 1. { entry_ids: [...], target_agent_id: "uuid" } — reassign specific entries
 * 2. { agent_id: "uuid", target_agent_id: "uuid"|null } — pull all overdue from an agent
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const db = createCrmAdminClient()

    // Option 1: Reassign specific entries
    if (body.entry_ids) {
      const parsed = reassignSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 })
      }

      const { entry_ids, target_agent_id } = parsed.data

      const { error, count } = await db
        .from("leads_entries")
        .update({ assigned_agent_id: target_agent_id })
        .in("id", entry_ids)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Log activity for each reassigned entry
      const { data: entries } = await db
        .from("leads_entries")
        .select("id, contact_id")
        .in("id", entry_ids)

      if (entries) {
        const activities = entries.map((e: { id: string; contact_id: string }) => ({
          contact_id: e.contact_id,
          activity_type: "assignment",
          subject: "Lead reatribuída",
          description: "Reatribuída pela gestora de leads",
          metadata: {
            entry_id: e.id,
            new_agent_id: target_agent_id,
            reassigned_by: user.id,
          },
          created_by: user.id,
        }))
        await db.from("leads_activities").insert(activities)
      }

      // Notify the new agent
      if (entries?.length) {
        const notifications = entries.map((e: { id: string; contact_id: string }) => ({
          recipient_id: target_agent_id,
          type: "assignment",
          title: "Lead reatribuída",
          body: "Uma lead foi-lhe atribuída pela gestora de leads",
          link: `/dashboard/crm/contactos/${e.contact_id}`,
          entry_id: e.id,
          contact_id: e.contact_id,
        }))
        await db.from("leads_notifications").insert(notifications)
      }

      return NextResponse.json({ reassigned: count ?? entry_ids.length })
    }

    // Option 2: Pull all overdue from an agent
    if (body.agent_id) {
      const parsed = pullOverdueSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 })
      }

      const { agent_id, target_agent_id } = parsed.data

      // Find all overdue entries for this agent
      const { data: overdueEntries } = await db
        .from("leads_entries")
        .select("id, contact_id")
        .eq("assigned_agent_id", agent_id)
        .in("sla_status", ["warning", "breached"])
        .is("first_contact_at", null)

      if (!overdueEntries?.length) {
        return NextResponse.json({ reassigned: 0, message: "Sem leads em atraso" })
      }

      const entryIds = overdueEntries.map((e: { id: string }) => e.id)

      const { error } = await db
        .from("leads_entries")
        .update({ assigned_agent_id: target_agent_id ?? null })
        .in("id", entryIds)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Log activities
      const activities = overdueEntries.map((e: { id: string; contact_id: string }) => ({
        contact_id: e.contact_id,
        activity_type: "assignment",
        subject: target_agent_id ? "Lead reatribuída" : "Lead devolvida ao pool",
        description: `Reatribuída pela gestora (leads em atraso do consultor)`,
        metadata: {
          entry_id: e.id,
          from_agent_id: agent_id,
          new_agent_id: target_agent_id ?? null,
          reassigned_by: user.id,
          reason: "overdue_pull",
        },
        created_by: user.id,
      }))
      await db.from("leads_activities").insert(activities)

      return NextResponse.json({ reassigned: overdueEntries.length })
    }

    return NextResponse.json({ error: "Forneça entry_ids ou agent_id" }, { status: 400 })
  } catch (err) {
    console.error("[Gestora Reassign]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
