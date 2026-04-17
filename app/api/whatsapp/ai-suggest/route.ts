import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { messages, draft, contactLeadId, action } = body
    // messages: last N messages for context [{text, from_me, sender_name}]
    // draft: optional draft text the agent has written
    // contactLeadId: optional lead id for CRM context
    // action: 'suggest' | 'rephrase' | 'translate'

    if (!messages?.length && !draft) {
      return NextResponse.json({ error: 'Sem contexto para sugerir resposta' }, { status: 400 })
    }

    // Build CRM context if lead is linked
    let crmContext = ''
    if (contactLeadId) {
      const { data: lead } = await (supabase as any)
        .from('leads')
        .select('nome, email, telemovel, lead_type, estado, temperatura, observacoes')
        .eq('id', contactLeadId)
        .single()

      if (lead) {
        crmContext += `\n\nContexto CRM do contacto:\n- Nome: ${lead.nome}\n- Tipo: ${lead.lead_type || 'desconhecido'}\n- Estado: ${lead.estado || 'novo'}\n- Temperatura: ${lead.temperatura || 'desconhecida'}`
        if (lead.observacoes) crmContext += `\n- Notas: ${lead.observacoes}`
      }

      // Get active negócios for this lead
      const { data: negocios } = await (supabase as any)
        .from('negocios')
        .select('tipo, estado, localizacao, orcamento, tipo_imovel, tipologia')
        .eq('lead_id', contactLeadId)
        .in('estado', ['em_curso', 'novo', 'qualificado', 'proposta', 'negociacao'])
        .limit(5)

      if (negocios?.length) {
        crmContext += `\n\nNegócios activos (${negocios.length}):`
        for (const n of negocios) {
          crmContext += `\n- ${n.tipo || 'Tipo desconhecido'}: ${n.tipo_imovel || ''} ${n.tipologia || ''} em ${n.localizacao || 'localização não definida'}, orçamento ${n.orcamento ? `${n.orcamento}€` : 'não definido'}`
        }
      }
    }

    // Build conversation history for context (last 20 messages)
    const conversationContext = messages
      .slice(-20)
      .map((m: any) => `${m.from_me ? 'Agente' : (m.sender_name || 'Contacto')}: ${m.text}`)
      .join('\n')

    const FORMAT_RULES = `\n\nREGRAS DE FORMATO (obrigatórias):
- Devolve APENAS o texto final, sem explicações, prefácios ou meta-comentários.
- NÃO envolvas a resposta em aspas (") nem em parênteses rectos ([]) nem em chavetas ({}).
- NÃO uses markdown (sem **, sem _, sem \`).
- NÃO prefixes com "Agente:", "Resposta:", "Sugestão:" ou similares.
- Escreve como se fosses enviar directamente no WhatsApp.`

    let systemPrompt = ''
    let userPrompt = ''

    if (action === 'rephrase' && draft) {
      systemPrompt = `És um assistente de comunicação para consultores imobiliários em Portugal. Reformulas mensagens para soarem mais profissionais, claras e cordiais, mantendo o mesmo idioma. Sê conciso — é WhatsApp, não email.${crmContext}${FORMAT_RULES}`
      userPrompt = `Conversa recente (para contexto):\n${conversationContext}\n\nReformula a seguinte mensagem do agente:\n\n${draft}`
    } else if (action === 'translate') {
      systemPrompt = `És um tradutor. Se o texto está em português, traduz para inglês; caso contrário, traduz para português de Portugal. Mantém o tom informal de WhatsApp.${FORMAT_RULES}`
      userPrompt = `Traduz:\n\n${draft}`
    } else {
      // suggest
      systemPrompt = `És um assistente de comunicação para consultores imobiliários em Portugal. Com base na conversa, sugere uma resposta profissional e cordial. Responde no MESMO idioma que o contacto está a usar. Sê conciso — é WhatsApp, não email.${crmContext}${FORMAT_RULES}`
      userPrompt = `Conversa recente (Agente = consultor, Contacto = cliente):\n${conversationContext}${draft ? `\n\nO agente começou a escrever:\n${draft}\n\nCompleta ou melhora esta resposta.` : '\n\nSugere uma resposta apropriada para o agente enviar a seguir.'}`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    let suggestion = completion.choices[0]?.message?.content?.trim() || ''

    // Strip wrapping quotes/brackets that the model sometimes adds despite instructions
    const WRAPPERS: Array<[string, string]> = [['"', '"'], ["'", "'"], ['[', ']'], ['(', ')'], ['{', '}'], ['«', '»'], ['"', '"'], ["'", "'"]]
    for (let i = 0; i < 3; i++) {
      for (const [open, close] of WRAPPERS) {
        if (suggestion.startsWith(open) && suggestion.endsWith(close) && suggestion.length > 1) {
          suggestion = suggestion.slice(open.length, suggestion.length - close.length).trim()
        }
      }
    }
    // Also strip common prefixes the model may still add
    suggestion = suggestion.replace(/^(Agente|Resposta|Sugestão|Reformulado|Tradução)\s*:\s*/i, '').trim()

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[ai-suggest]', err)
    return NextResponse.json({ error: 'Erro ao gerar sugestão' }, { status: 500 })
  }
}
