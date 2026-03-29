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

    const { text } = await request.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const now = new Date().toISOString()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente que extrai dados estruturados para criar eventos de calendário a partir de texto livre em Português de Portugal.

A data/hora actual é: ${now}

Extrai os seguintes campos (retorna JSON). Usa null para campos não mencionados:
{
  "title": "string ou null — título do evento",
  "description": "string ou null — descrição em HTML simples (p, strong, ul, li)",
  "category": "birthday|vacation|company_event|marketing_event|meeting|reminder|custom ou null",
  "item_type": "event|task — 'task' se for uma tarefa/to-do, 'event' se for um evento com hora",
  "start_date": "ISO 8601 string ou null — data e hora de início",
  "end_date": "ISO 8601 string ou null — data e hora de fim",
  "all_day": "boolean — true se for evento de dia inteiro",
  "location": "string ou null — local do evento",
  "livestream_url": "string ou null — link de livestream/videochamada se mencionado",
  "registration_url": "string ou null — link de inscrição se mencionado",
  "requires_rsvp": "boolean — true se pedir confirmação de presença"
}

Regras:
- Se o utilizador diz "amanhã", "próxima segunda", etc., calcula a data correcta
- Se diz "às 15h" ou "3 da tarde", converte para formato ISO
- Se diz "reunião", category = "meeting". Se diz "evento da empresa"/"team building", category = "company_event"
- Se diz "lembrete"/"não esquecer", item_type = "task", category = "reminder"
- Se não menciona hora, assume all_day = true
- Responde APENAS com o JSON, sem comentários`
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

    // Clean nulls — only return fields that have values
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== null && value !== undefined && value !== '') {
        result[key] = value
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao extrair dados do evento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
