import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import {
  submitOwnerInviteSchema,
  type SubmitOwnerInviteInput,
  type UploadedInviteFile,
} from '@/lib/validations/owner-invite'
import { findSlot, type OwnerInviteContext } from '@/lib/owner-invites/doc-slots'
import {
  extractFromCC,
  extractFromCertidaoPermanente,
  extractFromComprovativoMorada,
  mergeExtracted,
} from '@/lib/owner-invites/extract'

type OwnerRow = { id: string; name: string }

async function insertOwner(
  admin: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
): Promise<OwnerRow> {
  const { data: inserted, error } = await admin
    .from('owners')
    .insert(data as any)
    .select('id, name')
    .single()
  if (error || !inserted) {
    throw new Error(error?.message || 'Falha ao criar proprietário')
  }
  return inserted as OwnerRow
}

async function registerDocs(
  admin: ReturnType<typeof createAdminClient>,
  files: UploadedInviteFile[],
  ownerId: string,
  propertyId: string,
  uploadedBy: string,
  context: OwnerInviteContext
) {
  if (files.length === 0) return
  const rows = files.map((f) => {
    const slot = findSlot(context, f.slot_slug)
    return {
      owner_id: ownerId,
      property_id: propertyId,
      doc_type_id: null,
      file_url: f.file_url,
      file_name: f.file_name,
      uploaded_by: uploadedBy,
      status: 'active',
      notes: slot?.label || f.slot_slug,
      metadata: {
        size: f.file_size,
        mimetype: f.mime_type,
        r2_key: f.r2_key,
        slot_slug: f.slot_slug,
        source: 'public_owner_invite',
      },
    }
  })
  const { error } = await admin.from('doc_registry').insert(rows as any)
  if (error) throw new Error(error.message)
}

function cleanUndef(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) continue
    out[k] = v
  }
  return out
}

function pickFile(
  files: UploadedInviteFile[],
  slug: string
): UploadedInviteFile | undefined {
  return files.find((f) => f.slot_slug === slug)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await loadInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  }
  const usable = isInviteUsable(invite)
  if (!usable.ok) {
    return NextResponse.json(
      { error: 'Convite indisponível', reason: usable.reason },
      { status: 410 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = submitOwnerInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const payload: SubmitOwnerInviteInput = parsed.data

  const admin = createAdminClient()
  const createdOwnerIds: string[] = []
  const uploadedBy = invite.created_by
  const propertyId = invite.property_id

  try {
    if (payload.mode === 'singular' && payload.is_heranca === false) {
      // ── Extract from CC + comprovativo morada ──
      const ccFile = pickFile(payload.files, 'cc-passaporte')
      const addrFile = pickFile(payload.files, 'comprovativo-morada')
      const [cc, addr] = await Promise.all([
        ccFile ? extractFromCC(ccFile) : Promise.resolve(null),
        addrFile ? extractFromComprovativoMorada(addrFile) : Promise.resolve(null),
      ])

      const merged = mergeExtracted(
        {
          email: payload.primary.email,
          phone: payload.primary.phone,
          marital_status: payload.primary.marital_status,
          marital_regime: payload.primary.marital_regime,
          profession: payload.primary.profession,
        },
        { ...(cc || {}) }
      )
      const withAddress = mergeExtracted(merged as any, addr)

      const ownerData = cleanUndef({
        person_type: 'singular',
        name: (cc?.name as string) || payload.primary.name,
        ...withAddress,
      })
      const owner = await insertOwner(admin, ownerData)
      createdOwnerIds.push(owner.id)

      await admin.from('property_owners').insert({
        property_id: propertyId,
        owner_id: owner.id,
        ownership_percentage: payload.primary.ownership_percentage ?? 100,
        is_main_contact: true,
      } as any)

      await registerDocs(
        admin,
        payload.files,
        owner.id,
        propertyId,
        uploadedBy,
        'singular'
      )
    } else if (payload.mode === 'singular' && payload.is_heranca === true) {
      // ── Cabeça de casal ──
      const cabecaCc = payload.files.find(
        (f) => f.slot_slug === 'cc-passaporte'
      )
      const cc = cabecaCc ? await extractFromCC(cabecaCc) : null

      const cabecaData = cleanUndef({
        person_type: 'singular',
        name: (cc?.name as string) || payload.primary.name,
        email: payload.primary.email,
        phone: payload.primary.phone,
        marital_status: payload.primary.marital_status || cc?.marital_status,
        marital_regime: payload.primary.marital_regime,
        profession: payload.primary.profession,
        nif: cc?.nif,
        birth_date: cc?.birth_date,
        nationality: cc?.nationality,
        naturality: cc?.naturality,
        id_doc_type: cc?.id_doc_type,
        id_doc_number: cc?.id_doc_number,
        id_doc_expiry: cc?.id_doc_expiry,
        id_doc_issued_by: cc?.id_doc_issued_by,
        observations: 'Cabeça de casal (herança)',
      })
      const cabeca = await insertOwner(admin, cabecaData)
      createdOwnerIds.push(cabeca.id)

      await admin.from('property_owners').insert({
        property_id: propertyId,
        owner_id: cabeca.id,
        ownership_percentage: payload.primary.ownership_percentage ?? 0,
        is_main_contact: true,
      } as any)

      await registerDocs(
        admin,
        payload.files,
        cabeca.id,
        propertyId,
        uploadedBy,
        'singular_heranca_cabeca'
      )

      // ── Heirs ──
      const heirFilesByIndex = new Map<number, UploadedInviteFile[]>()
      for (const hf of payload.heir_files) {
        const arr = heirFilesByIndex.get(hf.heir_index) || []
        const { heir_index, ...rest } = hf
        arr.push(rest)
        heirFilesByIndex.set(heir_index, arr)
      }

      for (let i = 0; i < payload.heirs.length; i++) {
        const heir = payload.heirs[i]
        const heirDocs = heirFilesByIndex.get(i) || []
        const heirCc = heirDocs.find((f) => f.slot_slug === 'cc-passaporte')
        const extracted = heirCc ? await extractFromCC(heirCc) : null

        const heirData = cleanUndef({
          person_type: 'singular',
          name: (extracted?.name as string) || heir.name,
          email: heir.email,
          phone: heir.phone,
          nif: extracted?.nif,
          birth_date: extracted?.birth_date,
          nationality: extracted?.nationality,
          naturality: extracted?.naturality,
          id_doc_type: extracted?.id_doc_type,
          id_doc_number: extracted?.id_doc_number,
          id_doc_expiry: extracted?.id_doc_expiry,
          id_doc_issued_by: extracted?.id_doc_issued_by,
          marital_status: extracted?.marital_status,
          observations: 'Co-herdeiro',
        })
        const row = await insertOwner(admin, heirData)
        createdOwnerIds.push(row.id)

        await admin.from('property_owners').insert({
          property_id: propertyId,
          owner_id: row.id,
          ownership_percentage: heir.ownership_percentage ?? 0,
          is_main_contact: false,
        } as any)

        await registerDocs(
          admin,
          heirDocs,
          row.id,
          propertyId,
          uploadedBy,
          'singular_heranca_herdeiro'
        )
      }
    } else if (payload.mode === 'coletiva') {
      // ── Extract from certidão permanente + CC do rep ──
      const certFile = pickFile(payload.files, 'certidao-permanente')
      const repCc = pickFile(payload.files, 'cc-rep-legal')
      const [company, rep] = await Promise.all([
        certFile ? extractFromCertidaoPermanente(certFile) : Promise.resolve(null),
        repCc ? extractFromCC(repCc) : Promise.resolve(null),
      ])

      const ownerData = cleanUndef({
        person_type: 'coletiva',
        name: company?.name || payload.primary.name,
        email: payload.primary.email,
        phone: payload.primary.phone,
        nif: company?.nif,
        legal_nature: company?.legal_nature,
        cae_code: company?.cae_code,
        company_object: company?.company_object,
        legal_representative_name:
          company?.legal_representative_name || rep?.name,
        legal_representative_nif:
          company?.legal_representative_nif || rep?.nif,
        country_of_incorporation: company?.country_of_incorporation,
      })
      const owner = await insertOwner(admin, ownerData)
      createdOwnerIds.push(owner.id)

      await admin.from('property_owners').insert({
        property_id: propertyId,
        owner_id: owner.id,
        ownership_percentage: payload.primary.ownership_percentage ?? 100,
        is_main_contact: true,
      } as any)

      await registerDocs(
        admin,
        payload.files,
        owner.id,
        propertyId,
        uploadedBy,
        'coletiva'
      )
    }

    await (admin as any)
      .from('property_owner_invites')
      .update({
        status: 'completed',
        submitted_at: new Date().toISOString(),
        submitted_owner_ids: createdOwnerIds,
        submission_metadata: {
          mode: payload.mode,
          is_heranca:
            payload.mode === 'singular' ? payload.is_heranca : false,
        },
      })
      .eq('id', invite.id)

    return NextResponse.json({
      ok: true,
      owner_ids: createdOwnerIds,
    })
  } catch (err) {
    console.error('Erro ao submeter convite:', err)
    if (createdOwnerIds.length) {
      await admin.from('owners').delete().in('id', createdOwnerIds)
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Erro ao processar submissão' },
      { status: 500 }
    )
  }
}
