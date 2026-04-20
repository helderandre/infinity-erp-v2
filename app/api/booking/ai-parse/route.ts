import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

const ruleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

const SYSTEM_PROMPT = `És um assistente que extrai horários semanais de disponibilidade a partir de texto livre em Português de Portugal.

Retorna APENAS um JSON com a forma: {"rules": [...]}

Cada regra tem:
- day_of_week (number): 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
- start_time (string): formato HH:MM em 24h
- end_time (string): formato HH:MM em 24h, tem de ser depois de start_time

Regras importantes:
- Podes ter MÚLTIPLAS rows por dia (ex: manhã + tarde com pausa de almoço)
- Só inclui dias explicitamente mencionados; se não foi mencionado, não aparece
- "dias úteis" ou "semana" = Seg a Sex (1-5)
- "fim-de-semana" = Sábado e Domingo (6 e 0)
- "manhã" típica = 09:00-13:00; "tarde" = 14:00-18:00 (usa estes defaults se não especificado)
- Se o utilizador disser algo tipo "9-18 com pausa 13-14", cria 2 rows por dia: 09:00-13:00 + 14:00-18:00
- Usa horários realistas (típica abertura 08:00-20:00)

Exemplos:

Input: "Segunda a Sexta das 9 às 18, pausa para almoço das 13 às 14"
Output: {"rules": [
  {"day_of_week": 1, "start_time": "09:00", "end_time": "13:00"},
  {"day_of_week": 1, "start_time": "14:00", "end_time": "18:00"},
  {"day_of_week": 2, "start_time": "09:00", "end_time": "13:00"},
  {"day_of_week": 2, "start_time": "14:00", "end_time": "18:00"},
  {"day_of_week": 3, "start_time": "09:00", "end_time": "13:00"},
  {"day_of_week": 3, "start_time": "14:00", "end_time": "18:00"},
  {"day_of_week": 4, "start_time": "09:00", "end_time": "13:00"},
  {"day_of_week": 4, "start_time": "14:00", "end_time": "18:00"},
  {"day_of_week": 5, "start_time": "09:00", "end_time": "13:00"},
  {"day_of_week": 5, "start_time": "14:00", "end_time": "18:00"}
]}

Input: "Seg a qua 10 às 17, sábado de manhã"
Output: {"rules": [
  {"day_of_week": 1, "start_time": "10:00", "end_time": "17:00"},
  {"day_of_week": 2, "start_time": "10:00", "end_time": "17:00"},
  {"day_of_week": 3, "start_time": "10:00", "end_time": "17:00"},
  {"day_of_week": 6, "start_time": "09:00", "end_time": "13:00"}
]}

Input: "só fins-de-semana"
Output: {"rules": [
  {"day_of_week": 6, "start_time": "09:00", "end_time": "18:00"},
  {"day_of_week": 0, "start_time": "09:00", "end_time": "18:00"}
]}`

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

    const body = await request.json().catch(() => null) as { text?: string } | null
    const text = body?.text?.trim()
    if (!text || typeof text !== 'string' || text.length < 2) {
      return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'Texto demasiado longo (máx 500 caracteres)' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Resposta da IA não é JSON válido' }, { status: 502 })
    }

    const shape = z.object({ rules: z.array(ruleSchema) })
    const validation = shape.safeParse(parsed)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'A IA devolveu regras inválidas', details: validation.error.flatten() },
        { status: 502 }
      )
    }

    // Additional sanity: end_time > start_time
    const validRules = validation.data.rules.filter((r) => r.end_time > r.start_time)

    return NextResponse.json({ rules: validRules })
  } catch (error) {
    console.error('[booking/ai-parse]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
