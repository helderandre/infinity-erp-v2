import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

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
    // Autenticação + verificação de roles
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

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
