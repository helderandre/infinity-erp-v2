import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Serviço de IA não configurado' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await params
    const body = await request.json()
    const { current_description, instruction } = body

    if (!current_description || !instruction) {
      return new Response(JSON.stringify({ error: 'Descrição e instrução são obrigatórias' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const openai = new OpenAI({ apiKey })

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      temperature: 0.7,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: `És um editor de descrições de imóveis para portais imobiliários em Portugal.

Recebes a descrição actual e uma instrução do consultor sobre o que alterar.

REGRAS:
- Aplica APENAS as alterações pedidas, mantendo o resto da descrição intacto.
- Mantém a mesma formatação: texto plano com **negrito** e bullet points "- " ou "* ".
- NÃO uses markdown headings (###, ##, #).
- Responde APENAS com a descrição editada, sem explicações ou comentários.
- Se a instrução pedir para adicionar informação que não tens, avisa no início com uma nota breve entre parênteses e faz o melhor possível.`,
        },
        {
          role: 'user',
          content: `Descrição actual:\n\n${current_description}\n\nInstrução: ${instruction}`,
        },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Erro ao refinar descrição:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
