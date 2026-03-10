import type { Database } from './database'

export type OwnerRow = Database['public']['Tables']['owners']['Row']
export type OwnerInsert = Database['public']['Tables']['owners']['Insert']
export type OwnerUpdate = Database['public']['Tables']['owners']['Update']

export type PropertyOwnerRow = Database['public']['Tables']['property_owners']['Row']

export interface OwnerWithProperties extends OwnerRow {
  property_owners: {
    ownership_percentage: number | null
    is_main_contact: boolean | null
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
