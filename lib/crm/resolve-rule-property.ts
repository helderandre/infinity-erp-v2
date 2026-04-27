/**
 * Resolve property_external_ref ↔ property_id for assignment rules.
 *
 * The gestora picks an imóvel by external_ref (canonical, copy-pasteable from
 * the imóveis page); the API stores both columns so the matcher and downstream
 * stamping can choose whichever is convenient. This helper takes whatever side
 * the caller supplied and fills in the missing one against dev_properties.
 *
 * Returns `{ error }` (with a PT-PT message) when the supplied identifier
 * doesn't exist or when both are supplied but disagree.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

interface PropertyLinkageInput {
  property_external_ref: string | null | undefined
  property_id: string | null | undefined
}

interface PropertyLinkageResolved {
  property_external_ref: string | null
  property_id: string | null
  error?: string
}

export async function resolveRulePropertyLinkage(
  supabase: SupabaseClient,
  input: PropertyLinkageInput,
): Promise<PropertyLinkageResolved> {
  const ref = (input.property_external_ref ?? '').trim() || null
  const id = (input.property_id ?? '').toString().trim() || null

  // Both empty — explicit clear.
  if (!ref && !id) {
    return { property_external_ref: null, property_id: null }
  }

  // Both supplied — verify they point to the same row.
  if (ref && id) {
    const { data } = await supabase
      .from('dev_properties')
      .select('id, external_ref')
      .eq('id', id)
      .maybeSingle()
    if (!data) {
      return { property_external_ref: null, property_id: null, error: `Imóvel ${id} não encontrado.` }
    }
    if (data.external_ref !== ref) {
      return {
        property_external_ref: null,
        property_id: null,
        error: `Referência (${ref}) não corresponde ao imóvel ${id}.`,
      }
    }
    return { property_external_ref: ref, property_id: id }
  }

  // Only ref supplied — resolve UUID.
  if (ref) {
    const { data } = await supabase
      .from('dev_properties')
      .select('id')
      .eq('external_ref', ref)
      .maybeSingle()
    if (!data?.id) {
      return { property_external_ref: null, property_id: null, error: `Imóvel com referência "${ref}" não encontrado.` }
    }
    return { property_external_ref: ref, property_id: data.id }
  }

  // Only UUID supplied — resolve ref.
  const { data } = await supabase
    .from('dev_properties')
    .select('external_ref')
    .eq('id', id)
    .maybeSingle()
  if (!data) {
    return { property_external_ref: null, property_id: null, error: `Imóvel ${id} não encontrado.` }
  }
  return { property_external_ref: data.external_ref ?? null, property_id: id }
}
