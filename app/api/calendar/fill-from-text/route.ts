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
    const { text, users, roles } = body as {
      text?: string
      users?: { id: string; name: string }[]
      roles?: string[]
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })
    const now = new Date().toISOString()

    // Context blocks for the AI to match names/roles against actual IDs.
    const usersBlock =
      users && users.length > 0
        ? `\nLista de utilizadores disponíveis (usa o id exacto quando o texto referir um nome):\n${users
            .map((u) => `- ${u.name} (id: ${u.id})`)
            .join('\n')}\n`
        : '\nNão há utilizadores disponíveis — "user_id" e "visibility_user_ids" devem ser null / [].\n'

    const rolesBlock =
      roles && roles.length > 0
        ? `\nCargos disponíveis (usa o nome exacto):\n${roles.map((r) => `- ${r}`).join('\n')}\n`
        : '\nCargos disponíveis: (nenhum fornecido)\n'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente que extrai dados estruturados para criar eventos de calendário a partir de texto livre em Português de Portugal.

A data/hora actual é: ${now}
${usersBlock}${rolesBlock}
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
  "requires_rsvp": "boolean — true se pedir confirmação de presença",
  "reminders": "array de objectos { minutes_before: number } ou null — avisos antes do evento",
  "user_id": "string ou null — id do utilizador associado/atribuído ao evento (só um da lista acima)",
  "visibility": "all|team|private ou null — modo simples de visibilidade",
  "visibility_mode": "all|include|exclude ou null — só usa quando há filtros avançados por cargo/pessoa",
  "visibility_role_names": "array de strings ou null — cargos que devem ver (ou não ver, se exclude)",
  "visibility_user_ids": "array de strings (ids) ou null — pessoas específicas"
}

Regras gerais:
- Se o utilizador diz "amanhã", "próxima segunda", etc., calcula a data correcta
- Se diz "às 15h" ou "3 da tarde", converte para formato ISO
- Se diz "reunião", category = "meeting". Se diz "evento da empresa"/"team building", category = "company_event"
- Se diz "lembrete"/"não esquecer", item_type = "task", category = "reminder"
- Se não menciona hora, assume all_day = true

Regras para lembretes (reminders):
- "avisar 30 min antes" → [{ "minutes_before": 30 }]
- "lembrete 1 hora antes" → [{ "minutes_before": 60 }]
- "1 dia antes e 1 hora antes" → [{ "minutes_before": 1440 }, { "minutes_before": 60 }]
- Converte "hora"=60, "horas"×60, "dia"=1440, "dias"×1440
- Se não menciona lembretes, reminders = null

Regras para atribuído a (user_id):
- "atribuir à Maria Silva", "para o João", "do Pedro" → escolhe o id correspondente da lista
- Faz fuzzy match pelo nome comercial
- Se o nome não estiver na lista, user_id = null

Regras para visibilidade:
- "privado"/"só eu"/"apenas eu" → visibility = "private"
- "equipa"/"toda a equipa"/"todos" (sem restrição) → visibility = "all" ou "team"
- "só para brokers"/"apenas consultoras executivas" → visibility_mode = "include" + visibility_role_names = ["Broker/CEO"] etc.
- "todos excepto marketing" → visibility_mode = "exclude" + visibility_role_names = ["Marketing"]
- "visível para a Ana e o João" → visibility_mode = "include" + visibility_user_ids = [ids]
- Quando usas visibility_mode "include"/"exclude", deixa visibility = null (é avançado)
- Usa apenas nomes de cargos exactos da lista acima

Responde APENAS com o JSON, sem comentários.`,
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

    // Validate user_id against allowed set; drop if unknown.
    const allowedUserIds = new Set((users ?? []).map((u) => u.id))
    if (typeof extracted.user_id === 'string' && !allowedUserIds.has(extracted.user_id)) {
      extracted.user_id = null
    }

    // Filter visibility_user_ids to known ids.
    if (Array.isArray(extracted.visibility_user_ids)) {
      extracted.visibility_user_ids = extracted.visibility_user_ids.filter(
        (id: unknown) => typeof id === 'string' && allowedUserIds.has(id),
      )
      if ((extracted.visibility_user_ids as unknown[]).length === 0) {
        extracted.visibility_user_ids = null
      }
    }

    // Filter role names to allowed set.
    const allowedRoles = new Set(roles ?? [])
    if (Array.isArray(extracted.visibility_role_names) && allowedRoles.size > 0) {
      extracted.visibility_role_names = extracted.visibility_role_names.filter(
        (r: unknown) => typeof r === 'string' && allowedRoles.has(r),
      )
      if ((extracted.visibility_role_names as unknown[]).length === 0) {
        extracted.visibility_role_names = null
      }
    }

    // Reminders: accept only { minutes_before: positive integer }, dedupe, cap at 10.
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

    // Clean nulls — only return fields that have values.
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      result[key] = value
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao extrair dados do evento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
