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
    const { text, categories } = body as {
      text?: string
      categories?: { id: string; name: string }[]
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const categoriesBlock =
      categories && categories.length > 0
        ? `\nCategorias disponíveis (usa o id exacto quando o texto referir uma categoria):\n${categories
            .map((c) => `- ${c.name} (id: ${c.id})`)
            .join('\n')}\n`
        : '\nSem categorias — "category_id" deve ser null.\n'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente que extrai dados estruturados para criar um curso de formação a partir de texto livre em Português de Portugal.
${categoriesBlock}
Extrai (retorna JSON, null para campos não mencionados):
{
  "title": "string — título da formação",
  "summary": "string ou null — resumo curto (até 300 caracteres)",
  "description": "string ou null — descrição detalhada",
  "category_id": "string ou null — id da categoria da lista",
  "difficulty_level": "beginner|intermediate|advanced — nível de dificuldade",
  "instructor_name": "string ou null — nome do formador",
  "estimated_duration_minutes": "number ou null — duração estimada em minutos",
  "passing_score": "number 0-100 — nota mínima para aprovação (default 70)",
  "is_mandatory": "boolean — true se obrigatória",
  "has_certificate": "boolean — true se emite certificado"
}

Regras:
- "iniciante"/"básico" → beginner
- "intermédio" → intermediate; "avançado"/"expert" → advanced
- "obrigatório"/"obrigatória para toda a equipa" → is_mandatory=true
- "certificado"/"diploma" → has_certificate=true
- "3 horas" → 180; "90 minutos" → 90; "1h30" → 90
- Nota mínima: "70%" → 70; se não menciona deixa null (default 70)
- Faz fuzzy match de nomes de categoria
- Responde APENAS com o JSON`,
        },
        { role: 'user', content: text },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Falha ao interpretar resposta da IA' }, { status: 500 })
    }

    const allowedCategoryIds = new Set((categories ?? []).map((c) => c.id))
    if (
      typeof extracted.category_id === 'string' &&
      !allowedCategoryIds.has(extracted.category_id)
    ) {
      extracted.category_id = null
    }

    if (
      typeof extracted.difficulty_level === 'string' &&
      !['beginner', 'intermediate', 'advanced'].includes(extracted.difficulty_level)
    ) {
      extracted.difficulty_level = null
    }

    if (typeof extracted.passing_score === 'number') {
      if (extracted.passing_score < 0 || extracted.passing_score > 100) {
        extracted.passing_score = null
      }
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      result[key] = value
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao extrair dados da formação:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
