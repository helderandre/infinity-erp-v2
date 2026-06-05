import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { getPartnerFromSession } from "@/lib/crm/partner-session"

/**
 * POST /api/parceiro/request-reassign
 * Partner requests reassignment of one of their referrals.
 */
export async function POST(req: NextRequest) {
  try {
    const partner = await getPartnerFromSession()
    if (!partner) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { referral_id, reason } = await req.json()
    if (!referral_id) return NextResponse.json({ error: "referral_id obrigatório" }, { status: 400 })

    const db = createCrmAdminClient()

    // Verify the referral belongs to this partner
    const { data: referral } = await db
      .from("leads_referrals")
      .select("id, contact_id, status")
      .eq("id", referral_id)
      .eq("partner_id", partner.id)
      .single()

    if (!referral) return NextResponse.json({ error: "Referência não encontrada" }, { status: 404 })

    // Log an activity on the contact
    await db.from("leads_activities").insert({
      contact_id: referral.contact_id,
      activity_type: "system",
      subject: "Pedido de reatribuição pelo parceiro",
      description: `Parceiro ${partner.name} pediu reatribuição${reason ? `: ${reason}` : ""}`,
      metadata: { referral_id, partner_id: partner.id, reason },
    })

    // Notify gestoras
    const { data: gestoras } = await db
      .from("dev_users")
      .select("id, roles!inner(permissions)")
      .eq("is_active", true)

    const notifications = (gestoras ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((g: any) => g.roles?.permissions?.pipeline)
      .map((g: { id: string }) => ({
        recipient_id: g.id,
        type: "assignment",
        title: "Parceiro pede reatribuição",
        body: `${partner.name} pediu que a lead seja reatribuída${reason ? `: ${reason}` : ""}`,
        link: `/dashboard/crm/contactos/${referral.contact_id}`,
        contact_id: referral.contact_id,
      }))

    if (notifications.length) {
      await db.from("leads_notifications").insert(notifications)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Partner Reassign]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
