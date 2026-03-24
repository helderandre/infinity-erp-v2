import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/service'
import { APPROVER_NOTIFICATION_ROLES } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/auth/permissions'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Verificar se o processo existe e não está já eliminado
    const { data: procRaw, error: procError } = await supabase
      .from('proc_instances')
      .select('id, current_status, property_id, external_ref, requested_by')
      .eq('id', id)
      .single()

    if (procError || !procRaw) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const proc = procRaw as typeof procRaw & { deleted_at?: string | null }

    if (proc.deleted_at) {
      return NextResponse.json({ error: 'Processo já foi eliminado' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Soft-delete: marcar como eliminado em vez de remover
    const { error: deleteError } = await (adminSupabase as any)
      .from('proc_instances')
      .update({
        current_status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: auth.user.id,
      })
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao eliminar processo:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao eliminar processo', details: deleteError.message },
        { status: 500 }
      )
    }

    // Reverter o status do imóvel se estava 'in_process'
    if (proc.property_id) {
      const { data: property } = await adminSupabase
        .from('dev_properties')
        .select('status')
        .eq('id', proc.property_id)
        .single()

      if (property?.status === 'in_process') {
        await adminSupabase
          .from('dev_properties')
          .update({ status: 'pending_approval' })
          .eq('id', proc.property_id)
      }
    }

    // Obter nome do utilizador que eliminou
    const { data: deleter } = await adminSupabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', auth.user.id)
      .single()

    const deleterName = deleter?.commercial_name || 'Utilizador'

    // Enviar notificação ao criador do processo (se for diferente de quem eliminou)
    if (proc.requested_by && proc.requested_by !== auth.user.id) {
      await notificationService.create({
        recipientId: proc.requested_by,
        senderId: auth.user.id,
        notificationType: 'process_deleted',
        entityType: 'proc_instance',
        entityId: id,
        title: 'Processo eliminado',
        body: `O processo ${proc.external_ref || ''} foi eliminado por ${deleterName}`,
        actionUrl: `/dashboard/processos/${id}`,
        metadata: {
          process_ref: proc.external_ref,
          deleted_by_name: deleterName,
        },
      })
    }

    // Notificar também gestoras processuais e brokers
    const managerIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
    const recipientIds = managerIds.filter(
      (rid) => rid !== auth.user.id && rid !== proc.requested_by
    )
    if (recipientIds.length > 0) {
      await notificationService.createBatch(recipientIds, {
        senderId: auth.user.id,
        notificationType: 'process_deleted',
        entityType: 'proc_instance',
        entityId: id,
        title: 'Processo eliminado',
        body: `O processo ${proc.external_ref || ''} foi eliminado por ${deleterName}`,
        actionUrl: `/dashboard/processos/${id}`,
        metadata: {
          process_ref: proc.external_ref,
          deleted_by_name: deleterName,
        },
      })
    }

    return NextResponse.json({ success: true, message: 'Processo eliminado com sucesso' })
  } catch (error) {
    console.error('Erro ao eliminar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('proc_instances')
      .select(
        `
        *,
        property:dev_properties(
          id,
          title,
          slug,
          city,
          listing_price,
          status,
          property_type,
          business_type,
          property_condition,
          energy_certificate,
          external_ref,
          description,
          address_street,
          address_parish,
          postal_code,
          zone,
          latitude,
          longitude,
          business_status,
          contract_regime,
          consultant_id,
          consultant:dev_users!dev_properties_consultant_id_fkey(
            id,
            commercial_name,
            professional_email,
            is_active,
            dev_consultant_profiles(
              phone_commercial,
              bio,
              specializations,
              languages,
              instagram_handle,
              linkedin_url,
              profile_photo_url
            )
          ),
          dev_property_specifications(
            typology, bedrooms, bathrooms,
            area_gross, area_util,
            construction_year, parking_spaces, garage_spaces,
            features, has_elevator, fronts_count,
            solar_orientation, views, equipment,
            storage_area, balcony_area, pool_area,
            attic_area, pantry_area, gym_area
          ),
          dev_property_internal(
            commission_agreed, commission_type,
            contract_regime, contract_term, contract_expiry,
            imi_value, condominium_fee,
            cpcv_percentage, reference_internal, internal_notes,
            listing_links, exact_address, postal_code
          ),
          dev_property_media(id, url, media_type, is_cover, order_index)
        ),
        requested_by_user:dev_users!proc_instances_requested_by_fkey(
          id,
          commercial_name
        ),
        approved_by_user:dev_users!proc_instances_approved_by_fkey(
          id,
          commercial_name
        ),
        returned_by_user:dev_users!proc_instances_returned_by_fkey(
          id,
          commercial_name
        ),
        rejected_by_user:dev_users!proc_instances_rejected_by_fkey(
          id,
          commercial_name
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // Cast para incluir colunas de soft-delete (ainda não nos types gerados)
    const instance = data as typeof data & { deleted_at?: string | null; deleted_by?: string | null }

    // Se o processo foi soft-deleted, retornar info de eliminação
    if (instance.deleted_at) {
      const adminSupabase = createAdminClient()
      const { data: deleter } = await adminSupabase
        .from('dev_users')
        .select('id, commercial_name')
        .eq('id', instance.deleted_by!)
        .single()

      return NextResponse.json({
        deleted: true,
        deleted_at: instance.deleted_at,
        deleted_by: deleter
          ? { id: deleter.id, commercial_name: deleter.commercial_name }
          : null,
        external_ref: instance.external_ref,
      }, { status: 410 }) // 410 Gone
    }

    // Obter tarefas agrupadas por fase (com subtarefas)
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks')
      .select(
        `
        *,
        assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name, dev_consultant_profiles(profile_photo_url)),
        owner:owners!proc_tasks_owner_id_fkey(id, name, person_type),
        subtasks:proc_subtasks!proc_subtasks_proc_task_id_fkey(
          id, tpl_subtask_id, title, is_mandatory, is_completed,
          completed_at, completed_by, order_index, config,
          owner_id, is_blocked, dependency_type,
          dependency_proc_subtask_id, dependency_proc_task_id, unblocked_at,
          due_date, assigned_to, assigned_role, priority, started_at,
          owner:owners!proc_subtasks_owner_id_fkey(id, name, person_type),
          assigned_to_user:dev_users!proc_subtasks_assigned_to_fkey(id, commercial_name)
        )
      `
      )
      .eq('proc_instance_id', id)
      .order('stage_order_index', { ascending: true })
      .order('order_index', { ascending: true })

    if (tasksError) {
      console.error('Erro ao obter tarefas:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    // Ordenar subtarefas e aplanar profile_photo_url
    if (tasks) {
      // Construir mapas de nomes para resolver dependências
      const taskNameMap = new Map<string, string>()
      const subtaskNameMap = new Map<string, string>()

      tasks.forEach((task: any) => {
        taskNameMap.set(task.id, task.title || 'Tarefa')
        if (task.subtasks) {
          task.subtasks.sort((a: any, b: any) => a.order_index - b.order_index)
          task.subtasks.forEach((st: any) => {
            subtaskNameMap.set(st.id, st.title || 'Subtarefa')
          })
        }
        if (task.assigned_to_user?.dev_consultant_profiles) {
          task.assigned_to_user.profile_photo_url =
            task.assigned_to_user.dev_consultant_profiles.profile_photo_url ?? null
          delete task.assigned_to_user.dev_consultant_profiles
        }
      })

      // Resolver nomes das dependências (tarefas e subtarefas)
      tasks.forEach((task: any) => {
        if (task.is_blocked && task.dependency_proc_task_id) {
          task.blocking_task_title = taskNameMap.get(task.dependency_proc_task_id) || null
        }
        if (task.subtasks) {
          task.subtasks.forEach((st: any) => {
            if (st.is_blocked) {
              if (st.dependency_proc_subtask_id) {
                st.blocking_subtask_title = subtaskNameMap.get(st.dependency_proc_subtask_id) || null
              }
              if (st.dependency_proc_task_id) {
                st.blocking_task_title = taskNameMap.get(st.dependency_proc_task_id) || null
              }
            }
          })
        }
      })
    }

    // Buscar tpl_stages para obter IDs e depends_on_stages
    let tplStagesData: { id: string; name: string; order_index: number; depends_on_stages: string[] | null }[] = []
    if (data.tpl_process_id) {
      const { data: tplStages } = await supabase
        .from('tpl_stages')
        .select('id, name, order_index, depends_on_stages')
        .eq('tpl_process_id', data.tpl_process_id)
        .order('order_index')
      tplStagesData = tplStages || []
    }

    // Construir mapa stage_name → tpl_stage info
    const tplStageByName = new Map<string, typeof tplStagesData[0]>()
    for (const ts of tplStagesData) {
      tplStageByName.set(ts.name, ts)
    }

    const currentStageIds: string[] = data.current_stage_ids || []
    const completedStageIds: string[] = data.completed_stage_ids || []

    // Agrupar tarefas por fase
    const stagesMap = new Map<string, any>()

    tasks?.forEach((task) => {
      const stageName = task.stage_name || 'Sem Fase'
      if (!stagesMap.has(stageName)) {
        const tplStage = tplStageByName.get(stageName)
        stagesMap.set(stageName, {
          id: tplStage?.id || stageName,
          name: stageName,
          order_index: task.stage_order_index || 0,
          depends_on_stages: (tplStage?.depends_on_stages as string[]) || [],
          is_current: tplStage ? currentStageIds.includes(tplStage.id) : false,
          is_completed_explicit: tplStage ? completedStageIds.includes(tplStage.id) : false,
          tasks: [],
          tasks_completed: 0,
          tasks_total: 0,
        })
      }

      const stage = stagesMap.get(stageName)!
      stage.tasks.push(task)
      stage.tasks_total += 1

      if (task.status === 'completed' || task.status === 'skipped') {
        stage.tasks_completed += 1
      }
    })

    // Determinar status da fase
    const stages = Array.from(stagesMap.values()).map((stage) => {
      let status: 'completed' | 'in_progress' | 'pending' = 'pending'

      if (stage.is_completed_explicit) {
        status = 'completed'
      } else if (stage.tasks_completed === stage.tasks_total) {
        status = 'completed'
      } else if (stage.tasks_completed > 0 || stage.is_current) {
        status = 'in_progress'
      }

      return { ...stage, status }
    })

    // Obter proprietários
    const { data: owners, error: ownersError } = await supabase
      .from('property_owners')
      .select(
        `
        ownership_percentage,
        is_main_contact,
        owner_role_id,
        owner_role:owner_role_types(id, name, label, color),
        owner:owners(*)
      `
      )
      .eq('property_id', data.property?.id)

    // Buscar deal vinculado ao processo
    const { data: deal } = await supabase
      .from('deals')
      .select('*, deal_clients(*), deal_payments(*)')
      .eq('proc_instance_id', id)
      .maybeSingle()

    // Obter documentos do imóvel
    const docSelect = `
        id,
        doc_type_id,
        owner_id,
        deal_id,
        file_name,
        file_url,
        status,
        valid_until,
        created_at,
        uploaded_by,
        doc_type:doc_types(id, name, category)
      `

    const { data: propertyDocs } = await supabase
      .from('doc_registry')
      .select(docSelect)
      .eq('property_id', data.property?.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Obter documentos reutilizáveis dos proprietários (property_id IS NULL)
    const ownerIds = owners?.map((po: any) => po.owner?.id).filter(Boolean) ?? []
    let ownerDocs: typeof propertyDocs = []
    if (ownerIds.length > 0) {
      const { data: oDocs } = await supabase
        .from('doc_registry')
        .select(docSelect)
        .in('owner_id', ownerIds)
        .is('property_id', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      ownerDocs = oDocs ?? []
    }

    // Obter documentos do negócio (deal)
    let dealDocs: typeof propertyDocs = []
    if (deal?.id) {
      const { data: dDocs } = await supabase
        .from('doc_registry')
        .select(docSelect)
        .eq('deal_id', deal.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      dealDocs = dDocs ?? []
    }

    const documents = [...(propertyDocs ?? []), ...(ownerDocs ?? []), ...(dealDocs ?? [])]

    // Processar dados do imóvel — extrair cover, specs, internal
    if (data.property) {
      const prop = data.property as any
      // Cover image: is_cover=true ou a primeira por order_index
      const media = prop.dev_property_media as any[] | null
      if (media && media.length > 0) {
        const cover = media.find((m: any) => m.is_cover) || media.sort((a: any, b: any) => a.order_index - b.order_index)[0]
        prop.cover_url = cover?.url || null
      } else {
        prop.cover_url = null
      }
      prop.media = media || []
      delete prop.dev_property_media

      // Flatten specs (1:1)
      prop.specs = Array.isArray(prop.dev_property_specifications)
        ? prop.dev_property_specifications[0] || null
        : prop.dev_property_specifications || null
      delete prop.dev_property_specifications

      // Flatten internal (1:1)
      prop.internal = Array.isArray(prop.dev_property_internal)
        ? prop.dev_property_internal[0] || null
        : prop.dev_property_internal || null
      delete prop.dev_property_internal

      // Flatten consultant (dev_users + dev_consultant_profiles)
      if (prop.consultant) {
        const c = prop.consultant as any
        const profile = c.dev_consultant_profiles || {}
        prop.consultant = {
          id: c.id,
          commercial_name: c.commercial_name,
          professional_email: c.professional_email,
          is_active: c.is_active,
          phone_commercial: profile.phone_commercial || null,
          bio: profile.bio || null,
          specializations: profile.specializations || null,
          languages: profile.languages || null,
          instagram_handle: profile.instagram_handle || null,
          linkedin_url: profile.linkedin_url || null,
          profile_photo_url: profile.profile_photo_url || null,
        }
      }
    }

    const dealClients = deal?.deal_clients || []

    // Formatar resposta
    const response: any = {
      instance: data,
      stages: stages.sort((a, b) => a.order_index - b.order_index),
      owners: owners?.map((po: any) => ({
        ...po.owner,
        ownership_percentage: po.ownership_percentage,
        is_main_contact: po.is_main_contact,
        owner_role_id: po.owner_role_id,
        owner_role: po.owner_role || null,
      })) || [],
      documents: documents || [],
      deal: deal || null,
    }

    // Adicionar dados do negócio se existirem
    if (deal) {
      response.deal = deal
      response.deal_clients = dealClients
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao obter processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
