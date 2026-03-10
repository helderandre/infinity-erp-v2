import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { DocumentFile, DocumentFolder, ProcessDocumentsResponse } from '@/types/process'

function mapDocToFile(doc: any, source?: 'registry' | 'task', taskTitle?: string): DocumentFile {
  return {
    id: doc.id,
    file_name: doc.file_name,
    file_url: doc.file_url,
    doc_type: doc.doc_type || doc.doc_types || { id: '', name: 'Desconhecido', category: '' },
    status: doc.status || 'active',
    uploaded_by: doc.uploaded_by_user
      ? { id: doc.uploaded_by_user.id, commercial_name: doc.uploaded_by_user.commercial_name }
      : undefined,
    metadata: doc.metadata || {},
    valid_until: doc.valid_until || undefined,
    notes: doc.notes || undefined,
    created_at: doc.created_at,
    source,
    task_title: taskTitle,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const supabase = createAdminClient()

    // 1. Get process instance with property_id and consultant (requested_by)
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, property_id, requested_by')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const propertyId = proc.property_id
    const consultantId = proc.requested_by

    // 2. Get property owners
    const { data: propertyOwners } = propertyId
      ? await supabase
          .from('property_owners')
          .select('owner_id, owners(id, name, person_type)')
          .eq('property_id', propertyId)
      : { data: [] }

    const folders: DocumentFolder[] = []
    const allDocs: DocumentFile[] = []
    const byStatus: Record<string, number> = {}

    // Helper for search filter
    const searchFilter = search
      ? (query: any) => query.ilike('file_name', `%${search}%`)
      : (query: any) => query

    // 3. Pasta "Documentos do Imóvel" — doc_registry WHERE property_id AND owner_id IS NULL
    if (propertyId) {
      let query = supabase
        .from('doc_registry')
        .select(`
          id, file_name, file_url, status, valid_until, notes, metadata, created_at,
          doc_type:doc_types(id, name, category),
          uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
        `)
        .eq('property_id', propertyId)
        .is('owner_id', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (search) query = query.ilike('file_name', `%${search}%`)

      const { data: propertyDocs } = await query

      const files = (propertyDocs || []).map((d: any) => mapDocToFile(d, 'registry'))
      folders.push({
        id: 'property',
        name: 'Documentos do Imóvel',
        icon: 'Building2',
        type: 'property',
        entity_id: propertyId,
        document_count: files.length,
        documents: files,
      })
      allDocs.push(...files)
    }

    // 3.5. Pasta "Imagens do Imóvel" — dev_property_media
    if (propertyId) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('dev_property_media')
        .select('id, url, media_type, order_index, is_cover')
        .eq('property_id', propertyId)
        .order('order_index', { ascending: true })

      if (mediaError) {
        console.error('[Documents] Erro ao buscar media:', mediaError)
      }

      const mediaFiles: DocumentFile[] = (mediaItems || []).map((m: any, idx: number) => ({
        id: m.id,
        file_name: m.is_cover ? `Capa - Imagem ${idx + 1}` : `Imagem ${idx + 1}`,
        file_url: m.url,
        doc_type: { id: 'media', name: m.is_cover ? 'Capa' : 'Fotografia', category: 'Media' },
        status: 'active' as const,
        metadata: { mimetype: 'image/webp' },
        created_at: new Date().toISOString(),
      }))

      folders.push({
        id: 'media',
        name: 'Imagens do Imóvel',
        icon: 'ImageIcon',
        type: 'media',
        entity_id: propertyId,
        document_count: mediaFiles.length,
        documents: mediaFiles,
      })
    }

    // 4. Pasta por proprietário — doc_registry WHERE owner_id = X
    if (propertyOwners && propertyOwners.length > 0) {
      for (const po of propertyOwners) {
        const owner = (po as any).owners
        if (!owner) continue

        let query = supabase
          .from('doc_registry')
          .select(`
            id, file_name, file_url, status, valid_until, notes, metadata, created_at,
            doc_type:doc_types(id, name, category),
            uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
          `)
          .eq('owner_id', owner.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (search) query = query.ilike('file_name', `%${search}%`)

        const { data: ownerDocs } = await query

        const files = (ownerDocs || []).map((d: any) => mapDocToFile(d, 'registry'))
        folders.push({
          id: `owner-${owner.id}`,
          name: owner.name || 'Proprietário',
          icon: 'User',
          type: 'owner',
          entity_id: owner.id,
          document_count: files.length,
          documents: files,
        })
        allDocs.push(...files)
      }
    }

    // 5. Pasta "Documentos do Processo" — proc_subtasks with doc_registry_id in task_result
    if (propertyId) {
      // Get all proc_tasks for this instance
      const { data: procTasks } = await supabase
        .from('proc_tasks')
        .select('id, title, task_result')
        .eq('proc_instance_id', id)
        .not('task_result', 'is', null)

      // Also get subtasks with task_result
      const { data: procSubtasks } = await supabase
        .from('proc_subtasks')
        .select('id, title, proc_task_id, config')
        .eq('is_completed', true)
        .in('proc_task_id', (procTasks || []).map(t => t.id))

      // Collect doc_registry_ids from task_result
      const docIds: { docId: string; taskTitle: string }[] = []

      for (const task of procTasks || []) {
        const result = task.task_result as any
        if (result?.doc_registry_id) {
          docIds.push({ docId: result.doc_registry_id, taskTitle: task.title })
        }
      }

      // Also check subtask configs for doc_registry_id
      for (const sub of procSubtasks || []) {
        const config = sub.config as any
        if (config?.doc_registry_id) {
          const parentTask = (procTasks || []).find(t => t.id === sub.proc_task_id)
          docIds.push({ docId: config.doc_registry_id, taskTitle: sub.title || parentTask?.title || '' })
        }
      }

      if (docIds.length > 0) {
        const uniqueDocIds = [...new Set(docIds.map(d => d.docId))]
        let query = supabase
          .from('doc_registry')
          .select(`
            id, file_name, file_url, status, valid_until, notes, metadata, created_at,
            doc_type:doc_types(id, name, category),
            uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
          `)
          .in('id', uniqueDocIds)
          .order('created_at', { ascending: false })

        if (search) query = query.ilike('file_name', `%${search}%`)

        const { data: processDocs } = await query

        const files = (processDocs || []).map((d: any) => {
          const match = docIds.find(di => di.docId === d.id)
          return mapDocToFile(d, 'task', match?.taskTitle)
        })

        folders.push({
          id: 'process',
          name: 'Documentos do Processo',
          icon: 'FileCheck',
          type: 'process',
          entity_id: id,
          document_count: files.length,
          documents: files,
        })
        allDocs.push(...files)
      } else {
        folders.push({
          id: 'process',
          name: 'Documentos do Processo',
          icon: 'FileCheck',
          type: 'process',
          entity_id: id,
          document_count: 0,
          documents: [],
        })
      }
    }

    // 6. Pasta "Documentos do Consultor" — consultant_documents WHERE consultant_id
    if (consultantId) {
      let query = supabase
        .from('consultant_documents')
        .select(`
          id, file_name, file_url, status, valid_until, notes, metadata, created_at,
          doc_type:doc_types(id, name, category)
        `)
        .eq('consultant_id', consultantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (search) query = query.ilike('file_name', `%${search}%`)

      const { data: consultantDocs } = await query

      const files = (consultantDocs || []).map((d: any) => mapDocToFile(d, 'registry'))
      folders.push({
        id: 'consultant',
        name: 'Documentos do Consultor',
        icon: 'Briefcase',
        type: 'consultant',
        entity_id: consultantId,
        document_count: files.length,
        documents: files,
      })
      allDocs.push(...files)
    }

    // 7. Calculate stats
    let totalSizeBytes = 0
    for (const doc of allDocs) {
      const size = doc.metadata?.size
      if (typeof size === 'number') totalSizeBytes += size
      const status = doc.status || 'active'
      byStatus[status] = (byStatus[status] || 0) + 1
    }

    const response: ProcessDocumentsResponse = {
      folders,
      stats: {
        total_documents: allDocs.length,
        total_size_bytes: totalSizeBytes,
        by_status: byStatus,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao obter documentos do processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
