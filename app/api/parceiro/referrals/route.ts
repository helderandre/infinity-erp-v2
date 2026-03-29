import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { getPartnerFromSession } from "@/lib/crm/partner-session"

/**
 * GET /api/parceiro/referrals
 * Returns all referrals for the authenticated partner, with masked contact info.
 */
export async function GET(req: NextRequest) {
  try {
    const partner = await getPartnerFromSession()
    if (!partner) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const db = createCrmAdminClient()

    // Fetch referrals with related data
    const { data: referrals, error } = await db
      .from("leads_referrals")
      .select(`
        id, status, notes, created_at, updated_at,
        leads!contact_id(id, nome),
        negocios!negocio_id(id, pipeline_stage_id, expected_value, won_date, lost_date,
          leads_pipeline_stages!pipeline_stage_id(name, color, is_terminal, terminal_type)
        )
      `)
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mask contact names for privacy
    const masked = (referrals ?? []).map((r: Record<string, unknown>) => {
      const contact = r.leads as { id: string; nome: string } | null
      const negocio = r.negocios as {
        id: string; pipeline_stage_id: string; expected_value: number | null
        won_date: string | null; lost_date: string | null
        leads_pipeline_stages: { name: string; color: string; is_terminal: boolean; terminal_type: string | null } | null
      } | null

      return {
        id: r.id,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        contact_name: contact?.nome ? maskName(contact.nome) : "—",
        pipeline_stage: negocio?.leads_pipeline_stages?.name ?? null,
        pipeline_stage_color: negocio?.leads_pipeline_stages?.color ?? null,
        is_won: !!negocio?.won_date,
        is_lost: !!negocio?.lost_date,
        is_terminal: negocio?.leads_pipeline_stages?.is_terminal ?? false,
      }
    })

    // Compute summary stats
    const total = masked.length
    const byStatus = { pending: 0, accepted: 0, rejected: 0, converted: 0, lost: 0 }
    for (const r of masked) {
      const s = r.status as keyof typeof byStatus
      if (s in byStatus) byStatus[s]++
    }

    return NextResponse.json({
      referrals: masked,
      summary: {
        total,
        ...byStatus,
        conversion_rate: total > 0 ? Math.round(((byStatus.converted) / total) * 100) : 0,
      },
    })
  } catch (err) {
    console.error("[Partner Referrals]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0] + "."
  return parts[0] + " " + parts[parts.length - 1][0] + "."
}
