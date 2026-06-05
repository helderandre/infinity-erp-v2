import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    // Check if user has admin/manager role → sees ALL processes
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)

    const roleNames = (userRoles || [])
      .map((ur: any) => ur.role?.name)
      .filter(Boolean) as string[]

    const isManager = roleNames.some((r) =>
      (PROCESS_MANAGER_ROLES as readonly string[]).includes(r)
    )

    // Get processes
    const { data: processes, error: procError } = await supabase
      .from('proc_instances')
      .select(`
        id,
        external_ref,
        current_status,
        property:dev_properties(id, title)
      `)
      .neq('current_status', 'cancelled')
      .is('deleted_at', null)
      .limit(100)

    if (procError) {
      return NextResponse.json({ error: procError.message }, { status: 500 })
    }

    if (!processes || processes.length === 0) {
      return NextResponse.json([])
    }

    let userProcesses: any[]

    if (isManager) {
      // Managers see all processes
      userProcesses = processes
    } else {
      // Regular users: only processes they participate in
      const processIds = processes.map((p: any) => p.id)

      const { data: assignedTasks } = await supabase
        .from('proc_tasks')
        .select('proc_instance_id')
        .eq('assigned_to', user.id)
        .in('proc_instance_id', processIds)

      const { data: consultantProps } = await supabase
        .from('dev_properties')
        .select('id')
        .eq('consultant_id', user.id)

      const consultantPropIds = new Set((consultantProps || []).map((p: any) => p.id))
      const assignedProcIds = new Set((assignedTasks || []).map((t: any) => t.proc_instance_id))

      userProcesses = processes.filter((p: any) => {
        return assignedProcIds.has(p.id) || consultantPropIds.has(p.property?.id)
      })
    }

    if (userProcesses.length === 0) {
      return NextResponse.json([])
    }

    const userProcIds = userProcesses.map((p: any) => p.id)

    // Get last message for each process
    const { data: lastMessages } = await supabase
      .from('proc_chat_messages')
      .select(`
        proc_instance_id,
        content,
        created_at,
        sender:dev_users(commercial_name)
      `)
      .in('proc_instance_id', userProcIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const lastMessageMap = new Map<string, any>()
    for (const msg of (lastMessages || [])) {
      const procId = (msg as any).proc_instance_id
      if (!lastMessageMap.has(procId)) {
        lastMessageMap.set(procId, msg)
      }
    }

    // Get read receipts for this user
    const { data: receipts } = await supabase
      .from('proc_chat_read_receipts')
      .select('proc_instance_id, last_read_message_id, last_read_at')
      .eq('user_id', user.id)
      .in('proc_instance_id', userProcIds)

    const receiptMap = new Map<string, any>()
    for (const r of (receipts || [])) {
      receiptMap.set((r as any).proc_instance_id, r)
    }

    // Count unread messages per process
    const results = await Promise.all(
      userProcesses.map(async (proc: any) => {
        const receipt = receiptMap.get(proc.id)
        let unreadCount = 0

        if (receipt?.last_read_at) {
          const { count } = await supabase
            .from('proc_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('proc_instance_id', proc.id)
            .eq('is_deleted', false)
            .neq('sender_id', user.id)
            .gt('created_at', receipt.last_read_at)

          unreadCount = count || 0
        } else {
          const { count } = await supabase
            .from('proc_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('proc_instance_id', proc.id)
            .eq('is_deleted', false)
            .neq('sender_id', user.id)

          unreadCount = count || 0
        }

        const lastMsg = lastMessageMap.get(proc.id)
        const propertyTitle = proc.property?.title || null

        return {
          proc_instance_id: proc.id,
          external_ref: proc.external_ref,
          property_title: propertyTitle,
          current_status: proc.current_status,
          last_message: lastMsg
            ? {
                content: (lastMsg as any).content?.substring(0, 80) || '',
                sender_name: (lastMsg as any).sender?.commercial_name || '',
                created_at: (lastMsg as any).created_at,
              }
            : null,
          unread_count: unreadCount,
        }
      })
    )

    // Sort: processes with messages first (by last_message date DESC), then without
    results.sort((a, b) => {
      if (a.last_message && !b.last_message) return -1
      if (!a.last_message && b.last_message) return 1
      if (a.last_message && b.last_message) {
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
      }
      return 0
    })

    // Apply search filter
    if (search) {
      const lower = search.toLowerCase()
      return NextResponse.json(
        results.filter(
          (r) =>
            r.external_ref.toLowerCase().includes(lower) ||
            (r.property_title && r.property_title.toLowerCase().includes(lower))
        )
      )
    }

    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
