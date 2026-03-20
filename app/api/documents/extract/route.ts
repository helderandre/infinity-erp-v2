import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
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

const EXTRACTION_SCHEMA = `{
  "property": {
    "title": "string — título descritivo do imóvel (ex: 'Apartamento T2 em Cascais')",
    "property_type": "string — um de: apartamento, moradia, terreno, loja, escritorio, armazem, garagem, quinta, predio, outro",
    "business_type": "string — um de: venda, arrendamento, trespasse",
    "listing_price": "number — preço de venda/arrendamento em euros",
    "energy_certificate": "string — classe energética: A+, A, B, B-, C, D, E, F, Isento",
    "typology": "string — tipologia: T0, T1, T2, T3, T4, T5+",
    "bedrooms": "number — quartos",
    "bathrooms": "number — casas de banho",
    "area_gross": "number — área bruta em m²",
    "area_util": "number — área útil em m²",
    "construction_year": "number — ano de construção",
    "parking_spaces": "number — lugares de estacionamento"
  },
  "location": {
    "address_street": "string — morada completa do imóvel",
    "city": "string — cidade/concelho",
    "address_parish": "string — freguesia",
    "postal_code": "string — código postal (formato XXXX-XXX)",
    "latitude": "number — latitude GPS (ex: 38.7223)",
    "longitude": "number — longitude GPS (ex: -9.1393)"
  },
  "owners": [
    {
      "person_type": "string — 'singular' ou 'coletiva'",
      "name": "string — nome completo do proprietário ou empresa",
      "nif": "string — NIF/NIPC (9 dígitos)",
      "nationality": "string — nacionalidade",
      "naturality": "string — naturalidade",
      "birth_date": "string — data de nascimento YYYY-MM-DD",
      "marital_status": "string — um de: solteiro, casado, divorciado, viuvo, uniao_facto, separado",
      "marital_regime": "string — regime de bens se casado",
      "address": "string — morada do proprietário",
      "id_doc_type": "string — tipo doc: cc, bi, passaporte, titulo_residencia",
      "id_doc_number": "string — número do documento de identificação",
      "id_doc_expiry": "string — validade do documento YYYY-MM-DD",
      "id_doc_issued_by": "string — entidade emissora",
      "legal_representative_name": "string — representante legal (se empresa)",
      "legal_representative_nif": "string — NIF do representante legal",
      "company_object": "string — objecto social (se empresa)",
      "legal_nature": "string — natureza jurídica (se empresa)",
      "cae_code": "string — código CAE (se empresa)",
      "postal_code": "string — código postal do proprietário",
      "city": "string — cidade do proprietário"
    }
  ],
  "contract": {
    "contract_regime": "string — um de: exclusivo, aberto, partilhado",
    "commission_agreed": "number — valor da comissão",
    "commission_type": "string — 'percentage' ou 'fixed'",
    "contract_term": "string — prazo do contrato (ex: '6 meses')",
    "contract_expiry": "string — data de expiração YYYY-MM-DD"
  }
}`

const SYSTEM_PROMPT = `Extrai dados estruturados de documentos imobiliários portugueses para preencher um formulário de angariação.

Analisa o texto e/ou imagens dos documentos e extrai TODOS os dados possíveis para o seguinte schema JSON. Deixa null os campos que não encontras.

Schema:
${EXTRACTION_SCHEMA}

Regras importantes:
- Caderneta Predial (CPU): morada do imóvel, áreas (bruta/útil), ano de construção, tipo prédio, titular(es) com NIF, Valor Patrimonial Tributário (VPT → imi_value)
- Certidão Permanente (CRP): proprietários com NIF, estado civil, regime de bens, descrição do prédio, morada, freguesia, concelho
- Certificado Energético (CE/SCE): classe energética, área útil, tipologia, morada, código postal, coordenadas GPS (latitude/longitude)
- Contrato de Mediação (CMI): preço do imóvel (listing_price), tipo de negócio, comissão acordada (valor + tipo % ou fixo), regime contratual, prazo, data expiração, morada, proprietário com NIF
- Cartão de Cidadão (CC): contém nome, NIF, data nascimento, número do doc, validade, nacionalidade
- Certidão Permanente Empresa: contém nome empresa, NIPC, objecto social, sede, representante legal, CAE
- Licença de Utilização: contém tipo de utilização do imóvel

- Se houver múltiplos proprietários, lista todos no array owners
- Converte datas para formato YYYY-MM-DD
- Converte áreas para números (m²)
- Preços/valores sempre em euros (número, sem símbolo)
- NIF sempre com 9 dígitos
- Se o mesmo dado aparece em múltiplos documentos, privilegia a fonte mais fiável

Responde APENAS com o JSON seguindo o schema. Campos sem dados devem ser null.`

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const docTypes = formData.get('doc_types') as string | null

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
    }

    let parsedDocTypes: { name: string; category: string }[] = []
    try { parsedDocTypes = docTypes ? JSON.parse(docTypes) : [] } catch { /* ignore */ }

    // Process all files: extract text from PDFs, prepare buffers for images
    const fileData = await Promise.all(
      files.map(async (file, idx) => {
        const docTypeInfo = parsedDocTypes[idx] || null
        let text = ''
        const buffer = Buffer.from(await file.arrayBuffer())

        if (file.type === 'application/pdf') {
          text = await extractPdfText(buffer)
        }

        return {
          index: idx,
          fileName: file.name,
          fileType: file.type,
          docType: docTypeInfo?.name || 'Desconhecido',
          docCategory: docTypeInfo?.category || '',
          text: text.slice(0, 4000),
          base64: buffer.toString('base64'),
          hasText: text.trim().length > 50,
          isPdf: file.type === 'application/pdf',
          isImage: file.type.startsWith('image/'),
        }
      })
    )

    // Build GPT messages
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = []
    let needsVision = false

    userContent.push({
      type: 'text',
      text: `Extrai os dados destes ${fileData.length} documento(s) imobiliários:`,
    })

    for (const fd of fileData) {
      userContent.push({
        type: 'text',
        text: `\n=== ${fd.docType} (${fd.fileName}) ===`,
      })

      if (fd.hasText) {
        // Text-extractable PDF — send the text
        userContent.push({
          type: 'text',
          text: fd.text,
        })
      } else if (fd.isImage) {
        // Image file — send as vision
        needsVision = true
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${fd.fileType};base64,${fd.base64}`,
            detail: 'auto',
          },
        })
      } else if (fd.isPdf && !fd.hasText) {
        // Scanned PDF — send as file input for GPT-4o
        // GPT-4o supports PDF via image_url with data URI using application/pdf
        needsVision = true
        userContent.push({
          type: 'file',
          file: {
            filename: fd.fileName,
            file_data: `data:application/pdf;base64,${fd.base64}`,
          },
        } as any)
      }
    }

    // Use gpt-4o-mini for everything — good enough for structured PT real estate docs
    const model = 'gpt-4o-mini'

    console.log(`[extract] Processing ${fileData.length} files with ${model}. Text: ${fileData.filter(f => f.hasText).length}, Visual: ${fileData.filter(f => !f.hasText).length}`)

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    console.log('[extract] GPT response:', responseText.slice(0, 500))

    let extracted: any = {}
    try {
      extracted = JSON.parse(responseText)
    } catch (e) {
      console.error('Erro ao parsear extracção GPT:', responseText, e)
      return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
    }

    return NextResponse.json({ data: extracted })
  } catch (error) {
    console.error('Erro ao extrair dados:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
