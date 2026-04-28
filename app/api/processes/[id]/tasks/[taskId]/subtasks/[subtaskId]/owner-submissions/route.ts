import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { subtaskId } = await params
    const admin = createAdminClient() as unknown as {
      from: (t: string) => ReturnType<typeof supabase.from>
    }

    // Fetch via two queries (one per metadata key) then merge — `.or()`
    // with `metadata->>field.eq.X` was unreliable across supabase-js versions.
    const STATUS_LIST = ['under_review', 'approved', 'rejected', 'signed']

    const [bySubtask, bySignedFrom] = await Promise.all([
      admin.from('doc_registry')
        .select('id, file_name, file_url, status, owner_id, doc_type_id, metadata, notes, created_at')
        .filter('metadata->>subtask_id', 'eq', subtaskId)
        .in('status', STATUS_LIST)
        .order('created_at', { ascending: false }) as Promise<{ data: any[] | null; error: any }>,
      admin.from('doc_registry')
        .select('id, file_name, file_url, status, owner_id, doc_type_id, metadata, notes, created_at')
        .filter('metadata->>signed_from_subtask_id', 'eq', subtaskId)
        .in('status', STATUS_LIST)
        .order('created_at', { ascending: false }) as Promise<{ data: any[] | null; error: any }>,
    ])

    if (bySubtask.error) {
      console.error('[owner-submissions] fetch by subtask:', bySubtask.error.message)
      return NextResponse.json({ error: 'Erro a carregar submissões' }, { status: 500 })
    }
    if (bySignedFrom.error) {
      console.error('[owner-submissions] fetch by signed_from:', bySignedFrom.error.message)
      // Non-fatal: continue with subtask matches only
    }

    const seen = new Set<string>()
    const merged: any[] = []
    for (const row of [...(bySubtask.data ?? []), ...(bySignedFrom.data ?? [])]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      merged.push(row)
    }
    merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

    // Filter in JS to keep only owner_* uploads
    const filtered = merged.filter((d) => {
      const via = d.metadata?.uploaded_via
      return (
        via === 'owner_angariacao_checklist' ||
        via === 'owner_app' ||
        via === 'owner_smart_batch_upload'
      )
    })

    // Hydrate owner names + doc_type names (best-effort)
    const ownerIds = Array.from(new Set(filtered.map((d) => d.owner_id).filter(Boolean)))
    const docTypeIds = Array.from(new Set(filtered.map((d) => d.doc_type_id).filter(Boolean)))

    let owners: Record<string, string> = {}
    let docTypes: Record<string, string> = {}

    if (ownerIds.length > 0) {
      const { data: oData } = await admin.from('owners')
        .select('id, name')
        .in('id', ownerIds) as { data: any[] | null }
      owners = Object.fromEntries((oData ?? []).map((o) => [o.id, o.name]))
    }

    if (docTypeIds.length > 0) {
      const { data: dData } = await admin.from('doc_types')
        .select('id, name')
        .in('id', docTypeIds) as { data: any[] | null }
      docTypes = Object.fromEntries((dData ?? []).map((d) => [d.id, d.name]))
    }

    return NextResponse.json({
      submissions: filtered.map((d) => ({
        id: d.id,
        file_name: d.file_name,
        file_url: d.file_url,
        status: d.status,
        owner_id: d.owner_id,
        owner_name: d.owner_id ? owners[d.owner_id] ?? null : null,
        doc_type_name: d.doc_type_id ? docTypes[d.doc_type_id] ?? null : null,
        uploaded_via: d.metadata?.uploaded_via ?? null,
        signature_method: d.metadata?.signature_method ?? null,
        signed_from_subtask_id: d.metadata?.signed_from_subtask_id ?? null,
        notes: d.notes ?? null,
        created_at: d.created_at,
      })),
    })
  } catch (err: any) {
    console.error('[owner-submissions] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
