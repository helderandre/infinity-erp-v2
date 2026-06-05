import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = await import('pdf-parse')
    const pdfParse = (mod as any).default || mod
    const result = await pdfParse(buffer, { max: 5 })
    return result.text || ''
  } catch {
    return ''
  }
}

const SYSTEM_PROMPT = `És um assistente que extrai a data de validade/expiração de documentos imobiliários portugueses.

Analisa o documento e devolve APENAS a data de validade no formato JSON: {"valid_until": "YYYY-MM-DD"} ou {"valid_until": null} se não encontrares uma data clara de validade/expiração.

Examples:
- Certificado Energético: validade indicada (geralmente 10 anos a partir da emissão)
- Caderneta Predial: data de emissão + 12 meses
- Cartão de Cidadão: data de validade impressa no documento
- Contratos: data de expiração / fim do contrato
- Certidões: validade indicada (geralmente 6 meses)

Se houver ambiguidade, prefere a data MAIS recente que represente quando o documento deixa de ser válido.`

interface DocRow {
  id: string
  file_url: string
  file_name: string
  doc_type: { name: string | null; category: string | null } | null
}

async function extractValidityFromUrl(doc: DocRow): Promise<string | null> {
  try {
    const res = await fetch(doc.file_url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = doc.file_name.split('.').pop()?.toLowerCase() || ''
    const isPdf = ext === 'pdf'
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)

    let text = ''
    if (isPdf) text = await extractPdfText(buffer)

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Tipo de documento: ${doc.doc_type?.name || 'Desconhecido'} (${doc.doc_type?.category || ''})\nFicheiro: ${doc.file_name}\n\nConteúdo:`,
      },
    ]

    if (text.trim().length > 50) {
      userContent.push({ type: 'text', text: text.slice(0, 4000) })
    } else if (isImage) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buffer.toString('base64')}`, detail: 'auto' },
      })
    } else if (isPdf) {
      userContent.push({
        type: 'file',
        file: { filename: doc.file_name, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` },
      } as any)
    } else {
      return null
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(responseText)
    const date = parsed?.valid_until
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
    return null
  } catch (err) {
    console.error('Erro a extrair validade:', err)
    return null
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const body = await request.json().catch(() => ({}))
    const docIds: string[] | undefined = Array.isArray(body?.doc_ids) ? body.doc_ids : undefined

    const supabase = await createClient() as any

    let query = supabase
      .from('doc_registry')
      .select('id, file_url, file_name, doc_type:doc_types(name, category)')
      .eq('property_id', propertyId)
      .neq('status', 'archived')

    if (docIds && docIds.length > 0) {
      query = query.in('id', docIds)
    }

    const { data: docs, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!docs || docs.length === 0) {
      return NextResponse.json({ updated: 0, results: [] })
    }

    const results: { id: string; valid_until: string | null }[] = []
    for (const doc of docs as DocRow[]) {
      const validity = await extractValidityFromUrl(doc)
      if (validity) {
        await supabase
          .from('doc_registry')
          .update({ valid_until: validity })
          .eq('id', doc.id)
      }
      results.push({ id: doc.id, valid_until: validity })
    }

    const updated = results.filter((r) => r.valid_until).length
    return NextResponse.json({ updated, total: results.length, results })
  } catch (error) {
    console.error('Erro ao extrair validades:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
