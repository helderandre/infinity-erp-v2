import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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
    const { text } = body as { text: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Extrai dados de um potencial lead imobiliário a partir de texto livre (transcrição de áudio ou notas).
Retorna APENAS um JSON válido com os campos que consigas identificar. Não inventes dados.

Campos possíveis:
- "nome": nome completo da pessoa
- "email": email
- "telemovel": número de telemóvel (formato português +351...)
- "telefone": telefone fixo
- "origem": de onde veio o lead — um de: portal_idealista, portal_imovirtual, portal_casa_sapo, website, referral, walk_in, phone_call, social_media, other
- "observacoes": qualquer informação adicional relevante (o que procura, notas, contexto)

Se não conseguires identificar um campo, omite-o do JSON (não ponhas null nem string vazia).
Se o texto mencionar de onde o contacto veio (ex: "veio do idealista", "ligou", "passou na loja"), mapeia para a origem correcta.
Se houver detalhes sobre o que procura (tipo de imóvel, zona, orçamento), coloca nas observações de forma organizada.

Responde APENAS com o JSON, sem markdown, sem explicações.`,
        },
        { role: 'user', content: text },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'

    let extracted: Record<string, unknown>
    try {
      const cleaned = raw.replace(/^```json?\s*/, '').replace(/\s*```$/, '')
      extracted = JSON.parse(cleaned)
    } catch {
      extracted = {}
    }

    return NextResponse.json({ fields: extracted, raw_text: text })
  } catch (error) {
    console.error('[leads/extract-from-text]', error)
    return NextResponse.json({ error: 'Erro ao extrair dados' }, { status: 500 })
  }
}
