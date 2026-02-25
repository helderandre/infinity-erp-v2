import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissões
    const { data: devUser } = await supabase
      .from('dev_users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name)
        )
      `)
      .eq('id', user.id)
      .single()

    const userRoles = ((devUser as any)?.user_roles || []).map(
      (ur: any) => ur.role?.name
    ) as string[]
    const canCancel = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canCancel) {
      return NextResponse.json(
        { error: 'Sem permissão para cancelar processos' },
        { status: 403 }
      )
    }

    // Parse e validação
    const body = await request.json()
    const validation = cancelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { reason } = validation.data

    // Verificar estado actual do processo
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status, property_id')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (['completed', 'rejected', 'cancelled'].includes(proc.current_status ?? '')) {
      return NextResponse.json(
        { error: 'Este processo já está finalizado e não pode ser cancelado' },
        { status: 400 }
      )
    }

    // Cancelar o processo
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'cancelled',
        notes: reason || 'Cancelado pelo utilizador',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao cancelar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Reverter o status do imóvel se estava 'in_process'
    if (proc.property_id) {
      const { data: property } = await supabase
        .from('dev_properties')
        .select('status')
        .eq('id', proc.property_id)
        .single()

      if (property?.status === 'in_process') {
        await supabase
          .from('dev_properties')
          .update({ status: 'pending_approval' })
          .eq('id', proc.property_id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Processo cancelado com sucesso',
    })
  } catch (error) {
    console.error('Erro ao cancelar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
