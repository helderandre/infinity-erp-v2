import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { text, title, start_date, end_date, location, category } = await request.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    // Build context from event data
    const contextParts: string[] = []
    if (title) contextParts.push(`Título: ${title}`)
    if (start_date) contextParts.push(`Data/hora início: ${start_date}`)
    if (end_date) contextParts.push(`Data/hora fim: ${end_date}`)
    if (location) contextParts.push(`Local: ${location}`)
    if (category) contextParts.push(`Categoria: ${category}`)
    const contextStr = contextParts.length > 0 ? `\n\nContexto do evento:\n${contextParts.join('\n')}` : ''

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `És um assistente de escrita profissional para uma imobiliária portuguesa (Infinity Group).
Melhora o texto fornecido para uma descrição de evento/reunião no calendário da empresa.
Regras:
- Mantém o mesmo significado e informação
- Usa Português de Portugal (PT-PT)
- Estrutura bem o texto com parágrafos curtos
- Torna-o mais claro, profissional e bem formatado
- Se tiver tópicos, usa bullets com tags HTML (<ul><li>)
- Usa a data, hora e local do contexto do evento para enriquecer o texto se fizer sentido (ex: "Reunião marcada para dia X às Yh no Z")
- Não inventes informação que não esteja no texto ou no contexto
- Responde em HTML simples (p, strong, em, ul, li, ol) — sem markdown
- Responde APENAS com o texto melhorado, sem comentários`,
        },
        {
          role: 'user',
          content: `${text}${contextStr}`,
        },
      ],
    })

    const improved = completion.choices[0]?.message?.content?.trim() ?? text

    return NextResponse.json({ text: improved })
  } catch (error) {
    console.error('Erro ao melhorar texto:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
