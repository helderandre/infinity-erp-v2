import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'

// Public endpoint — returns the minimum info the public form needs to render:
// property headline (title, address, cover photo), invite status, and expiry.
// No auth required; the token itself is the authorisation.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await loadInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  }

  const usable = isInviteUsable(invite)

  const admin = createAdminClient()
  const { data: property } = await admin
    .from('dev_properties')
    .select(
      `id, title, address_street, address_parish, city, zone, postal_code,
       dev_property_media(url, is_cover, order_index)`
    )
    .eq('id', invite.property_id)
    .single()

  const { data: consultant } = await admin
    .from('dev_users')
    .select(
      'id, commercial_name, professional_email, dev_consultant_profiles(profile_photo_url, phone_commercial)'
    )
    .eq('id', invite.created_by)
    .single()

  const cover =
    property?.dev_property_media?.find((m: any) => m.is_cover)?.url ||
    property?.dev_property_media?.[0]?.url ||
    null

  return NextResponse.json({
    invite: {
      token: invite.token,
      status: usable.ok ? 'pending' : (usable.reason ?? invite.status),
      expires_at: invite.expires_at,
      note: invite.note,
    },
    property: property
      ? {
          id: property.id,
          title: property.title,
          address: [property.address_street, property.address_parish, property.city]
            .filter(Boolean)
            .join(', '),
          cover_url: cover,
        }
      : null,
    consultant: consultant
      ? {
          name: consultant.commercial_name,
          email: consultant.professional_email,
          photo_url:
            (consultant as any).dev_consultant_profiles?.profile_photo_url ||
            null,
          phone:
            (consultant as any).dev_consultant_profiles?.phone_commercial ||
            null,
        }
      : null,
  })
}
