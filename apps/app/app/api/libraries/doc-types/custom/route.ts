import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const customDocTypeSchema = z.object({
  name: z.string().min(2, 'Nome demasiado curto').max(120),
  has_expiry: z.boolean().default(false),
  expiry_required: z.boolean().default(false),
  applies_to: z.array(z.enum(['properties', 'leads', 'negocios', 'processes'])).default([]),
  category: z.string().default('outros'),
  allowed_extensions: z.array(z.string()).default(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
})

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/**
 * Creates a bespoke doc_type on the fly from the CustomDocTypeDialog.
 * Kept separate from `/api/libraries/doc-types` (admin POST) because this
 * flow is open to any authenticated user with the `documents` permission —
 * they need it to add a one-off type when uploading from a folder.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = customDocTypeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const name = parsed.data.name.trim()
  const slug = slugify(name)

  const insertPayload = {
    name,
    description: null,
    category: parsed.data.category,
    allowed_extensions: parsed.data.allowed_extensions,
    default_validity_months: parsed.data.has_expiry ? 12 : null,
    is_system: false,
    applies_to: parsed.data.applies_to,
  }

  const { data, error } = await supabase
    .from('doc_types')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    const conflict = error.message.toLowerCase().includes('unique')
    return NextResponse.json({ error: error.message }, { status: conflict ? 409 : 500 })
  }

  // Audit
  await supabase.from('log_audit').insert({
    user_id: user.id,
    entity_type: 'doc_type',
    entity_id: data.id,
    action: 'create_custom',
    new_data: { ...insertPayload, slug },
  })

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      slug,
      hasExpiry: !!data.default_validity_months,
      expiryRequired: parsed.data.expiry_required,
      allowedExtensions: data.allowed_extensions,
      categoryId: data.category,
    },
    { status: 201 }
  )
}
