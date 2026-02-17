import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
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

    // Verificar permissões (apenas Broker/CEO ou Gestora Processual)
    const { data: devUser } = await supabase
      .from('dev_users')
      .select(
        `
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name, permissions)
        )
      `
      )
      .eq('id', user.id)
      .single()

    const roleName = (devUser as any)?.user_roles?.[0]?.role?.name
    const canApprove = ['Broker/CEO', 'Gestora Processual'].includes(roleName)

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Sem permissão para aprovar processos' },
        { status: 403 }
      )
    }

    // Verificar se o processo existe e está em pending_approval ou returned
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('*, property:dev_properties(id)')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (!proc.current_status || !['pending_approval', 'returned'].includes(proc.current_status)) {
      return NextResponse.json(
        { error: 'Apenas processos pendentes ou devolvidos podem ser aprovados' },
        { status: 400 }
      )
    }

    // Actualizar processo para active
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        started_at: proc.started_at || new Date().toISOString(),
        returned_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao aprovar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Actualizar status do imóvel para in_process
    const { error: propertyError } = await supabase
      .from('dev_properties')
      .update({ status: 'in_process' })
      .eq('id', proc.property.id)

    if (propertyError) {
      console.error('Erro ao actualizar status do imóvel:', propertyError)
    }

    return NextResponse.json({
      success: true,
      message: 'Processo aprovado com sucesso',
    })
  } catch (error) {
    console.error('Erro ao aprovar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
