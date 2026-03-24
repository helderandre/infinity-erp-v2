export interface PdfFieldInfo {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'textarea' | 'unknown'
  options?: string[]
  page: number
  position: { x: number; y: number; width: number; height: number } | null
  suggestedFontSize: number | null
}

export interface PdfFieldMapping {
  id: string
  template_id: string
  pdf_field_name: string
  field_type: 'text' | 'checkbox' | 'dropdown' | 'radio'
  field_options: string[] | null
  variable_key: string | null
  default_value: string | null
  transform: string | null
  font_size: number | null
  is_required: boolean
  display_label: string | null
  display_order: number
  page_number: number | null
}

export interface PdfFieldOverlay {
  name: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface FillPdfRequest {
  property_id?: string
  owner_id?: string
  consultant_id?: string
  process_id?: string
  manual_values?: Record<string, string>
}

export interface BulkMappingUpdate {
  pdf_field_name: string
  variable_key: string | null
  default_value: string | null
  transform: string | null
  font_size: number | null
  is_required: boolean
  display_label: string | null
  display_order: number
}

export interface PdfFieldWithMapping extends PdfFieldInfo {
  mapping: {
    id?: string
    variable_key: string | null
    default_value: string | null
    transform: string | null
    font_size: number | null
    is_required: boolean
    display_label: string | null
    display_order: number
  } | null
}
