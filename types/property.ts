import type { Database } from './database'

type PropertyRow = Database['public']['Tables']['dev_properties']['Row']
type PropertySpecsRow = Database['public']['Tables']['dev_property_specifications']['Row']
type PropertyInternalRow = Database['public']['Tables']['dev_property_internal']['Row']
type PropertyMediaRow = Database['public']['Tables']['dev_property_media']['Row']
type OwnerRow = Database['public']['Tables']['owners']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

// Listagem — usado na tabela/grid de imóveis
export interface PropertyWithRelations extends PropertyRow {
  dev_property_specifications: PropertySpecsRow | null
  dev_property_media: Pick<PropertyMediaRow, 'id' | 'url' | 'is_cover' | 'order_index'>[]
  consultant: Pick<DevUser, 'id' | 'commercial_name'> | null
}

// Detalhe — usado na página de detalhe/edição
export interface PropertyDetail extends PropertyRow {
  dev_property_specifications: PropertySpecsRow | null
  dev_property_internal: PropertyInternalRow | null
  dev_property_media: PropertyMediaRow[]
  consultant: Pick<DevUser, 'id' | 'commercial_name'> | null
  property_owners: {
    ownership_percentage: number
    is_main_contact: boolean
    owner_role_id?: string | null
    owners: OwnerRow | null
  }[]
}

// Re-exports para conveniência
// Extend with AI classification fields (added via migration, not yet in auto-generated types)
export type PropertyMedia = PropertyMediaRow & {
  ai_room_label?: string | null
  ai_room_confidence?: number | null
  ai_classified_at?: string | null
  ai_enhanced_url?: string | null
  ai_staged_url?: string | null
  ai_staged_style?: string | null
}
export type PropertySpecs = PropertySpecsRow
export type PropertyInternal = PropertyInternalRow
