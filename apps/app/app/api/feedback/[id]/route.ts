import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { updateFeedbackSchema } from '@/lib/validations/feedback'
import { sendPushToUser } from '@/lib/crm/send-push'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('feedback_submissions')
      .select(`
        *,
        submitter:submitted_by(id, commercial_name),
        assignee:assigned_to(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Submissão não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter feedback:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = updateFeedbackSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Snapshot pré-update para detectar transição para `concluido` e disparar
    // push idempotente ao submitter (apenas se ele optou por ser notificado).
    const { data: before } = await supabase
      .from('feedback_submissions')
      .select('status, type, title, submitted_by, notify_on_resolution, resolution_notification_sent_at')
      .eq('id', id)
      .single()

    // Permissão: management edita tudo; autor pode editar APENAS o conteúdo
    // (title/description) do próprio ticket — campos de triagem (status,
    // priority, assigned_to, tech_notes) permanecem exclusivos da gestão.
    const isManagement = isManagementRole(auth.roles)
    const isAuthor = !!before && before.submitted_by === auth.user.id
    if (!isManagement) {
      if (!isAuthor) {
        return NextResponse.json(
          { error: 'Sem permissão para editar este item' },
          { status: 403 }
        )
      }
      const triageFields = ['status', 'priority', 'assigned_to', 'tech_notes'] as const
      const touchesTriage = triageFields.some((f) => (validation.data as Record<string, unknown>)[f] !== undefined)
      if (touchesTriage) {
        return NextResponse.json(
          { error: 'Sem permissão para alterar campos de triagem' },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabase
      .from('feedback_submissions')
      .update(validation.data)
      .eq('id', id)
      .select(`
        *,
        submitter:submitted_by(id, commercial_name),
        assignee:assigned_to(id, commercial_name)
      `)
      .single()

    if (error) {
      console.error('Erro ao actualizar feedback:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Side-effect: notificar submitter quando ticket/ideia é dado como
    // concluído. Idempotente via `resolution_notification_sent_at`. Falhas
    // isoladas — não revertem a actualização.
    if (
      validation.data.status === 'concluido' &&
      before &&
      before.status !== 'concluido' &&
      before.notify_on_resolution &&
      !before.resolution_notification_sent_at &&
      before.submitted_by
    ) {
      try {
        const isIdeia = before.type === 'ideia'
        const payload = isIdeia
          ? {
              title: 'Obrigado pela tua ideia! 💜',
              body: `"${before.title}" acaba de ser implementada. Esta melhoria nasceu graças a ti :)`,
            }
          : {
              title: 'O bug que reportaste foi corrigido! 🛠️',
              body: `"${before.title}" está resolvido. Obrigado por nos ajudares a tornar a app melhor :)`,
            }
        await sendPushToUser(supabase, before.submitted_by, {
          ...payload,
          url: '/dashboard',
          tag: `feedback-resolved-${id}`,
        })
        await supabase
          .from('feedback_submissions')
          .update({ resolution_notification_sent_at: new Date().toISOString() })
          .eq('id', id)
      } catch (pushErr) {
        console.error('Erro ao enviar push de feedback concluído:', pushErr)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar feedback:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    // Management pode eliminar qualquer item; o submetente pode eliminar
    // o próprio (self-cleanup). Resto → 403.
    if (!isManagementRole(auth.roles)) {
      const { data: row, error: lookupErr } = await supabase
        .from('feedback_submissions')
        .select('submitted_by')
        .eq('id', id)
        .single()
      if (lookupErr) {
        if (lookupErr.code === 'PGRST116') {
          return NextResponse.json({ error: 'Submissão não encontrada' }, { status: 404 })
        }
        return NextResponse.json({ error: lookupErr.message }, { status: 500 })
      }
      if (row?.submitted_by !== auth.user.id) {
        return NextResponse.json(
          { error: 'Sem permissão para eliminar este item' },
          { status: 403 }
        )
      }
    }

    const { error } = await supabase
      .from('feedback_submissions')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar feedback:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
