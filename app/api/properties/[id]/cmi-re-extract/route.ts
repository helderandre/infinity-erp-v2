// Re-run AI extraction on the property + owner documents already stored
// in doc_registry. Used from the CMI panel button to catch up docs that
// were uploaded before extraction was wired (or when the consultant
// wants to refresh structured fields).
//
// Owner docs (CC / Comprovativo de Morada / Certidão Permanente Empresa)
// use the URL-based lib in `lib/owner-invites/extract.ts` and patch the
// `owners` row via non-destructive merge.
//
// Property docs (Caderneta / Certidão Permanente / Licença de Utilização)
// are posted to the existing multi-doc extract endpoint (`/api/documents/
// extract`) which persists `dev_property_legal_data` and
// `dev_property_internal` (license_*).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import {
  extractFromCC,
  extractFromComprovativoMorada,
  extractFromCertidaoPermanente,
  mergeExtracted,
} from '@/lib/owner-invites/extract'

const OWNER_DOC_TYPE_IDS = {
  CARTAO_CIDADAO: '16706cb5-1a27-413d-ad75-ec6aee1c3674',
  COMPROVANTE_MORADA: 'b038f839-d40e-47f7-8a1d-15a4c97614cc',
  CERTIDAO_PERMANENTE_EMPRESA: 'e433c9f1-b323-43ac-9607-05b31f72bbb9',
} as const

const PROPERTY_DOC_TYPE_IDS = new Set<string>([
  '5da10e4a-80bb-4f24-93a8-1e9731e20071', // Caderneta Predial Urbana
  '09eac23e-8d32-46f3-9ad8-f579d8d8bf9f', // Certidão Permanente (CRP)
  'b326071d-8e8c-43e4-b74b-a377e76b94dc', // Licença de Utilização
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const supabase = await createClient()

    // Pull all relevant docs in a single pass.
    const { data: docs, error } = await supabase
      .from('doc_registry')
      .select(`
        id, file_url, file_name, doc_type_id, owner_id, property_id,
        doc_type:doc_types(id, name, category)
      `)
      .or(`property_id.eq.${propertyId},owner_id.in.(${await getOwnerIds(supabase, propertyId)})`)
      .neq('status', 'archived')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ownerDocs = (docs || []).filter(
      (d) => !!d.owner_id && d.doc_type_id && isOwnerExtractable(d.doc_type_id)
    )
    const propertyDocs = (docs || []).filter(
      (d) => d.property_id === propertyId && d.doc_type_id && PROPERTY_DOC_TYPE_IDS.has(d.doc_type_id)
    )

    // ── Owner extraction ─────────────────────────────────────────────
    let ownersPatched = 0
    const ownerRowCache = new Map<string, any>()

    for (const doc of ownerDocs) {
      if (!doc.owner_id || !doc.file_url || !doc.doc_type_id) continue

      let owner = ownerRowCache.get(doc.owner_id)
      if (!owner) {
        const { data } = await supabase
          .from('owners')
          .select('*')
          .eq('id', doc.owner_id)
          .single()
        owner = data
        if (owner) ownerRowCache.set(doc.owner_id, owner)
      }
      if (!owner) continue

      const file = {
        slot_slug: '',
        file_url: doc.file_url,
        r2_key: '',
        file_name: doc.file_name || 'doc',
        file_size: 0,
        mime_type: guessMime(doc.file_name),
      }

      let extracted: any = null
      if (doc.doc_type_id === OWNER_DOC_TYPE_IDS.CARTAO_CIDADAO) {
        extracted = await extractFromCC(file)
      } else if (doc.doc_type_id === OWNER_DOC_TYPE_IDS.COMPROVANTE_MORADA) {
        extracted = await extractFromComprovativoMorada(file)
      } else if (doc.doc_type_id === OWNER_DOC_TYPE_IDS.CERTIDAO_PERMANENTE_EMPRESA) {
        extracted = await extractFromCertidaoPermanente(file)
      }
      if (!extracted) continue

      const merged = mergeExtracted(owner, extracted)
      const changed: Record<string, any> = {}
      for (const key of Object.keys(merged)) {
        if (owner[key] !== merged[key]) changed[key] = merged[key]
      }
      if (Object.keys(changed).length === 0) continue

      const { error: upErr } = await supabase
        .from('owners')
        .update(changed)
        .eq('id', doc.owner_id)
      if (!upErr) {
        ownersPatched += Object.keys(changed).length
        ownerRowCache.set(doc.owner_id, { ...owner, ...changed })
      }
    }

    // ── Property extraction via existing multi-doc endpoint ────────
    // We rebuild Files from the R2 URLs and forward to /api/documents/
    // extract, which already writes to dev_property_legal_data and
    // dev_property_internal (license_*).
    let propertyFieldsPatched = 0
    if (propertyDocs.length > 0) {
      try {
        const fetched = await Promise.all(
          propertyDocs.map(async (d) => {
            try {
              const res = await fetch(d.file_url!)
              if (!res.ok) return null
              const buf = await res.arrayBuffer()
              const blob = new Blob([buf], { type: guessMime(d.file_name) })
              return {
                file: new File([blob], d.file_name || 'doc', { type: guessMime(d.file_name) }),
                docTypeName: (d.doc_type as any)?.name || '',
                docTypeCategory: (d.doc_type as any)?.category || '',
                docId: d.id,
              }
            } catch {
              return null
            }
          })
        )
        const valid = fetched.filter((f): f is NonNullable<typeof f> => f !== null)
        if (valid.length > 0) {
          const fd = new FormData()
          const typesArr: { name: string; category: string }[] = []
          const idsArr: string[] = []
          for (const v of valid) {
            fd.append('files', v.file)
            typesArr.push({ name: v.docTypeName, category: v.docTypeCategory })
            idsArr.push(v.docId)
          }
          fd.append('doc_types', JSON.stringify(typesArr))
          fd.append('property_id', propertyId)
          fd.append('doc_registry_ids', JSON.stringify(idsArr))

          // Internal call: forward the cookie so auth passes through.
          const cookieHeader = request.headers.get('cookie') || ''
          const origin = new URL(request.url).origin
          const exRes = await fetch(`${origin}/api/documents/extract`, {
            method: 'POST',
            headers: { cookie: cookieHeader },
            body: fd,
          })
          if (exRes.ok) {
            const j = await exRes.json()
            propertyFieldsPatched = (j.legal_data_fields_set || 0) + (j.license_fields_set || 0)
          }
        }
      } catch (e) {
        console.error('[cmi-re-extract] property extraction error:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      owners_fields_patched: ownersPatched,
      property_fields_patched: propertyFieldsPatched,
      owner_docs_processed: ownerDocs.length,
      property_docs_processed: propertyDocs.length,
    })
  } catch (err: any) {
    console.error('Erro em cmi-re-extract:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getOwnerIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
): Promise<string> {
  const { data } = await supabase
    .from('property_owners')
    .select('owner_id')
    .eq('property_id', propertyId)
  const ids = (data || []).map((r: any) => r.owner_id).filter(Boolean)
  // Return comma-separated list for use in PostgREST .or() / .in() filters.
  // If there are no owners, return a non-matching UUID to keep the query valid.
  return ids.length > 0 ? ids.join(',') : '00000000-0000-0000-0000-000000000000'
}

function isOwnerExtractable(docTypeId: string): boolean {
  return (
    docTypeId === OWNER_DOC_TYPE_IDS.CARTAO_CIDADAO ||
    docTypeId === OWNER_DOC_TYPE_IDS.COMPROVANTE_MORADA ||
    docTypeId === OWNER_DOC_TYPE_IDS.CERTIDAO_PERMANENTE_EMPRESA
  )
}

function guessMime(fileName?: string | null): string {
  if (!fileName) return 'application/octet-stream'
  const n = fileName.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.doc')) return 'application/msword'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}
