import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { cookies } from "next/headers"

/**
 * GET /api/parceiro/validate?token=abc123
 * Validates a magic link token. If valid, sets a session cookie and returns partner data.
 *
 * Also used to check if the current session is still valid (no token param, checks cookie).
 */
export async function GET(req: NextRequest) {
  try {
    const db = createCrmAdminClient()
    const token = req.nextUrl.searchParams.get("token")

    // If token provided, validate and create session
    if (token) {
      const { data: partner, error } = await db
        .from("leads_partners")
        .select("id, name, email, phone, company, partner_type, is_active, magic_link_token, magic_link_expires_at")
        .eq("magic_link_token", token)
        .single()

      if (error || !partner) {
        return NextResponse.json({ error: "Link inválido" }, { status: 404 })
      }

      if (!partner.is_active) {
        return NextResponse.json({ error: "Parceiro inactivo" }, { status: 403 })
      }

      if (partner.magic_link_expires_at && new Date(partner.magic_link_expires_at) < new Date()) {
        return NextResponse.json({ error: "Link expirado. Contacte a agência para obter um novo." }, { status: 410 })
      }

      // Update last access
      await db
        .from("leads_partners")
        .update({ last_portal_access: new Date().toISOString() })
        .eq("id", partner.id)

      // Set session cookie (30 days)
      const cookieStore = await cookies()
      cookieStore.set("partner_session", `${partner.id}:${token}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })

      return NextResponse.json({
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          company: partner.company,
          partner_type: partner.partner_type,
        },
      })
    }

    // No token — check existing session cookie
    const cookieStore = await cookies()
    const session = cookieStore.get("partner_session")?.value
    if (!session) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 401 })
    }

    const [partnerId, sessionToken] = session.split(":")
    if (!partnerId || !sessionToken) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    const { data: partner } = await db
      .from("leads_partners")
      .select("id, name, email, company, partner_type, is_active, magic_link_token")
      .eq("id", partnerId)
      .eq("magic_link_token", sessionToken)
      .eq("is_active", true)
      .single()

    if (!partner) {
      // Clear invalid cookie
      cookieStore.delete("partner_session")
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
    }

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        company: partner.company,
        partner_type: partner.partner_type,
      },
    })
  } catch (err) {
    console.error("[Partner Validate]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
