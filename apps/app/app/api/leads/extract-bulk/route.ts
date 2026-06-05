import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads') as any
    if (!auth.authorized) return auth.response

    const { text } = await request.json()
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extrais contactos/leads de texto não estruturado. Retorna JSON com o formato:
{
  "leads": [
    {
      "nome": "Nome Completo",
      "email": "email@exemplo.com ou null",
      "telemovel": "número de telemóvel ou null",
      "telefone": "telefone fixo ou null",
      "observacoes": "notas relevantes ou null"
    }
  ]
}

Regras:
- Extrai TODOS os contactos que encontrares no texto
- Normaliza números de telefone portugueses (formato +351XXXXXXXXX ou 9XXXXXXXX)
- Se o texto tiver formato tabular (CSV, colunas), interpreta as colunas correctamente
- Se houver um único bloco de texto com vários dados, tenta separar em contactos individuais
- "nome" é sempre obrigatório — se não conseguires determinar o nome, usa "Sem nome"
- Observações devem incluir qualquer info extra relevante que não caiba nos outros campos`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    return NextResponse.json({ leads: parsed.leads || [] })
  } catch (error) {
    console.error('Erro ao extrair leads:', error)
    return NextResponse.json(
      { error: 'Erro ao processar texto' },
      { status: 500 }
    )
  }
}
