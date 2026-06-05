import { createAdminClient } from '@/lib/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves the public consultant payload to render on /apresentacao/[slug]
 * pages when the URL has `?c=<consultant_id>`. Returns the same row shape
 * as the inline `consultant:dev_users!consultant_id(...)` select used in the
 * property page so the caller can swap `property.consultant` directly.
 *
 * Returns null when the id is malformed, the user is inactive, or the
 * lookup fails — falling back to the property's assigned consultant.
 */
export async function fetchConsultantOverride(
  consultantId: string | null | undefined,
) {
  if (!consultantId || !UUID_REGEX.test(consultantId)) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('dev_users')
    .select(`
      id, commercial_name, professional_email,
      dev_consultant_profiles(profile_photo_url, phone_commercial, instagram_handle)
    `)
    .eq('id', consultantId)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
}
