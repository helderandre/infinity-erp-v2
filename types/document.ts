export interface DocType {
  id: string
  name: string
  description: string | null
  category: string
  allowed_extensions: string[]
  default_validity_months: number | null
  is_system: boolean
}

export interface Document {
  id: string
  property_id: string | null
  owner_id: string | null
  doc_type_id: string
  file_url: string
  file_name: string
  uploaded_by: string
  valid_until: string | null
  status: 'active' | 'archived' | 'expired'
  metadata: { size?: number; mimetype?: string } | null
  notes: string | null
  created_at: string
  updated_at: string | null
  // Joins opcionais
  doc_type?: DocType
  uploaded_by_user?: { id: string; commercial_name: string }
}

export interface ConsultantDocument {
  id: string
  consultant_id: string
  doc_type_id: string | null
  file_url: string
  file_name: string
  uploaded_by: string | null
  valid_until: string | null
  status: 'active' | 'archived' | 'expired'
  metadata: Record<string, any>
  notes: string | null
  created_at: string
  // Joins opcionais
  doc_type?: DocType
}

export interface UploadResult {
  id: string
  url: string
  file_name: string
}

// Para o Step 5 — ficheiro guardado em memória, pendente de upload após submit
export interface DeferredDocument {
  id: string                    // crypto.randomUUID() — key React
  doc_type_id: string
  doc_type_name: string
  file: File                    // Objecto nativo do browser
  file_name: string
  file_size: number
  file_type: string
  owner_id?: string
}

// Para o Step 5 — documento pendente de upload no formulario
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file_url?: string
  file_name?: string
  valid_until?: string
  metadata?: Record<string, any>
  owner_id?: string
  // Estado local
  existing_doc?: Document | null
  is_uploaded: boolean
}
