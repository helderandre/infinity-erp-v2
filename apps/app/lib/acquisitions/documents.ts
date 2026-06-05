import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Upsert documents for a property: clear existing and insert new ones.
 * Only inserts documents that have both file_url and file_name.
 */
export async function upsertDocuments(
  supabase: SupabaseClient,
  propertyId: string,
  uploadedBy: string,
  documents: {
    doc_type_id: string
    file_url?: string
    file_name?: string
    valid_until?: string
    metadata?: Record<string, any>
    owner_id?: string
  }[],
): Promise<void> {
  const docInserts = documents
    .filter((doc) => doc.file_url && doc.file_name)
    .map((doc) => ({
      property_id: propertyId,
      owner_id: doc.owner_id || null,
      doc_type_id: doc.doc_type_id,
      file_url: doc.file_url!,
      file_name: doc.file_name!,
      uploaded_by: uploadedBy,
      valid_until: doc.valid_until || null,
      status: 'active',
      metadata: (doc.metadata || {}) as any,
    }))

  if (docInserts.length > 0) {
    const { error } = await supabase.from('doc_registry').insert(docInserts)
    if (error) console.error('Erro ao registar documentos:', error)
  }
}
