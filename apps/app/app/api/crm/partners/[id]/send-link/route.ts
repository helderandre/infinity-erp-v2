import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/send"

/**
 * POST /api/crm/partners/[id]/send-link
 * Generates a new magic link token and sends it to the partner via email.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const db = createCrmAdminClient()

    // Fetch partner
    const { data: partner } = await db
      .from("leads_partners")
      .select("id, name, email, company")
      .eq("id", id)
      .single()

    if (!partner) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 })
    if (!partner.email) return NextResponse.json({ error: "Parceiro sem email" }, { status: 400 })

    // Generate new token
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 year

    await db
      .from("leads_partners")
      .update({
        magic_link_token: token,
        magic_link_expires_at: expiresAt.toISOString(),
      })
      .eq("id", id)

    // Build link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://erp.infinitygroup.pt"
    const magicLink = `${appUrl}/parceiro?token=${token}`

    // Send email
    const result = await sendEmail({
      to: partner.email,
      subject: "Infinity Group — Acesso ao Portal de Parceiro",
      bodyHtml: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px;">
          <p style="margin: 0 0 16px; color: #333;">Olá ${partner.name?.split(" ")[0]},</p>
          <p style="margin: 0 0 16px; color: #333;">
            Aqui está o seu link de acesso ao Portal de Parceiro da Infinity Group.
            Através deste portal pode acompanhar as leads que referenciou e submeter novas.
          </p>
          <a href="${magicLink}" style="display: inline-block; background: #0a0a0a; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Aceder ao Portal
          </a>
          <p style="margin: 24px 0 0; color: #999; font-size: 12px;">
            Este link é pessoal e válido por 1 ano. Não o partilhe com terceiros.
          </p>
        </div>
      `,
    })

    if (!result.success) {
      return NextResponse.json({ error: `Erro ao enviar email: ${result.error}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, email_sent_to: partner.email })
  } catch (err) {
    console.error("[Partner Send Link]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
