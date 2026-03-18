import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadDocumentToR2, type DocumentContext } from '@/lib/r2/documents'
import { recalculateProgress } from '@/lib/process-engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const UAZAPI_URL = (process.env.UAZAPI_URL ?? '').replace(/\/$/, '')

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

export async function POST(request: Request) {
  try {
    // 1. Auth — verificar utilizador autenticado
    const supabaseAuth = await createClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = createAdminClient() as SupabaseAny

    // 2. Ler body
    const body = await request.json()
    const {
      instance_id,
      wa_message_id,
      message_id,
      doc_type_id,
      property_id,
      owner_id,
      proc_task_id,
      proc_subtask_id,
      upload_item_type,
      notes,
    } = body

    if (!instance_id || (!wa_message_id && !message_id)) {
      return NextResponse.json(
        { error: 'instance_id e wa_message_id/message_id são obrigatórios' },
        { status: 400 }
      )
    }
    if (!doc_type_id) {
      return NextResponse.json(
        { error: 'Tipo de documento obrigatório' },
        { status: 400 }
      )
    }
    if (!property_id) {
      return NextResponse.json(
        { error: 'Propriedade obrigatória' },
        { status: 400 }
      )
    }

    // 3. Buscar mensagem para obter metadados do ficheiro
    let msgQuery = supabase
      .from('wpp_messages')
      .select('id, wa_message_id, instance_id, message_type, media_url, media_mime_type, media_file_name, media_file_size')

    if (message_id) {
      msgQuery = msgQuery.eq('id', message_id)
    } else {
      msgQuery = msgQuery.eq('instance_id', instance_id).eq('wa_message_id', wa_message_id)
    }

    const { data: msg, error: msgError } = await msgQuery.single()

    if (msgError || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    // 4. Validar tipo de documento
    const { data: docType, error: dtError } = await supabase
      .from('doc_types')
      .select('id, name, allowed_extensions, category')
      .eq('id', doc_type_id)
      .single()

    if (dtError || !docType) {
      return NextResponse.json({ error: 'Tipo de documento não encontrado' }, { status: 400 })
    }

    // 5. Resolver media URL via UAZAPI (se necessário)
    let fileURL = msg.media_url
    const waMessageId = msg.wa_message_id

    // Verificar se precisa resolver URL
    const needsResolve = !fileURL ||
      fileURL.includes('.enc') ||
      fileURL.includes('mmg.whatsapp.net') ||
      fileURL.includes('whatsapp.net')

    if (needsResolve) {
      const { data: inst } = await supabase
        .from('auto_wpp_instances')
        .select('uazapi_token')
        .eq('id', instance_id)
        .single()

      if (!inst?.uazapi_token) {
        return NextResponse.json({ error: 'Instância WhatsApp não encontrada' }, { status: 404 })
      }

      const uazRes = await fetch(`${UAZAPI_URL}/message/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: inst.uazapi_token,
        },
        body: JSON.stringify({
          id: waMessageId,
          return_link: true,
          generate_mp3: false,
        }),
      })

      if (!uazRes.ok) {
        return NextResponse.json(
          { error: 'Erro ao baixar média do WhatsApp' },
          { status: 502 }
        )
      }

      const uazData = await uazRes.json()
      fileURL = uazData.fileURL || uazData.url || uazData.file || null

      if (!fileURL) {
        return NextResponse.json(
          { error: 'Não foi possível obter o ficheiro do WhatsApp' },
          { status: 502 }
        )
      }

      // Actualizar media_url na mensagem
      await supabase
        .from('wpp_messages')
        .update({ media_url: fileURL })
        .eq('id', msg.id)
    }

    // 6. Baixar o ficheiro
    const fileRes = await fetch(fileURL!, { signal: AbortSignal.timeout(30_000) })

    if (!fileRes.ok) {
      return NextResponse.json(
        { error: 'Erro ao descarregar o ficheiro' },
        { status: 502 }
      )
    }

    const fileBuffer = Buffer.from(await fileRes.arrayBuffer())
    const mimeType = msg.media_mime_type || fileRes.headers.get('content-type') || 'application/octet-stream'

    // 7. Determinar nome e extensão do ficheiro
    let fileName = msg.media_file_name || `whatsapp-${Date.now()}`
    const ext = fileName.includes('.')
      ? fileName.split('.').pop()!.toLowerCase()
      : (MIME_TO_EXT[mimeType] || 'bin')

    if (!fileName.includes('.')) {
      fileName = `${fileName}.${ext}`
    }

    // 8. Validar extensão contra doc_types.allowed_extensions
    if (docType.allowed_extensions && !docType.allowed_extensions.includes(ext)) {
      return NextResponse.json(
        {
          error: `Formato "${ext}" não permitido para "${docType.name}". Aceites: ${docType.allowed_extensions.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 9. Validar tamanho (20MB)
    if (fileBuffer.length > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande. Máximo: 20MB' },
        { status: 400 }
      )
    }

    // 10. Upload ao R2
    const ctx: DocumentContext = { type: 'property', propertyId: property_id }
    const { url: r2Url, key: r2Key } = await uploadDocumentToR2(
      fileBuffer,
      fileName,
      mimeType,
      ctx
    )

    // 11. Inserir no doc_registry
    const { data: doc, error: insertError } = await supabase
      .from('doc_registry')
      .insert({
        property_id,
        owner_id: owner_id || null,
        doc_type_id,
        file_url: r2Url,
        file_name: fileName,
        uploaded_by: user.id,
        status: 'active',
        metadata: {
          size: fileBuffer.length,
          mimetype: mimeType,
          r2_key: r2Key,
          source: 'whatsapp',
          wa_message_id: waMessageId,
        },
        notes: notes || null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao registar documento', details: insertError.message },
        { status: 500 }
      )
    }

    // 12. Auto-completar tarefa ou subtarefa de processo (opcional)
    let taskCompleted = false

    if (upload_item_type === 'subtask' && proc_subtask_id) {
      // ── Completar subtarefa ──
      const { data: subtask } = await supabase
        .from('proc_subtasks')
        .select('id, proc_task_id, is_completed, config')
        .eq('id', proc_subtask_id)
        .single()

      if (subtask && !subtask.is_completed) {
        const stConfig = (subtask.config as Record<string, unknown>) || {}
        const { error: stError } = await supabase
          .from('proc_subtasks')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            config: {
              ...stConfig,
              task_result: {
                doc_registry_id: doc!.id,
                source: 'whatsapp',
                wa_message_id: waMessageId,
              },
            },
          })
          .eq('id', proc_subtask_id)

        if (!stError) {
          taskCompleted = true
          const parentTaskId = subtask.proc_task_id

          // Verificar se todas as subtarefas mandatórias estão concluídas → actualizar tarefa pai
          const { data: allSubtasks } = await supabase
            .from('proc_subtasks')
            .select('is_completed, is_mandatory')
            .eq('proc_task_id', parentTaskId)

          const stList = (allSubtasks || []) as Array<{ is_completed: boolean; is_mandatory: boolean }>
          const mandatorySubs = stList.filter((s) => s.is_mandatory)
          const allMandatoryComplete = mandatorySubs.length > 0 && mandatorySubs.every((s) => s.is_completed)
          const anyComplete = stList.some((s) => s.is_completed)

          let newTaskStatus: string
          if (allMandatoryComplete) {
            newTaskStatus = 'completed'
          } else if (anyComplete) {
            newTaskStatus = 'in_progress'
          } else {
            newTaskStatus = 'pending'
          }

          await supabase
            .from('proc_tasks')
            .update({
              status: newTaskStatus,
              completed_at: newTaskStatus === 'completed' ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', parentTaskId)

          // Buscar proc_instance_id da tarefa pai para recalcular
          const { data: parentTask } = await supabase
            .from('proc_tasks')
            .select('proc_instance_id')
            .eq('id', parentTaskId)
            .single()

          if (parentTask) {
            await recalculateProgress(parentTask.proc_instance_id).catch(console.error)
          }
        }
      }
    } else if (proc_task_id) {
      // ── Completar tarefa directa ──
      const { data: task } = await supabase
        .from('proc_tasks')
        .select('id, proc_instance_id, status, action_type, config')
        .eq('id', proc_task_id)
        .single()

      if (task && task.status === 'pending' && task.action_type === 'UPLOAD') {
        const { error: taskError } = await supabase
          .from('proc_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            task_result: {
              doc_registry_id: doc!.id,
              source: 'whatsapp',
              wa_message_id: waMessageId,
            },
          })
          .eq('id', proc_task_id)

        if (!taskError) {
          taskCompleted = true
          await recalculateProgress(task.proc_instance_id).catch(console.error)
        }
      }
    }

    return NextResponse.json(
      {
        id: doc!.id,
        url: r2Url,
        file_name: fileName,
        task_completed: taskCompleted,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/whatsapp/save-to-erp]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
