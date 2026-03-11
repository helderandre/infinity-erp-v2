import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ─── DELETE: Remover proprietário do imóvel (junction only) ─── */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ownerId: string }> }
) {
  try {
    const { id: propertyId, ownerId } = await params

    if (!UUID_REGEX.test(propertyId) || !UUID_REGEX.test(ownerId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verificar quantos owners existem
    const { count } = await supabase
      .from('property_owners')
      .select('owner_id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Não é possível remover o último proprietário do imóvel' },
        { status: 400 }
      )
    }

    // Remover junction
    const { error } = await supabase
      .from('property_owners')
      .delete()
      .eq('property_id', propertyId)
      .eq('owner_id', ownerId)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover proprietário', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover proprietário do imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
