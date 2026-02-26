import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const holdSchema = z.object({
  action: z.enum(['pause', 'resume']),
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
    const canHold = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canHold) {
      return NextResponse.json(
        { error: 'Sem permissão para pausar/reactivar processos' },
        { status: 403 }
      )
    }

    // Parse e validação
    const body = await request.json()
    const validation = holdSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { action, reason } = validation.data

    // Verificar estado actual do processo
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (action === 'pause') {
      if (proc.current_status !== 'active') {
        return NextResponse.json(
          { error: 'Apenas processos activos podem ser pausados' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('proc_instances')
        .update({
          current_status: 'on_hold',
          notes: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Erro ao pausar processo', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Processo pausado com sucesso',
      })
    }

    if (action === 'resume') {
      if (proc.current_status !== 'on_hold') {
        return NextResponse.json(
          { error: 'Apenas processos pausados podem ser reactivados' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('proc_instances')
        .update({
          current_status: 'active',
          notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Erro ao reactivar processo', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Processo reactivado com sucesso',
      })
    }
  } catch (error) {
    console.error('Erro ao pausar/reactivar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
