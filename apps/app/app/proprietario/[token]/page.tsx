import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import { OwnerInviteForm } from '@/components/owners/owner-invite-form'
import { InviteUnavailable } from '@/components/owners/invite-unavailable'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function PublicOwnerInvitePage({ params }: Props) {
  const { token } = await params

  const invite = await loadInviteByToken(token)
  if (!invite) notFound()

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

  if (!usable.ok) {
    return (
      <InviteUnavailable
        reason={usable.reason || 'expired'}
        propertyTitle={property?.title || ''}
      />
    )
  }

  return (
    <OwnerInviteForm
      token={token}
      expiresAt={invite.expires_at}
      note={invite.note}
      property={{
        title: property?.title || '',
        address: [
          property?.address_street,
          property?.address_parish,
          property?.city,
        ]
          .filter(Boolean)
          .join(', '),
        cover_url: cover,
      }}
      consultant={{
        name: consultant?.commercial_name || '',
        email: consultant?.professional_email || '',
        photo_url:
          (consultant as any)?.dev_consultant_profiles?.profile_photo_url ||
          null,
        phone:
          (consultant as any)?.dev_consultant_profiles?.phone_commercial ||
          null,
      }}
    />
  )
}
