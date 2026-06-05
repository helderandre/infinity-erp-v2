import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// All doc types for classification
const DOC_TYPES = [
  { id: 'ffc10933-100c-4a78-89c0-4433a1a76a89', name: 'Contrato de Mediação (CMI)', category: 'Contratual' },
  { id: '5da10e4a-80bb-4f24-93a8-1e9731e20071', name: 'Caderneta Predial Urbana (CPU)', category: 'Imóvel' },
  { id: 'b201aa0e-fa71-4ca7-88d7-1372bd351aa5', name: 'Certificado Energético', category: 'Imóvel' },
  { id: 'c14ca32a-bcd0-4b97-a522-67cda971ef80', name: 'Contrato de Arrendamento', category: 'Imóvel' },
  { id: 'f4df68d0-f833-4d18-ad61-f30c699c22d6', name: 'Ficha Técnica de Habitação', category: 'Imóvel' },
  { id: 'afde278e-3c7e-4214-a779-588778023dc6', name: 'Planta do Imóvel', category: 'Imóvel' },
  { id: 'e2ee0658-8b23-40d7-a2df-187c31f3019d', name: 'Regulamento do Condomínio', category: 'Imóvel' },
  { id: '3a4642c2-c40b-4623-97ed-4dde191a327e', name: 'Título Constitutivo', category: 'Imóvel' },
  { id: '09eac23e-8d32-46f3-9ad8-f579d8d8bf9f', name: 'Certidão Permanente (CRP)', category: 'Jurídico' },
  { id: '89eb4b7a-45e1-44a8-a486-7862a288ddf0', name: 'Escritura', category: 'Jurídico' },
  { id: 'b326071d-8e8c-43e4-b74b-a377e76b94dc', name: 'Licença de Utilização', category: 'Jurídico' },
  { id: '0f37e1aa-388a-4052-970d-92d5f3ab040e', name: 'Procuração', category: 'Jurídico' },
  { id: '038b0196-96cc-44c8-81c3-15b411f8c4ad', name: 'Autorização do Tribunal', category: 'Jurídico Especial' },
  { id: '06989018-d0a5-446c-870f-8992f98d28b9', name: 'Certidão de Óbito', category: 'Jurídico Especial' },
  { id: '52184963-16c4-4d58-bb78-32592db26214', name: 'Habilitação de Herdeiros', category: 'Jurídico Especial' },
  { id: '16706cb5-1a27-413d-ad75-ec6aee1c3674', name: 'Cartão de Cidadão', category: 'Proprietário' },
  { id: 'b038f839-d40e-47f7-8a1d-15a4c97614cc', name: 'Comprovante de Morada', category: 'Proprietário' },
  { id: '0898d9ba-890f-4877-8f56-c370b22af8d9', name: 'Comprovativo de Estado Civil', category: 'Proprietário' },
  { id: '02b63b46-d5ed-4314-9e83-1447095f8a15', name: 'Ficha de Branqueamento de Capitais', category: 'Proprietário' },
  { id: '425ee306-2e33-4cf6-aa35-5e32359c4927', name: 'Ata de Poderes para Venda', category: 'Proprietário Empresa' },
  { id: 'e433c9f1-b323-43ac-9607-05b31f72bbb9', name: 'Certidão Permanente da Empresa', category: 'Proprietário Empresa' },
  { id: 'f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d', name: 'Ficha de Branqueamento (Empresa)', category: 'Proprietário Empresa' },
  { id: '2f911296-a215-407b-b826-dba2a17424ad', name: 'Pacto Social / Estatutos', category: 'Proprietário Empresa' },
  { id: '6dd8bf4c-d354-4e0e-8098-eda5a8767fd1', name: 'RCBE', category: 'Proprietário Empresa' },
]

const DOC_TYPE_LIST = DOC_TYPES.map(d => `- ID: "${d.id}" | Nome: "${d.name}" | Categoria: "${d.category}"`).join('\n')

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = await import('pdf-parse')
    const pdfParse = (mod as any).default || mod
    const result = await pdfParse(buffer, { max: 1 }) // first page only
    return result.text?.slice(0, 500) || '' // first 500 chars
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
    }

    // Extract text from PDFs and build file descriptions
    const fileDescriptions = await Promise.all(
      files.map(async (file, idx) => {
        let textExcerpt = ''

        if (file.type === 'application/pdf') {
          const buffer = Buffer.from(await file.arrayBuffer())
          textExcerpt = await extractPdfText(buffer)
        }

        return {
          index: idx,
          fileName: file.name,
          fileType: file.type,
          size: file.size,
          textExcerpt,
        }
      })
    )

    // Build file list for GPT
    const fileList = fileDescriptions.map(f => {
      let desc = `${f.index}: "${f.fileName}" (${f.fileType}, ${(f.size / 1024).toFixed(0)}KB)`
      if (f.textExcerpt) {
        desc += `\n   Texto extraído: "${f.textExcerpt.replace(/\n/g, ' ').trim()}"`
      }
      return desc
    }).join('\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classifica documentos imobiliários portugueses com base no nome do ficheiro e no texto extraído.

Tipos de documento disponíveis:
${DOC_TYPE_LIST}

Responde com JSON: {"results": [{"index": 0, "doc_type_id": "uuid-aqui", "confidence": "high"|"medium"|"low"}]}

Pistas para classificação:
- "Caderneta Predial" / "CPU" / "CIMI" / "Artigo matricial" / "Serviço de Finanças" → Caderneta Predial Urbana (CPU)
- "Certidão Permanente" / "Conservatória do Registo Predial" / "CRP" → Certidão Permanente (CRP)
- "Certificado Energético" / "SCE" / "ADENE" / "classe energética" → Certificado Energético
- "Licença de Utilização" / "Câmara Municipal" / "alvará" → Licença de Utilização
- "Contrato de Mediação" / "CMI" / "mediação imobiliária" → Contrato de Mediação (CMI)
- "Cartão de Cidadão" / "CC" / "BI" / "documento de identificação" → Cartão de Cidadão
- "Procuração" / "representação" / "poderes para" → Procuração
- "Escritura" / "notário" / "compra e venda" → Escritura
- "Planta" / "piso" / "alçado" → Planta do Imóvel
- "Branqueamento" / "prevenção" / "capitais" → Ficha de Branqueamento de Capitais
- "RCBE" / "registo central" / "beneficiário efectivo" → RCBE
- "Certidão permanente da empresa" / "Certidão Comercial" → Certidão Permanente da Empresa
- "Estatutos" / "Pacto Social" → Pacto Social / Estatutos
- "Título constitutivo" / "propriedade horizontal" → Título Constitutivo
- "Regulamento" / "condomínio" → Regulamento do Condomínio
- "Ficha técnica" / "habitação" → Ficha Técnica de Habitação

Se o nome for genérico (ex: "documento.pdf"), usa o texto extraído. Se ambos forem ambíguos, usa confidence "low".`,
        },
        {
          role: 'user',
          content: `Classifica estes ${files.length} ficheiros:\n\n${fileList}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    let classifications: { index: number; doc_type_id: string; confidence: string }[] = []

    try {
      const parsed = JSON.parse(responseText)
      classifications = parsed.results || parsed.classifications || []
      if (!Array.isArray(classifications)) classifications = []
    } catch (e) {
      console.error('Erro ao parsear resposta GPT:', responseText, e)
    }

    // Map back to files with doc type info
    const results = files.map((file, idx) => {
      const match = classifications.find(c => c.index === idx)
      const docType = match ? DOC_TYPES.find(d => d.id === match.doc_type_id) : null

      return {
        index: idx,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        doc_type_id: docType ? match!.doc_type_id : null,
        doc_type_name: docType?.name || null,
        doc_type_category: docType?.category || null,
        confidence: match?.confidence || 'low',
      }
    })

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Erro ao classificar documentos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
