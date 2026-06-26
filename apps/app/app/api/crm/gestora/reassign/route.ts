import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"
import { sendPushToUser } from "@/lib/crm/send-push"
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
    const auth = await requirePermission('leads_management')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const db = createCrmAdminClient()

    // Option 1: Reassign specific entries
    if (body.entry_ids) {
      const parsed = reassignSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 })
      }

      const { entry_ids, target_agent_id } = parsed.data

      // Update BOTH ownership columns. `assigned_agent_id` drives the gestora
      // overview + active_lead_count trigger; `assigned_consultant_id` is the
      // column every consultant-facing query (inbox, "as minhas leads") reads.
      // Writing only one leaves the lead invisible to the new owner's inbox.
      const { error, count } = await db
        .from("leads_entries")
        .update({
          assigned_agent_id: target_agent_id,
          assigned_consultant_id: target_agent_id,
        })
        .in("id", entry_ids)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Log activity for each reassigned entry
      const { data: entries } = await db
        .from("leads_entries")
        .select("id, contact_id")
        .in("id", entry_ids)

      // Keep the contact owner in sync with the entry assignment so the lead
      // shows up in the new owner's "Meus Contactos" (which filters on
      // leads.agent_id). Without this, reassigning only the entry leaves the
      // contact invisible to whoever is now working it. This is an explicit
      // human action, so it overrides any previous contact owner.
      if (entries?.length) {
        const contactIds = [
          ...new Set(entries.map((e: { contact_id: string }) => e.contact_id)),
        ]
        await db.from("leads").update({ agent_id: target_agent_id }).in("id", contactIds)
      }

      if (entries) {
        const activities = entries.map((e: { id: string; contact_id: string }) => ({
          contact_id: e.contact_id,
          activity_type: "assignment",
          subject: "Lead reatribuída",
          description: "Reatribuída pela gestora de leads",
          metadata: {
            entry_id: e.id,
            new_agent_id: target_agent_id,
            reassigned_by: auth.user.id,
          },
          created_by: auth.user.id,
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
        const { data: insertedNotifs } = await db
          .from("leads_notifications")
          .insert(notifications)
          .select("id")
        const notifIds = ((insertedNotifs as Array<{ id: string }> | null) ?? []).map((r) => r.id)

        // Push imediato — uma única notification consolidada para o
        // recipient (em vez de uma por entry; o device fica menos ruidoso
        // e o consultor abre o inbox para ver a lista completa). O cron
        // `dispatch-pending-push` é o fallback durável; marcamos is_push_sent
        // só após o envio para preservar a rede de segurança.
        try {
          const adminPush = createAdminClient()
          const n = entries.length
          await sendPushToUser(adminPush, target_agent_id, {
            title: 'Leads reatribuídas',
            body: `${n} lead${n !== 1 ? 's' : ''} reatribuída${n !== 1 ? 's' : ''} pela gestora`,
            url: '/dashboard/crm/contactos',
            tag: `gestora_reassign:${target_agent_id}:${Date.now()}`,
          })
          if (notifIds.length) {
            await db.from("leads_notifications").update({ is_push_sent: true }).in("id", notifIds)
          }
        } catch (err) {
          console.error('[gestora reassign] push:', err)
        }
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

      // Same dual-column update as Option 1 so the new owner (or the gestora
      // pool, when target is null) is consistent across overview + inbox.
      const { error } = await db
        .from("leads_entries")
        .update({
          assigned_agent_id: target_agent_id ?? null,
          assigned_consultant_id: target_agent_id ?? null,
        })
        .in("id", entryIds)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Mirror the new owner (or pool/null) onto the contact so "Meus Contactos"
      // stays consistent with the entry assignment.
      {
        const contactIds = [
          ...new Set(overdueEntries.map((e: { contact_id: string }) => e.contact_id)),
        ]
        await db
          .from("leads")
          .update({ agent_id: target_agent_id ?? null })
          .in("id", contactIds)
      }

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
          reassigned_by: auth.user.id,
          reason: "overdue_pull",
        },
        created_by: auth.user.id,
      }))
      await db.from("leads_activities").insert(activities)

      // Push consolidado ao recipient da overdue-pull (se não foi
      // devolvida ao pool). Uma só notification por batch.
      if (target_agent_id) {
        try {
          const adminPush = createAdminClient()
          const n = overdueEntries.length
          await sendPushToUser(adminPush, target_agent_id, {
            title: 'Leads em atraso reatribuídas',
            body: `${n} lead${n !== 1 ? 's' : ''} em atraso atribuída${n !== 1 ? 's' : ''} a si pela gestora`,
            url: '/dashboard/crm/contactos',
            tag: `gestora_overdue_pull:${target_agent_id}:${Date.now()}`,
          })
        } catch (err) {
          console.error('[gestora overdue-pull] push:', err)
        }
      }

      return NextResponse.json({ reassigned: overdueEntries.length })
    }

    return NextResponse.json({ error: "Forneça entry_ids ou agent_id" }, { status: 400 })
  } catch (err) {
    console.error("[Gestora Reassign]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
