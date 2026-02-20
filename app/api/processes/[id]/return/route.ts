import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const returnSchema = z.object({
  reason: z.string().min(10, 'O motivo deve ter pelo menos 10 caracteres'),
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
      .select(
        `
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name)
        )
      `
      )
      .eq('id', user.id)
      .single()

    const userRoles = ((devUser as any)?.user_roles || []).map(
      (ur: any) => ur.role?.name
    ) as string[]
    const canReturn = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canReturn) {
      return NextResponse.json(
        { error: 'Sem permissão para devolver processos' },
        { status: 403 }
      )
    }

    // Parse e validação
    const body = await request.json()
    const validation = returnSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { reason } = validation.data

    // Verificar se o processo existe e está em pending_approval
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (proc.current_status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Apenas processos pendentes podem ser devolvidos' },
        { status: 400 }
      )
    }

    // Actualizar processo para returned
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'returned',
        returned_reason: reason,
        returned_at: new Date().toISOString(),
        returned_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao devolver processo', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Processo devolvido com sucesso',
    })
  } catch (error) {
    console.error('Erro ao devolver processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
