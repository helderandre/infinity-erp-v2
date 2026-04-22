// Small server-side helper to resolve a `marketing_design_categories.slug`
// against the dynamic table. Used by API handlers that write into
// `marketing_design_templates` or `agent_personal_designs` to ensure the
// requested slug exists and is active before the insert/update.

export interface ResolvedDesignCategory {
  id: string
  slug: string
  label: string
}

export async function resolveActiveDesignCategory(
  supabase: any,
  slug: string
): Promise<ResolvedDesignCategory | null> {
  if (!slug) return null
  const { data, error } = await supabase
    .from('marketing_design_categories')
    .select('id, slug, label, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data || !data.is_active) return null
  return { id: data.id, slug: data.slug, label: data.label }
}
