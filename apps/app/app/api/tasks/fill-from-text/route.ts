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
    const { text, users } = body as {
      text?: string
      users?: { id: string; name: string }[]
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })
    const now = new Date().toISOString()

    const usersBlock =
      users && users.length > 0
        ? `\nLista de utilizadores disponíveis (usa o id exacto quando o texto referir um nome):\n${users
            .map((u) => `- ${u.name} (id: ${u.id})`)
            .join('\n')}\n`
        : '\nNão há utilizadores — "assigned_to" deve ser null.\n'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente que extrai dados estruturados para criar tarefas (to-dos) a partir de texto livre em Português de Portugal.

A data/hora actual é: ${now}
${usersBlock}
Extrai (retorna JSON, null para campos não mencionados):
{
  "title": "string — título curto e directo",
  "description": "string ou null — detalhes adicionais em texto simples",
  "priority": "1|2|3|4 ou null — 1=urgente, 2=alta, 3=média, 4=normal",
  "due_date": "ISO 8601 string ou null — prazo",
  "assigned_to": "string ou null — id do utilizador da lista acima",
  "is_recurring": "boolean — true se recorrente",
  "reminders": "array de { minutes_before: number } ou null"
}

Regras:
- "urgente"/"já"/"prioridade máxima" → priority=1
- "importante"/"alta prioridade" → priority=2
- "quando poderes"/"baixa" → priority=4
- "amanhã", "próxima segunda", "sexta às 15h" — calcula data ISO
- Se não menciona hora, due_date pode ser ao fim do dia (23:59)
- "todos os dias"/"semanalmente" → is_recurring=true
- "avisar 30 min antes" → reminders=[{"minutes_before": 30}]
- Faz fuzzy match de nomes contra a lista
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

    // Validate assigned_to.
    const allowedUserIds = new Set((users ?? []).map((u) => u.id))
    if (typeof extracted.assigned_to === 'string' && !allowedUserIds.has(extracted.assigned_to)) {
      extracted.assigned_to = null
    }

    // Reminders sanitize.
    if (Array.isArray(extracted.reminders)) {
      const seen = new Set<number>()
      const clean: { minutes_before: number }[] = []
      for (const r of extracted.reminders as unknown[]) {
        if (r && typeof r === 'object' && 'minutes_before' in r) {
          const mb = Number((r as { minutes_before: unknown }).minutes_before)
          if (Number.isFinite(mb) && mb > 0 && mb <= 60 * 24 * 30 && !seen.has(mb)) {
            seen.add(mb)
            clean.push({ minutes_before: Math.round(mb) })
          }
        }
      }
      extracted.reminders = clean.length > 0 ? clean.slice(0, 10) : null
    }

    // Clamp priority.
    if (typeof extracted.priority === 'number') {
      if (extracted.priority < 1 || extracted.priority > 4) extracted.priority = null
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      result[key] = value
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao extrair dados da tarefa:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
