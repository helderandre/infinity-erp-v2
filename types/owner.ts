import type { Database } from './database'

export type OwnerRow = Database['public']['Tables']['owners']['Row']
export type OwnerInsert = Database['public']['Tables']['owners']['Insert']
export type OwnerUpdate = Database['public']['Tables']['owners']['Update']

export type PropertyOwnerRow = Database['public']['Tables']['property_owners']['Row']

export type OwnerRoleTypeRow = Database['public']['Tables']['owner_role_types']['Row']

export interface OwnerRoleType {
  id: string
  name: string
  label: string
  color?: string | null
  order_index?: number
}

export interface OwnerWithRole extends OwnerRow {
  ownership_percentage?: number | null
  is_main_contact?: boolean
  owner_role_id?: string | null
  owner_role?: OwnerRoleType | null
}

export interface OwnerWithProperties extends OwnerRow {
  property_owners: {
    ownership_percentage: number | null
    is_main_contact: boolean | null
    owner_role_id?: string | null
    dev_properties: {
      id: string
      title: string | null
      slug: string | null
      status: string | null
      listing_price: number | null
      city: string | null
      property_type: string | null
      business_type: string | null
    } | null
  }[]
}

export interface OwnerListItem extends OwnerRow {
  properties_count: number
}
