import type { Database } from './database'

export type DevUserRow = Database['public']['Tables']['dev_users']['Row']
export type ConsultantProfileRow = Database['public']['Tables']['dev_consultant_profiles']['Row']
export type ConsultantPrivateDataRow = Database['public']['Tables']['dev_consultant_private_data']['Row']

export interface ConsultantWithProfile extends DevUserRow {
  dev_consultant_profiles: ConsultantProfileRow | null
  user_roles: {
    role_id: string
    roles: { id: string; name: string } | null
  }[] | null
}

export interface ConsultantDetail extends DevUserRow {
  dev_consultant_profiles: ConsultantProfileRow | null
  dev_consultant_private_data: ConsultantPrivateDataRow | null
  user_roles: {
    role_id: string
    roles: { id: string; name: string; description: string | null } | null
  }[] | null
  properties_count?: number
}
