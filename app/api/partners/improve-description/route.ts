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

    const body = await request.json()
    const { text, name, category, specialties, service_areas, city } = body

    const openai = new OpenAI({ apiKey })

    const contextParts: string[] = []
    if (name) contextParts.push(`Nome: ${name}`)
    if (category) contextParts.push(`Categoria: ${category}`)
    if (Array.isArray(specialties) && specialties.length > 0) contextParts.push(`Especialidades: ${specialties.join(', ')}`)
    if (Array.isArray(service_areas) && service_areas.length > 0) contextParts.push(`Zonas de actuação: ${service_areas.join(', ')}`)
    if (city) contextParts.push(`Cidade: ${city}`)
    const contextStr = contextParts.length > 0 ? `\n\nContexto do parceiro:\n${contextParts.join('\n')}` : ''

    const hasText = typeof text === 'string' && text.trim().length > 0

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `És um assistente de escrita profissional para uma imobiliária portuguesa (Infinity Group).
${hasText ? 'Melhora o texto fornecido para uma descrição de parceiro/fornecedor.' : 'Gera uma descrição curta e profissional para este parceiro/fornecedor.'}
Regras:
- 2 a 4 parágrafos curtos, no máximo
- Usa Português de Portugal (PT-PT)
- Tom profissional, claro e acessível
- Usa o contexto fornecido para enriquecer o texto — NÃO inventes serviços ou credenciais que não estejam listados
- Sem markdown. Usa apenas texto simples, separado por quebras de linha (\\n\\n entre parágrafos)
- Responde APENAS com a descrição, sem comentários nem cabeçalhos`,
        },
        {
          role: 'user',
          content: hasText
            ? `${text}${contextStr}`
            : `Gera uma descrição para este parceiro.${contextStr}`,
        },
      ],
    })

    const improved = completion.choices[0]?.message?.content?.trim() ?? (hasText ? text : '')

    return NextResponse.json({ text: improved })
  } catch (error) {
    console.error('[partners/improve-description]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
