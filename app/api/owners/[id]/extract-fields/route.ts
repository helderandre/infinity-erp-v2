// Server endpoint used by the CMI bulk-upload flow. Given an owner and a
// document we just uploaded (CC, comprovativo de morada, certidão
// permanente da empresa), extract structured fields via OpenAI vision and
// patch the owner row — non-empty extracted values win only when the
// existing column is empty (merge logic lives in the extract library).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import {
  extractFromCC,
  extractFromComprovativoMorada,
  extractFromCertidaoPermanente,
  mergeExtracted,
  type ExtractedSingular,
  type ExtractedAddress,
  type ExtractedColetiva,
} from '@/lib/owner-invites/extract'
import { DOC_TYPE_IDS } from '@/lib/acquisitions/cmi-requirements'

interface ExtractRequest {
  file_url: string
  file_name?: string
  mime_type?: string
  doc_type_id: string
}

// Only these doc_types carry owner-level structured data.
function extractorFor(docTypeId: string) {
  switch (docTypeId) {
    case DOC_TYPE_IDS.CARTAO_CIDADAO:
      return { kind: 'singular' as const, run: extractFromCC }
    case DOC_TYPE_IDS.CERTIDAO_PERMANENTE_EMPRESA:
      return { kind: 'coletiva' as const, run: extractFromCertidaoPermanente }
    // Comprovativo de Morada is in category "Proprietário" — we treat any
    // address-bearing doc the same.
    default:
      return null
  }
}

// Heuristic: docs whose name matches "comprovativo de morada" or similar —
// the public doc_type for "Comprovante de Morada" (b038f839-...) is usable
// but not in cmi-requirements. We special-case by id.
const COMPROVATIVO_MORADA_ID = 'b038f839-d40e-47f7-8a1d-15a4c97614cc'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: ownerId } = await params
    const body = (await request.json()) as ExtractRequest

    if (!body.file_url || !body.doc_type_id) {
      return NextResponse.json(
        { error: 'file_url e doc_type_id são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: owner, error: ownerErr } = await supabase
      .from('owners')
      .select('*')
      .eq('id', ownerId)
      .single()

    if (ownerErr || !owner) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      )
    }

    const file = {
      slot_slug: '',
      file_url: body.file_url,
      r2_key: '',
      file_name: body.file_name || 'doc',
      file_size: 0,
      mime_type: body.mime_type || 'application/octet-stream',
    }

    // Decide extractor path.
    let updates: Record<string, unknown> = {}
    let extracted:
      | (ExtractedSingular & ExtractedAddress & ExtractedColetiva)
      | null = null

    if (body.doc_type_id === COMPROVATIVO_MORADA_ID) {
      const r = await extractFromComprovativoMorada(file)
      if (r) {
        extracted = r as any
        updates = mergeExtracted(owner as any, r as any)
      }
    } else {
      const ex = extractorFor(body.doc_type_id)
      if (!ex) {
        return NextResponse.json(
          { error: 'Este tipo de documento não suporta extracção de campos' },
          { status: 400 }
        )
      }
      const r = await ex.run(file)
      if (r) {
        extracted = r as any
        updates = mergeExtracted(owner as any, r as any)
      }
    }

    if (!extracted) {
      return NextResponse.json({
        ok: true,
        extracted: null,
        patched: [],
      })
    }

    // Compute which columns changed — we only want to patch real changes so
    // the audit trail is clean.
    const changed: Record<string, unknown> = {}
    for (const key of Object.keys(updates)) {
      if ((owner as any)[key] !== (updates as any)[key]) {
        changed[key] = (updates as any)[key]
      }
    }

    if (Object.keys(changed).length === 0) {
      return NextResponse.json({ ok: true, extracted, patched: [] })
    }

    const { error: upErr } = await supabase
      .from('owners')
      .update(changed)
      .eq('id', ownerId)

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      extracted,
      patched: Object.keys(changed),
    })
  } catch (err: any) {
    console.error('Erro em owners/[id]/extract-fields:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
