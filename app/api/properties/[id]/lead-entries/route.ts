import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/properties/[id]/lead-entries
 *
 * Devolve os `leads_entries` (formulários do site, captura por voz, etc.) que
 * referenciam este imóvel. Match em qualquer um destes critérios — basta um
 * para a entrada contar:
 *
 *   • `form_data->>'property_id'`            === property.id
 *   • `form_data->>'property_slug'`          === property.slug
 *   • `form_data->>'property_external_ref'`  === property.external_ref
 *   • `form_url ILIKE '%<slug>%'`            (fallback para entries antigas)
 *
 * Resposta: lista ordenada por `created_at desc` com o contacto resolvido
 * (id + nome + email + telemovel) para a UI poder linkar para `/dashboard/leads/<contact_id>`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabaseRaw = await createClient()
    const supabase = supabaseRaw as unknown as {
      from: (table: string) => any
      auth: typeof supabaseRaw.auth
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 1. Carregar identificadores do imóvel para correlacionar com form_data
    const { data: property, error: propError } = await supabase
      .from('dev_properties')
      .select('id, slug, external_ref')
      .eq('id', id)
      .single()

    if (propError || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    // 2. Construir filtro OR para PostgREST. Cada predicado mira a JSON key
    //    correspondente (operador `->>` em jsonb), que aceita igualdade exacta.
    const filters: string[] = []
    filters.push(`form_data->>property_id.eq.${property.id}`)
    if (property.slug) {
      filters.push(`form_data->>property_slug.eq.${property.slug}`)
      // form_url muitas vezes contém o slug — fallback útil para entradas antigas
      filters.push(`form_url.ilike.%${property.slug}%`)
    }
    if (property.external_ref) {
      filters.push(`form_data->>property_external_ref.eq.${property.external_ref}`)
    }
    const orFilter = filters.join(',')

    // 3. Pull entries + contact basics em uma só query
    const { data: entries, error: entriesError } = await supabase
      .from('leads_entries')
      .select(`
        id, source, status, priority, sla_status, sla_deadline,
        form_data, form_url, raw_name, raw_email, raw_phone,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        first_contact_at, processed_at, created_at,
        contact:leads!contact_id(id, nome, full_name, email, telemovel, telefone)
      `)
      .or(orFilter)
      .order('created_at', { ascending: false })
      .limit(50)

    if (entriesError) {
      console.error('[lead-entries] query failed:', entriesError)
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    return NextResponse.json({ data: entries ?? [] })
  } catch (err) {
    console.error('[lead-entries] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
