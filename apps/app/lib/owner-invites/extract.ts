import OpenAI from 'openai'
import type { UploadedInviteFile } from '@/lib/validations/owner-invite'

// Server-side extraction from uploaded docs. Runs GPT-4o vision over each
// relevant doc and returns partial owner/company fields. Everything is
// best-effort — the form already guarantees the docs exist, but extraction
// failures must not block submission; the consultant can fix missing fields
// later by editing the owner record.

export interface ExtractedSingular {
  name?: string
  nif?: string
  birth_date?: string
  nationality?: string
  naturality?: string
  id_doc_type?: string
  id_doc_number?: string
  id_doc_expiry?: string
  id_doc_issued_by?: string
  marital_status?: string
}

export interface ExtractedAddress {
  address?: string
  postal_code?: string
  city?: string
}

export interface ExtractedColetiva {
  name?: string
  nif?: string
  legal_nature?: string
  cae_code?: string
  company_object?: string
  legal_representative_name?: string
  legal_representative_nif?: string
  country_of_incorporation?: string
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

async function docToContent(
  file: UploadedInviteFile
): Promise<OpenAI.Chat.ChatCompletionContentPart[] | null> {
  const isPdf =
    file.mime_type === 'application/pdf' ||
    file.file_name.toLowerCase().endsWith('.pdf')
  try {
    if (isPdf) {
      const res = await fetch(file.file_url)
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      return [
        {
          type: 'image_url',
          image_url: { url: `data:application/pdf;base64,${b64}` },
        } as any,
      ]
    }
    return [
      {
        type: 'image_url',
        image_url: { url: file.file_url, detail: 'high' },
      },
    ]
  } catch {
    return null
  }
}

function safeJson(text: string): any {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

async function runExtraction<T>(
  openai: OpenAI,
  system: string,
  file: UploadedInviteFile
): Promise<T | null> {
  const content = await docToContent(file)
  if (!content) return null
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
      max_tokens: 500,
      temperature: 0,
    })
    const raw = completion.choices[0]?.message?.content || '{}'
    return safeJson(raw) as T | null
  } catch (err) {
    console.error('Extraction failed for', file.file_name, err)
    return null
  }
}

export async function extractFromCC(
  file: UploadedInviteFile
): Promise<ExtractedSingular | null> {
  const openai = getOpenAI()
  if (!openai) return null
  const system = `Extrai dados de um documento de identificação português (Cartão de Cidadão, Passaporte, BI ou Autorização de Residência).
Retorna APENAS JSON válido com estes campos (null se não visível):
- name: nome completo
- nif: número de identificação fiscal (9 dígitos)
- birth_date: YYYY-MM-DD
- nationality
- naturality: naturalidade (local de nascimento)
- id_doc_type: "CC" | "Passaporte" | "BI" | "AR"
- id_doc_number
- id_doc_expiry: YYYY-MM-DD
- id_doc_issued_by
- marital_status: "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_facto" (só se claramente visível)`
  return runExtraction<ExtractedSingular>(openai, system, file)
}

export async function extractFromComprovativoMorada(
  file: UploadedInviteFile
): Promise<ExtractedAddress | null> {
  const openai = getOpenAI()
  if (!openai) return null
  const system = `Extrai a morada de residência de um comprovativo (factura, atestado, extracto).
Retorna APENAS JSON válido (null se não visível):
- address: rua + número + andar
- postal_code: formato 0000-000
- city: localidade principal`
  return runExtraction<ExtractedAddress>(openai, system, file)
}

export async function extractFromCertidaoPermanente(
  file: UploadedInviteFile
): Promise<ExtractedColetiva | null> {
  const openai = getOpenAI()
  if (!openai) return null
  const system = `Extrai dados de uma certidão permanente portuguesa de pessoa colectiva.
Retorna APENAS JSON válido (null se não visível):
- name: designação social / firma
- nif: NIPC (9 dígitos)
- legal_nature: natureza jurídica (ex: "Sociedade por quotas")
- cae_code: código CAE principal
- company_object: objecto social (resumido)
- legal_representative_name: gerente ou administrador activo
- legal_representative_nif: NIF do representante, se presente
- country_of_incorporation: país de constituição`
  return runExtraction<ExtractedColetiva>(openai, system, file)
}

// Merge helper: non-empty extracted values win over empty form values;
// form values always win if truthy (user-provided beats AI).
export function mergeExtracted<T extends Record<string, any>>(
  base: T,
  extracted: Partial<T> | null
): T {
  if (!extracted) return base
  const out: any = { ...base }
  for (const [k, v] of Object.entries(extracted)) {
    if (v == null || v === '') continue
    if (!out[k] || out[k] === '') out[k] = v
  }
  return out
}
