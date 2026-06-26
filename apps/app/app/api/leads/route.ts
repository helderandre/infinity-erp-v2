import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { createLeadSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactLead, shouldRedactLead } from '@/lib/auth/redact-lead'
import { sendPushToUser } from '@/lib/crm/send-push'
import type { Database } from '@/types/database'

type LeadInsert = Database['public']['Tables']['leads']['Insert']

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const nome = searchParams.get('nome')
    const estado = searchParams.get('estado')
    const temperatura = searchParams.get('temperatura')
    const origem = searchParams.get('origem')
    const agentParam = searchParams.get('agent_id')
    // Gestão pode filtrar por qualquer agent; restantes ficam scoped ao
    // próprio (vê apenas contactos de que é o `agent_id`).
    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll ? agentParam : auth.user.id
    const qualified_only = searchParams.get('qualified_only') === 'true'
    const unqualified_only = searchParams.get('unqualified_only') === 'true'
    // Filtro pela data de chegada do contacto (created_at). `date_to` é
    // inclusivo do dia inteiro (até às 23:59:59.999).
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const qualifTiposCsv = searchParams.get('qualif_tipos') || ''
    const qualifTipos = qualifTiposCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10) // safety cap
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Number(searchParams.get('offset')) || 0

    // Ordenação. Por defeito por data de chegada (mais recentes primeiro);
    // também permite ordenação alfabética pelo nome. Valores fora do mapa
    // caem no default.
    const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
      date_desc: { column: 'created_at', ascending: false },
      date_asc: { column: 'created_at', ascending: true },
      name_asc: { column: 'nome', ascending: true },
      name_desc: { column: 'nome', ascending: false },
    }
    const sort = SORT_MAP[searchParams.get('sort') || ''] ?? SORT_MAP.date_desc

    // When qualified_only is true, use inner join to only return contacts with negocios
    // FK hint required: negocio_contacts makes leads↔negocios ambiguous, so the
    // direct FK (negocios_lead_id_fkey) must be named. `!inner` is a join modifier,
    // not a disambiguator, and stacks after the hint.
    const negociosJoin = qualified_only
      ? 'negocios!negocios_lead_id_fkey!inner(id, tipo)'
      : 'negocios!negocios_lead_id_fkey(id, tipo)'

    let query = supabase
      .from('leads')
      .select(`*, agent:dev_users!agent_id(id, commercial_name), ${negociosJoin}`, { count: 'exact' })
      .order(sort.column, { ascending: sort.ascending })
      .range(offset, offset + limit - 1)

    // Esconde contactos soft-deleted pelo consultor (lista de contactos do ERP;
    // o portal de parceiros não usa este endpoint). Ver consultor_hidden_at.
    query = query.is('consultor_hidden_at', null)

    if (nome) {
      // Pesquisa por nome, email ou telefone. Sanitiza vírgulas/parênteses
      // que quebrariam a sintaxe do `.or()` do PostgREST.
      const term = nome.replace(/[(),]/g, ' ').trim()
      if (term) {
        query = query.or(
          `nome.ilike.%${term}%,email.ilike.%${term}%,telemovel.ilike.%${term}%,telefone.ilike.%${term}%`,
        )
      }
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (temperatura) {
      query = query.eq('temperatura', temperatura)
    }
    if (origem) {
      query = query.eq('origem', origem)
    }
    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }
    if (date_from) {
      query = query.gte('created_at', date_from)
    }
    if (date_to) {
      // Inclui o dia inteiro de `date_to` (formato YYYY-MM-DD → fim do dia).
      const end = /^\d{4}-\d{2}-\d{2}$/.test(date_to) ? `${date_to}T23:59:59.999` : date_to
      query = query.lte('created_at', end)
    }

    // Filtrar por qualificação (tipo do negocio associado): pre-fetch dos
    // lead_ids que têm pelo menos um negocio com esses tipos, depois `.in()`
    // sobre `leads.id`. Mais simples e correcto que tentar filtrar via
    // PostgREST nested (que filtra a embedded array, não as parent rows).
    if (qualifTipos.length > 0) {
      const { data: negs } = await supabase
        .from('negocios')
        .select('lead_id')
        .in('tipo', qualifTipos)
      const leadIds = Array.from(
        new Set(((negs as Array<{ lead_id: string | null }> | null) ?? [])
          .map((n) => n.lead_id)
          .filter((id): id is string => !!id)),
      )
      if (leadIds.length === 0) {
        return NextResponse.json({ data: [], total: 0 })
      }
      query = query.in('id', leadIds)
    }

    // "Por qualificar" — exclui contactos que tenham qualquer negócio. O
    // `qualified_only` (inner join) já cobre o oposto. Mutuamente exclusivos
    // — se ambos vierem true, `qualified_only` ganha (vai sobrepor o filtro
    // negativo via inner join, que devolve só rows com negócio).
    if (unqualified_only && !qualified_only) {
      const { data: negs } = await supabase
        .from('negocios')
        .select('lead_id')
      const leadIdsWithNeg = Array.from(
        new Set(((negs as Array<{ lead_id: string | null }> | null) ?? [])
          .map((n) => n.lead_id)
          .filter((id): id is string => !!id)),
      )
      if (leadIdsWithNeg.length > 0) {
        query = query.not('id', 'in', `(${leadIdsWithNeg.join(',')})`)
      }
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const redactedRows = canSeeAll
      ? rows.map((row: Record<string, unknown>) =>
          shouldRedactLead(auth.roles, row.agent_id as string | null | undefined, auth.user.id)
            ? redactLead(row)
            : row,
        )
      : rows

    return NextResponse.json({ data: redactedRows, total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar leads:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createLeadSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Construir objecto de insert com tipos correctos
    const insertData: LeadInsert = {
      nome: data.nome.trim(),
    }

    if (data.email) insertData.email = data.email.trim()
    if (data.telefone) insertData.telefone = data.telefone.trim()
    if (data.telemovel) insertData.telemovel = data.telemovel.trim()
    if (data.origem) insertData.origem = data.origem
    if (data.agent_id) insertData.agent_id = data.agent_id
    insertData.estado = data.estado || 'Lead'
    if (data.lead_type) (insertData as any).lead_type = data.lead_type

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('Erro ao criar lead:', error)
      // Unique violation (23505) — o índice `leads_email_unique` impede
      // duplicados de email. Apresentamos uma mensagem clara em vez de
      // 500 genérico para o consultor perceber o que aconteceu.
      if ((error as { code?: string }).code === '23505') {
        const isEmailDup = /email/i.test(error.message || '')
        return NextResponse.json(
          {
            error: isEmailDup
              ? 'Já existe um contacto com este email.'
              : 'Já existe um contacto com estes dados.',
            details: error.message,
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Erro ao criar lead', details: error.message },
        { status: 500 }
      )
    }

    // Observações escritas na criação entram directamente no histórico
    // (leads_activities, type='note') em vez do campo legacy
    // `leads.observacoes` — assim aparecem logo nas tabs Notas e Histórico
    // sem precisar da migração manual "Mover para o histórico".
    if (data.observacoes?.trim()) {
      const { error: noteErr } = await (supabase as any)
        .from('leads_activities')
        .insert({
          contact_id: lead.id,
          activity_type: 'note',
          subject: 'Observação inicial',
          description: data.observacoes.trim(),
          created_by: auth.user.id,
        })
      if (noteErr) {
        // Nunca perder o texto — fallback para o campo legacy (fica visível
        // no banner "Observação antiga" com migração manual).
        console.error('Erro ao criar nota inicial, fallback para observacoes:', noteErr.message)
        await supabase.from('leads').update({ observacoes: data.observacoes }).eq('id', lead.id)
      }
    }

    // Notify assigned agent if it's a different person
    if (data.agent_id && data.agent_id !== auth.user.id) {
      const db = createCrmAdminClient()
      const link = `/dashboard/leads/${lead.id}`
      const title = 'Nova lead atribuída'
      const body = `${data.nome} foi-lhe atribuída.`
      let notifId: string | null = null
      try {
        const { data: notif } = await db.from('leads_notifications').insert({
          recipient_id: data.agent_id,
          type: 'new_lead',
          title,
          body,
          link,
          contact_id: lead.id,
        }).select('id').single()
        notifId = (notif as { id?: string } | null)?.id ?? null
      } catch {
        // in-app feed insert is best-effort
      }

      // Push imediato (fast path). O cron `dispatch-pending-push` é o fallback
      // durável: re-envia enquanto is_push_sent=false. Marcamos true só APÓS o
      // envio para preservar essa rede de segurança.
      try {
        const adminPush = createAdminClient()
        await sendPushToUser(adminPush, data.agent_id, {
          title,
          body,
          url: link,
          tag: `new_lead:${lead.id}`,
        })
        if (notifId) {
          await db.from('leads_notifications').update({ is_push_sent: true }).eq('id', notifId)
        }
      } catch (err) {
        console.error('[leads POST] push:', err)
      }
    }

    return NextResponse.json({ id: lead.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
