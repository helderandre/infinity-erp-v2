import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ownerSchema } from '@/lib/validations/owner'
import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ─── POST: Adicionar proprietário a um imóvel ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    if (!UUID_REGEX.test(propertyId)) {
      return NextResponse.json({ error: 'propertyId inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const body = await request.json()

    let ownerId = body.owner_id as string | undefined

    // Se não veio owner_id, criar novo owner inline
    if (!ownerId && body.owner) {
      const validation = ownerSchema.safeParse(body.owner)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados do proprietário inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      // Verificar NIF duplicado
      if (validation.data.nif) {
        const { data: existing } = await supabase
          .from('owners')
          .select('id')
          .eq('nif', validation.data.nif)
          .single()

        if (existing) {
          return NextResponse.json(
            { error: 'Já existe um proprietário com este NIF', existing_id: existing.id },
            { status: 409 }
          )
        }
      }

      // Clean empty strings to null
      const cleanedData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(validation.data)) {
        cleanedData[key] = value === '' ? null : value
      }

      const { data: newOwner, error: ownerError } = await supabase
        .from('owners')
        .insert(cleanedData as any)
        .select('id')
        .single()

      if (ownerError) {
        return NextResponse.json(
          { error: 'Erro ao criar proprietário', details: ownerError.message },
          { status: 500 }
        )
      }

      ownerId = newOwner.id
    }

    if (!ownerId || !UUID_REGEX.test(ownerId)) {
      return NextResponse.json(
        { error: 'owner_id é obrigatório (ou enviar owner para criar inline)' },
        { status: 400 }
      )
    }

    // Verificar se já está associado
    const { data: existing } = await supabase
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId)
      .eq('owner_id', ownerId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Este proprietário já está associado a este imóvel' },
        { status: 409 }
      )
    }

    // Inserir junction
    const { error: insertError } = await supabase
      .from('property_owners')
      .insert({
        property_id: propertyId,
        owner_id: ownerId,
        ownership_percentage: body.ownership_percentage ?? 100,
        is_main_contact: body.is_main_contact ?? false,
        owner_role_id: body.owner_role_id || undefined,
      })

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao associar proprietário', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, owner_id: ownerId }, { status: 201 })
  } catch (error) {
    console.error('Erro ao adicionar proprietário ao imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/* ─── PUT: Batch update dos dados da junction ─── */
const batchUpdateSchema = z.object({
  owners: z.array(
    z.object({
      owner_id: z.string(),
      ownership_percentage: z.number().min(0).max(100),
      is_main_contact: z.boolean(),
      owner_role_id: z.string().uuid().optional(),
    })
  ).min(1, 'Deve haver pelo menos 1 proprietário'),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    if (!UUID_REGEX.test(propertyId)) {
      return NextResponse.json({ error: 'propertyId inválido' }, { status: 400 })
    }

    const body = await request.json()
    const validation = batchUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { owners } = validation.data

    // Validar que exactamente 1 is_main_contact
    const mainContacts = owners.filter((o) => o.is_main_contact)
    if (mainContacts.length !== 1) {
      return NextResponse.json(
        { error: 'Deve haver exactamente 1 contacto principal' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update cada junction row
    for (const owner of owners) {
      const updateData: Record<string, unknown> = {
        ownership_percentage: owner.ownership_percentage,
        is_main_contact: owner.is_main_contact,
      }
      if (owner.owner_role_id) {
        updateData.owner_role_id = owner.owner_role_id
      }

      const { error } = await supabase
        .from('property_owners')
        .update(updateData)
        .eq('property_id', propertyId)
        .eq('owner_id', owner.owner_id)

      if (error) {
        return NextResponse.json(
          { error: `Erro ao actualizar proprietário ${owner.owner_id}`, details: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao actualizar proprietários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
