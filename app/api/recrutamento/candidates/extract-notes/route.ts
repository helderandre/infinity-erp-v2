import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { text } = await request.json()
    if (!text?.trim()) return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extrais informação de notas de recrutamento imobiliário em Portugal.
A partir de texto livre (transcrição de áudio, notas de chamada, etc.), extrai:

1. "note_summary": resumo estruturado da conversa/nota (2-4 linhas, em português)
2. "fields": campos do perfil do candidato que possam ser actualizados:
   - "full_name": nome completo (se mencionado)
   - "phone": telemóvel (formato português)
   - "email": email
   - "source_detail": detalhe sobre a origem (ex: "referido pelo João")
   - "identified_pains": dores/frustrações identificadas (para pain & pitch)
   - "solutions_presented": soluções que apresentámos
   - "candidate_objections": objecções levantadas
   - "has_real_estate_experience": true/false se mencionado
   - "previous_agency": nome da imobiliária anterior se mencionado
   - "reason_for_leaving": razão para sair da agência anterior

Retorna APENAS campos com valor. Omite campos vazios ou não mencionados.
Retorna JSON: { "note_summary": string, "fields": { ... } }`,
        },
        { role: 'user', content: text },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    let result: { note_summary: string; fields: Record<string, any> }
    try {
      result = JSON.parse(raw.replace(/^```json?\s*/, '').replace(/\s*```$/, ''))
    } catch {
      result = { note_summary: text, fields: {} }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[extract-notes]', err)
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}
