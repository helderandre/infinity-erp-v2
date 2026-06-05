import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: ownerId } = await params
    if (!UUID_RE.test(ownerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const rawLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

    // Auth: caller must have properties or processes permission, OR be related
    // to a property whose consultant is themselves.
    const hasProperties = await hasPermissionServer(supabase, user.id, 'properties')
    const hasProcesses = !hasProperties
      ? await hasPermissionServer(supabase, user.id, 'processes')
      : true

    if (!hasProperties && !hasProcesses) {
      // Check if this owner is linked to a property the caller is consultant of
      const admin = createAdminClient() as unknown as {
        from: (t: string) => ReturnType<typeof supabase.from>
      }

      const { data: ownerProperties } = await admin.from('property_owners')
        .select('property_id, dev_properties!inner(consultant_id)')
        .eq('owner_id', ownerId) as { data: any[] | null }

      const userIsConsultant = (ownerProperties ?? []).some(
        (po) => po.dev_properties?.consultant_id === user.id
      )

      if (!userIsConsultant) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
    }

    const admin = createAdminClient() as unknown as {
      from: (t: string) => ReturnType<typeof supabase.from>
    }

    const { data, error } = await admin.from('owner_field_audit')
      .select('id, owner_id, field_name, old_value, new_value, edited_by_auth_user_id, edited_via, subtask_id, proc_task_id, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(limit) as { data: any[] | null; error: any }

    if (error) {
      console.error('[owners/audit] fetch:', error.message)
      return NextResponse.json({ error: 'Erro a carregar histórico' }, { status: 500 })
    }

    // Hydrate optional subtask titles for grouping/display (best-effort)
    const subtaskIds = Array.from(
      new Set((data ?? []).map((r) => r.subtask_id).filter(Boolean))
    )

    let subtaskTitles: Record<string, string> = {}
    if (subtaskIds.length > 0) {
      const { data: stData } = await admin.from('proc_subtasks')
        .select('id, title')
        .in('id', subtaskIds) as { data: any[] | null }

      subtaskTitles = Object.fromEntries(
        (stData ?? []).map((s) => [s.id, s.title])
      )
    }

    return NextResponse.json({
      rows: (data ?? []).map((r) => ({
        ...r,
        subtask_title: r.subtask_id ? subtaskTitles[r.subtask_id] ?? null : null,
      })),
      total: data?.length ?? 0,
      limit,
    })
  } catch (err: any) {
    console.error('[owners/audit] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
