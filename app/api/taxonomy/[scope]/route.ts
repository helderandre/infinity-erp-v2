import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isValidScope,
  isHardcodedValue,
  getScope,
  type TaxonomyScope,
} from '@/lib/taxonomy/scopes'
import { slugifyTaxonomyValue } from '@/lib/taxonomy/slugify'

const createSchema = z.object({
  label: z.string().trim().min(1, 'Nome obrigatório').max(80),
})

// GET /api/taxonomy/[scope] — list active extras for a scope.
// `?include_inactive=1` returns all rows (for admin screen). Returns 400 on
// unknown scope so callers fail loudly when wired into a Select.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ scope: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { scope } = await params
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('include_inactive') === '1'

  const supabase = createAdminClient()
  let query = supabase
    .from('taxonomy_extras')
    .select('id, scope, value, label, is_active, sort_order, created_by, created_at, updated_at')
    .eq('scope', scope)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/taxonomy/[scope] — any authenticated user can contribute a new
// value (this is the whole point of "Outro…" — extras come from the field
// surface, not the admin screen). Admin gates apply only to PUT/DELETE.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ scope: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { scope } = await params
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const label = parsed.data.label.trim()
  // `valueFormat` decides whether we slugify (matches existing slug-based
  // columns like `dev_properties.property_type`) or store the label verbatim
  // (matches label-based columns like `negocios.tipo_imovel`).
  const scopeDef = getScope(scope as TaxonomyScope)
  const value = scopeDef.valueFormat === 'slug'
    ? slugifyTaxonomyValue(label)
    : label
  if (!value) {
    return NextResponse.json(
      { error: 'Nome inválido — apenas letras, números e espaços.' },
      { status: 400 }
    )
  }
  if (value.length > 80) {
    return NextResponse.json(
      { error: 'Nome demasiado longo (máx 80 caracteres)' },
      { status: 400 }
    )
  }

  // Reject collisions with the canonical hardcoded values — those are owned by
  // code, not the DB, and a duplicate would create an invisible row that never
  // gets surfaced (the UI prefers the hardcoded label). Match is case-
  // insensitive for label scopes to avoid "Prédio" vs "prédio" duplicates.
  const collides = scopeDef.valueFormat === 'label'
    ? scopeDef.hardcodedKeys.some((k) => k.toLowerCase() === value.toLowerCase())
    : isHardcodedValue(scope as TaxonomyScope, value)
  if (collides) {
    return NextResponse.json(
      { error: 'Este valor já existe como opção padrão' },
      { status: 409 }
    )
  }

  const supabase = createAdminClient()

  // Idempotent: if an inactive extra with the same value exists, reactivate it
  // and refresh the label. Avoids 23505 noise + restores admin-deleted values
  // when a user re-adds them. For label-format scopes match case-insensitively
  // so "Prédio"/"prédio" don't create siblings.
  const existingQuery = supabase
    .from('taxonomy_extras')
    .select('id, is_active')
    .eq('scope', scope)
  const { data: existing } = scopeDef.valueFormat === 'label'
    ? await existingQuery.ilike('value', value).maybeSingle()
    : await existingQuery.eq('value', value).maybeSingle()

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json(
        { error: 'Já existe uma opção com esse nome', existing_id: existing.id },
        { status: 409 }
      )
    }
    const { data: updated, error: updErr } = await supabase
      .from('taxonomy_extras')
      .update({ is_active: true, label })
      .eq('id', existing.id)
      .select()
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json(updated, { status: 200 })
  }

  // Auto sort_order = max+10
  const { data: maxRow } = await supabase
    .from('taxonomy_extras')
    .select('sort_order')
    .eq('scope', scope)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = (maxRow?.sort_order ?? 0) + 10

  const { data: inserted, error: insErr } = await supabase
    .from('taxonomy_extras')
    .insert({
      scope,
      value,
      label,
      sort_order: sortOrder,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma opção com esse nome' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  await supabase.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'taxonomy_extra',
    entity_id: inserted.id,
    action: 'create',
    new_data: inserted,
  })

  return NextResponse.json(inserted, { status: 201 })
}
