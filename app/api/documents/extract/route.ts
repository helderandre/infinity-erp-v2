import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

// Campos legais que vão para dev_property_legal_data
const LEGAL_DATA_FIELDS = [
  'artigo_matricial',
  'artigo_matricial_tipo',
  'freguesia_fiscal',
  'distrito',
  'concelho',
  'codigo_ine_freguesia',
  'fracao_autonoma',
  'descricao_ficha',
  'descricao_ficha_ano',
  'conservatoria_crp',
  'freguesia',
  'quota_parte',
] as const

// Campos da licença de utilização que vão para dev_property_internal
const LICENSE_FIELDS = [
  'use_license_number',
  'use_license_date',
  'use_license_issuer',
] as const

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
  },
  "license": {
    "use_license_number": "string — Número da Licença de Utilização (ex: '125/2019')",
    "use_license_date": "string — Data de emissão da licença (YYYY-MM-DD)",
    "use_license_issuer": "string — Entidade emissora (ex: 'Câmara Municipal de Lisboa')"
  },
  "legal_data": {
    "artigo_matricial": "string — Nº do artigo matricial da Caderneta Predial (ex: '4567')",
    "artigo_matricial_tipo": "string — 'urbano' | 'rustico' | 'misto'",
    "freguesia_fiscal": "string — Freguesia para efeitos fiscais (Caderneta)",
    "distrito": "string — Distrito (ex: 'Lisboa')",
    "concelho": "string — Concelho (ex: 'Cascais')",
    "codigo_ine_freguesia": "string — Código INE da freguesia (6 dígitos), se visível na Caderneta",
    "fracao_autonoma": "string — Letra da fracção autónoma (ex: 'C', 'AB'), só se propriedade horizontal",
    "descricao_ficha": "string — Número da descrição na Certidão Permanente CRP (ex: '12345')",
    "descricao_ficha_ano": "number — Ano da descrição se vier no formato 'NUMERO/ANO' (ex: 2015)",
    "conservatoria_crp": "string — Nome da conservatória (ex: 'Conservatória do Registo Predial de Lisboa')",
    "freguesia": "string — Freguesia da descrição na CRP (pode diferir da freguesia fiscal)",
    "quota_parte": "string — Quota-parte de comproprietários (ex: '1/2', '3/4'), só se houver"
  }
}`

const SYSTEM_PROMPT = `Extrai dados estruturados de documentos imobiliários portugueses para preencher um formulário de angariação.

Analisa o texto e/ou imagens dos documentos e extrai TODOS os dados possíveis para o seguinte schema JSON. Deixa null os campos que não encontras.

Schema:
${EXTRACTION_SCHEMA}

Regras importantes:
- Caderneta Predial (CPU): morada do imóvel, áreas (bruta/útil), ano de construção, tipo prédio, titular(es) com NIF, Valor Patrimonial Tributário (VPT → imi_value)
  → também: artigo matricial e o seu tipo (urbano/rústico/misto), freguesia fiscal, distrito, concelho, código INE da freguesia (se visível), letra da fracção autónoma (se PH)
- Certidão Permanente (CRP): proprietários com NIF, estado civil, regime de bens, descrição do prédio, morada, freguesia, concelho
  → também: número da descrição (descricao_ficha), ano da descrição se vier "NUMERO/ANO" (descricao_ficha_ano), nome da conservatória, freguesia da descrição, quota-parte de comproprietários, fracção autónoma
- Certificado Energético (CE/SCE): classe energética, área útil, tipologia, morada, código postal, coordenadas GPS (latitude/longitude)
- Contrato de Mediação (CMI): preço do imóvel (listing_price), tipo de negócio, comissão acordada (valor + tipo % ou fixo), regime contratual, prazo, data expiração, morada, proprietário com NIF
- Cartão de Cidadão (CC): contém nome, NIF, data nascimento, número do doc, validade, nacionalidade
- Certidão Permanente Empresa: contém nome empresa, NIPC, objecto social, sede, representante legal, CAE
- Licença de Utilização: contém número da licença, data de emissão, entidade emissora (Câmara Municipal), tipo de utilização (habitação/comércio/serviços) — preenche "license" com estes dados

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
    const propertyId = (formData.get('property_id') as string | null) || null
    const docRegistryIdsRaw = (formData.get('doc_registry_ids') as string | null) || null

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
    }

    let docRegistryIds: (string | null)[] = []
    try {
      docRegistryIds = docRegistryIdsRaw ? JSON.parse(docRegistryIdsRaw) : []
    } catch { /* ignore */ }

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

    // ── Persistência de legal_data em dev_property_legal_data ──
    let legalDataSaved = false
    let legalDataFieldsSet = 0
    if (propertyId && extracted?.legal_data && typeof extracted.legal_data === 'object') {
      try {
        const cleaned: Record<string, any> = {}
        for (const key of LEGAL_DATA_FIELDS) {
          const v = extracted.legal_data[key]
          if (v == null || v === '' || (typeof v === 'string' && v.trim() === '')) continue
          if (key === 'descricao_ficha_ano') {
            const n = typeof v === 'number' ? v : parseInt(String(v), 10)
            if (!Number.isFinite(n) || n <= 0) continue
            cleaned[key] = n
          } else {
            cleaned[key] = String(v).trim()
          }
        }

        if (Object.keys(cleaned).length > 0) {
          const supabase = await createClient() as any
          // Buscar registo existente para fazer merge (não sobrescrever campos com null)
          const { data: existing } = await supabase
            .from('dev_property_legal_data')
            .select('*')
            .eq('property_id', propertyId)
            .maybeSingle()

          // Identificar primeiro doc_registry_id correspondente (se houver)
          let extractedFromDocId: string | null = null
          if (docRegistryIds.length > 0) {
            extractedFromDocId = docRegistryIds.find((id) => !!id) || null
          }

          const now = new Date().toISOString()
          const payload: Record<string, any> = {
            property_id: propertyId,
            ...(existing || {}),
            ...cleaned,
            extracted_at: now,
            extracted_by: auth.user.id,
            updated_at: now,
          }
          if (extractedFromDocId) payload.extracted_from_document_id = extractedFromDocId

          const { error: upsertError } = await supabase
            .from('dev_property_legal_data')
            .upsert(payload, { onConflict: 'property_id' })

          if (upsertError) {
            console.error('[extract] Erro ao gravar dev_property_legal_data:', upsertError)
          } else {
            legalDataSaved = true
            legalDataFieldsSet = Object.keys(cleaned).length
          }
        }
      } catch (legalErr) {
        console.error('[extract] Erro a processar legal_data:', legalErr)
      }
    }

    // ── Persistência de license em dev_property_internal ──
    let licenseSaved = false
    let licenseFieldsSet = 0
    if (propertyId && extracted?.license && typeof extracted.license === 'object') {
      try {
        const cleaned: Record<string, any> = {}
        for (const key of LICENSE_FIELDS) {
          const v = extracted.license[key]
          if (v == null || v === '' || (typeof v === 'string' && v.trim() === '')) continue
          cleaned[key] = typeof v === 'string' ? v.trim() : v
        }
        if (Object.keys(cleaned).length > 0) {
          const supabase = await createClient() as any
          const { data: existing } = await supabase
            .from('dev_property_internal')
            .select('use_license_number, use_license_date, use_license_issuer')
            .eq('property_id', propertyId)
            .maybeSingle()

          // Merge — AI só sobrepõe campos em branco (padrão já usado no
          // resto do sistema para extracções automáticas).
          const merged: Record<string, any> = { property_id: propertyId }
          for (const key of LICENSE_FIELDS) {
            const current = existing?.[key]
            if (current != null && current !== '') continue
            if (cleaned[key] !== undefined) merged[key] = cleaned[key]
          }
          if (Object.keys(merged).length > 1) {
            const { error: upsertErr } = await supabase
              .from('dev_property_internal')
              .upsert(merged, { onConflict: 'property_id' })
            if (!upsertErr) {
              licenseSaved = true
              licenseFieldsSet = Object.keys(merged).length - 1
            } else {
              console.error('[extract] Erro ao gravar license:', upsertErr)
            }
          }
        }
      } catch (licErr) {
        console.error('[extract] Erro a processar license:', licErr)
      }
    }

    return NextResponse.json({
      data: extracted,
      legal_data_saved: legalDataSaved,
      legal_data_fields_set: legalDataFieldsSet,
      license_saved: licenseSaved,
      license_fields_set: licenseFieldsSet,
    })
  } catch (error) {
    console.error('Erro ao extrair dados:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
