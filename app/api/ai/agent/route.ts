import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Tool Definitions ────────────────────────────────────────────────────────

const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_leads',
      description: 'Pesquisar ou contar leads/contactos no CRM. Pode filtrar por nome, estado, origem, agente, ou obter contagens.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Pesquisar por nome, email ou telefone' },
          estado: { type: 'string', description: 'Filtrar por estado: new, contacted, qualified, archived' },
          agent_id: { type: 'string', description: 'UUID do agente atribuído' },
          count_only: { type: 'boolean', description: 'Se true, retorna apenas a contagem' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_properties',
      description: 'Pesquisar imóveis. Pode filtrar por cidade, tipo, preço, estado, ou obter contagens.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Pesquisar por título ou referência' },
          city: { type: 'string', description: 'Filtrar por cidade' },
          status: { type: 'string', description: 'Filtrar por estado: active, pending_approval, sold, rented, suspended' },
          property_type: { type: 'string', description: 'Tipo de imóvel' },
          business_type: { type: 'string', description: 'Tipo de negócio: venda, arrendamento' },
          min_price: { type: 'number', description: 'Preço mínimo' },
          max_price: { type: 'number', description: 'Preço máximo' },
          bedrooms: { type: 'number', description: 'Número de quartos (T1=1, T2=2, T3=3, etc.)' },
          count_only: { type: 'boolean', description: 'Se true, retorna apenas a contagem' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_tasks',
      description: 'Pesquisar tarefas do utilizador. Pode filtrar por estado, prioridade, ou datas.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por estado: pending, in_progress, completed, cancelled' },
          priority: { type: 'string', description: 'Filtrar por prioridade: low, medium, high, urgent' },
          due_today: { type: 'boolean', description: 'Apenas tarefas com prazo hoje' },
          overdue: { type: 'boolean', description: 'Apenas tarefas atrasadas' },
          count_only: { type: 'boolean', description: 'Se true, retorna apenas a contagem' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_calendar',
      description: 'Pesquisar eventos do calendário. Pode filtrar por data, categoria, ou período.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data específica (YYYY-MM-DD)' },
          from: { type: 'string', description: 'Data início do período (YYYY-MM-DD)' },
          to: { type: 'string', description: 'Data fim do período (YYYY-MM-DD)' },
          category: { type: 'string', description: 'Categoria do evento' },
          count_only: { type: 'boolean', description: 'Se true, retorna apenas a contagem' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_kpis',
      description: 'Obter KPIs e estatísticas gerais do sistema: total de imóveis, leads, processos, tarefas pendentes, etc.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Período: today, week, month, all (default: all)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Pesquisa global por nome, email ou telefone através de leads, proprietários e consultores.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto de pesquisa (nome, email ou telefone)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_processes',
      description: 'Pesquisar processos/instâncias. Pode filtrar por estado ou referência.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Estado: draft, pending_approval, approved, in_progress, completed, rejected, on_hold' },
          reference: { type: 'string', description: 'Referência do processo (ex: PROC-2026-0001)' },
          count_only: { type: 'boolean', description: 'Se true, retorna apenas a contagem' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
  },
]

// ── Tool Execution ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, args: Record<string, any>, supabase: any, userId: string): Promise<string> {
  try {
    switch (name) {
      case 'query_leads': {
        let query = supabase
          .from('leads')
          .select('id, nome, email, telemovel, estado, origem, created_at, agent:dev_users(commercial_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(args.count_only ? 0 : (args.limit || 10))

        if (args.search) query = query.ilike('nome', `%${args.search}%`)
        if (args.estado) query = query.eq('estado', args.estado)
        if (args.agent_id) query = query.eq('agent_id', args.agent_id)

        const { data, count, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        if (args.count_only) return JSON.stringify({ total: count })
        return JSON.stringify({ leads: data, total: count })
      }

      case 'query_properties': {
        // When filtering by bedrooms, fetch more since we post-filter
        const needsPostFilter = !!args.bedrooms
        const fetchLimit = needsPostFilter ? 500 : (args.count_only ? 0 : (args.limit || 10))

        let query = supabase
          .from('dev_properties')
          .select('id, title, slug, listing_price, property_type, business_type, status, city, zone, external_ref, consultant:dev_users(commercial_name), specs:dev_property_specifications(bedrooms, bathrooms, area_gross, area_util, typology, construction_year, parking_spaces)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(fetchLimit)

        if (args.search) query = query.or(`title.ilike.%${args.search}%,external_ref.ilike.%${args.search}%`)
        if (args.city) query = query.ilike('city', `%${args.city}%`)
        if (args.status) query = query.eq('status', args.status)
        if (args.property_type) query = query.ilike('property_type', `%${args.property_type}%`)
        if (args.business_type) query = query.eq('business_type', args.business_type)
        if (args.min_price) query = query.gte('listing_price', args.min_price)
        if (args.max_price) query = query.lte('listing_price', args.max_price)

        let { data, count, error } = await query
        if (error) {
          console.error('[agent] query_properties error:', error.message)
          return JSON.stringify({ error: error.message })
        }

        console.log(`[agent] query_properties: ${count} total, ${data?.length} fetched, bedrooms filter: ${args.bedrooms}`)

        // Post-filter by bedrooms (specs is a joined 1:1 table)
        if (args.bedrooms && data) {
          data = data.filter((p: any) => {
            const beds = p.specs?.bedrooms
            return beds === args.bedrooms
          })
          count = data.length
        }

        // Trim to requested limit after filtering
        if (needsPostFilter && !args.count_only) {
          data = data?.slice(0, args.limit || 10)
        }

        if (args.count_only) return JSON.stringify({ total: count })
        return JSON.stringify({ properties: data, total: count })
      }

      case 'query_tasks': {
        let query = supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, created_at, assigned:dev_users!tasks_assigned_to_fkey(commercial_name)', { count: 'exact' })
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(args.count_only ? 0 : (args.limit || 10))

        if (args.status) query = query.eq('status', args.status)
        if (args.priority) query = query.eq('priority', args.priority)
        if (args.due_today) {
          const today = new Date().toISOString().split('T')[0]
          query = query.gte('due_date', `${today}T00:00:00`).lte('due_date', `${today}T23:59:59`)
        }
        if (args.overdue) {
          query = query.lt('due_date', new Date().toISOString()).neq('status', 'completed').neq('status', 'cancelled')
        }

        const { data, count, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        if (args.count_only) return JSON.stringify({ total: count })
        return JSON.stringify({ tasks: data, total: count })
      }

      case 'query_calendar': {
        const from = args.date || args.from || new Date().toISOString().split('T')[0]
        const to = args.date
          ? `${args.date}T23:59:59`
          : args.to
            ? `${args.to}T23:59:59`
            : `${from}T23:59:59`

        let query = supabase
          .from('calendar_events')
          .select('id, title, description, start_time, end_time, category, location', { count: 'exact' })
          .gte('start_time', `${from}T00:00:00`)
          .lte('start_time', to)
          .order('start_time', { ascending: true })
          .limit(args.count_only ? 0 : (args.limit || 10))

        if (args.category) query = query.eq('category', args.category)

        const { data, count, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        if (args.count_only) return JSON.stringify({ total: count })
        return JSON.stringify({ events: data, total: count })
      }

      case 'get_kpis': {
        const results: Record<string, number | null> = {}

        // Total properties
        const { count: propCount } = await supabase
          .from('dev_properties').select('id', { count: 'exact', head: true })
        results.total_imoveis = propCount

        // Active properties
        const { count: activePropCount } = await supabase
          .from('dev_properties').select('id', { count: 'exact', head: true }).eq('status', 'active')
        results.imoveis_activos = activePropCount

        // Total leads
        const { count: leadCount } = await supabase
          .from('leads').select('id', { count: 'exact', head: true })
        results.total_leads = leadCount

        // New leads (this week)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const { count: newLeadCount } = await supabase
          .from('leads').select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString())
        results.leads_esta_semana = newLeadCount

        // Pending tasks
        const { count: pendingTasks } = await supabase
          .from('tasks').select('id', { count: 'exact', head: true })
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
          .in('status', ['pending', 'in_progress'])
        results.tarefas_pendentes = pendingTasks

        // Active processes
        const { count: procCount } = await supabase
          .from('proc_instances').select('id', { count: 'exact', head: true })
          .in('current_status', ['approved', 'in_progress'])
        results.processos_activos = procCount

        return JSON.stringify(results)
      }

      case 'search_contacts': {
        const q = args.query
        const [leads, owners, consultants] = await Promise.all([
          supabase.from('leads').select('id, nome, email, telemovel')
            .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telemovel.ilike.%${q}%`)
            .limit(5),
          supabase.from('owners').select('id, name, email, phone, nif')
            .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,nif.ilike.%${q}%`)
            .limit(5),
          supabase.from('dev_users').select('id, commercial_name, professional_email')
            .or(`commercial_name.ilike.%${q}%,professional_email.ilike.%${q}%`)
            .limit(5),
        ])

        return JSON.stringify({
          leads: leads.data || [],
          proprietarios: owners.data || [],
          consultores: consultants.data || [],
        })
      }

      case 'query_processes': {
        let query = supabase
          .from('proc_instances')
          .select('id, external_ref, current_status, percent_complete, started_at, property:dev_properties(title)', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(args.count_only ? 0 : (args.limit || 10))

        if (args.status) query = query.eq('current_status', args.status)
        if (args.reference) query = query.ilike('external_ref', `%${args.reference}%`)

        const { data, count, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        if (args.count_only) return JSON.stringify({ total: count })
        return JSON.stringify({ processes: data, total: count })
      }

      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao executar ferramenta' })
  }
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('dashboard') as any
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const adminDb = createCrmAdminClient()
    const { messages: clientMessages } = await request.json()

    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      return NextResponse.json({ error: 'Mensagens são obrigatórias' }, { status: 400 })
    }

    // Get user info for context
    const { data: user } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', auth.user.id)
      .single()

    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content: `És o assistente IA do ERP Infinity Group, uma imobiliária portuguesa.
O utilizador actual é: ${user?.commercial_name || 'Consultor'} (ID: ${auth.user.id}).
A data actual é: ${new Date().toLocaleDateString('pt-PT')}.

Respondes sempre em Português de Portugal (PT-PT).
Usas as ferramentas disponíveis para consultar dados reais do sistema.
Sê conciso e directo nas respostas.
Quando mostras listas, formata-as de forma legível.
Para valores monetários, usa o formato €X.XXX.
Quando referires um imóvel, lead ou processo, indica o nome/referência para fácil identificação.
Se não conseguires encontrar dados, diz isso claramente.
NÃO inventes dados — usa sempre as ferramentas para consultar informação real.`,
    }

    const messages: ChatCompletionMessageParam[] = [
      systemMessage,
      ...clientMessages.slice(-20), // limit context window
    ]

    // Run the agent loop (max 5 iterations for tool calls)
    let iterations = 0
    const maxIterations = 5
    // Collect structured data from tool calls to return alongside the message
    const toolResults: Array<{ tool: string; data: unknown }> = []

    while (iterations < maxIterations) {
      iterations++

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1024,
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message

      messages.push(assistantMessage)

      // If no tool calls, we have the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return NextResponse.json({
          message: assistantMessage.content || '',
          role: 'assistant',
          data: toolResults.length > 0 ? toolResults : undefined,
        })
      }

      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const fn = (toolCall as any).function
        const args = JSON.parse(fn.arguments)
        const result = await executeTool(fn.name, args, adminDb, auth.user.id)

        // Store structured data
        try {
          const parsed = JSON.parse(result)
          toolResults.push({ tool: fn.name, data: parsed })
        } catch { /* ignore parse errors */ }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }
    }

    // If we hit max iterations, return last assistant message
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
    return NextResponse.json({
      message: (lastAssistant as { content?: string })?.content || 'Desculpe, não consegui completar a pesquisa.',
      role: 'assistant',
      data: toolResults.length > 0 ? toolResults : undefined,
    })
  } catch (error) {
    console.error('Agent error:', error)
    return NextResponse.json(
      { error: 'Erro interno do agente' },
      { status: 500 }
    )
  }
}
