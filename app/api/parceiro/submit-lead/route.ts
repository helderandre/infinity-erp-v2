import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { getPartnerFromSession } from "@/lib/crm/partner-session"
import { ingestLead } from "@/lib/crm/ingest-lead"
import { z } from "zod"

const submitSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido").nullable().optional(),
  phone: z.string().min(9, "Telefone inválido").nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine(d => d.email || d.phone, { message: "Email ou telefone obrigatório", path: ["email"] })

/**
 * POST /api/parceiro/submit-lead
 * Partner submits a new lead referral.
 */
export async function POST(req: NextRequest) {
  try {
    const partner = await getPartnerFromSession()
    if (!partner) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await req.json()
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { name, email, phone, notes } = parsed.data
    const db = createCrmAdminClient()

    // Ingest via the standard pipeline (dedup, assign, SLA)
    const result = await ingestLead(db, {
      name,
      email: email || null,
      phone: phone || null,
      source: "partner",
      partner_id: partner.id,
      notes: notes || null,
    })

    // Create referral record
    await db.from("leads_referrals").insert({
      contact_id: result.contact_id,
      entry_id: result.entry_id,
      referral_type: "partner_inbound",
      partner_id: partner.id,
      status: "pending",
      notes: notes || null,
    })

    return NextResponse.json({
      success: true,
      contact_id: result.contact_id,
      entry_id: result.entry_id,
      assigned_to: result.assigned_agent_id ? "consultor" : "pool",
    }, { status: 201 })
  } catch (err) {
    console.error("[Partner Submit Lead]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
