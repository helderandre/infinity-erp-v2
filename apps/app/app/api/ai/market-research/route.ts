import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const schema = z.object({
  query: z.string().min(3, 'Pergunta demasiado curta').max(500),
  context: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('properties') as any
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { query, context } = validation.data

    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'PERPLEXITY_API_KEY não configurada' },
        { status: 500 }
      )
    }

    const systemPrompt = `És um assistente de pesquisa de mercado imobiliário para uma imobiliária portuguesa (Infinity Group).
Responde sempre em Português de Portugal (PT-PT).
Foca-te no mercado imobiliário português: preços, tendências, zonas, comparações.
Sê conciso e directo nas respostas. Usa dados concretos quando disponíveis.
${context ? `\nContexto adicional: ${context}` : ''}`

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        return_citations: true,
      }),
    })

    if (!response.ok) {
      const errData = await response.text()
      console.error('Perplexity API error:', errData)
      return NextResponse.json(
        { error: 'Erro na pesquisa de mercado' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const citations = data.citations || []

    return NextResponse.json({
      answer: content,
      citations,
    })
  } catch (error) {
    console.error('Erro na pesquisa de mercado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
