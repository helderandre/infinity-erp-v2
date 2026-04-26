import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

/**
 * Bulk import of CONTACTOS (`leads` table). Creates one row per CSV line.
 *
 * Defaults — per product decisions:
 *   - "create anyway": no DB-side dedup. The matching/merge step happens
 *     downstream on the contactos page; the importer just dumps rows in.
 *   - default `agent_id` is the user performing the import (overridable).
 *   - `consentimento_contacto` defaults to true (these contacts came in via
 *     a consultor, so consent is implicit; the dialog has a toggle if not).
 */

const bulkLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).transform(v => v || null),
  telemovel: z.string().optional().or(z.literal('')).transform(v => v || null),
  telefone: z.string().optional().or(z.literal('')).transform(v => v || null),
  telefone_fixo: z.string().optional().or(z.literal('')).transform(v => v || null),
  origem: z.string().optional().transform(v => v || null),
  observacoes: z.string().optional().transform(v => v || null),
  nif: z.string().optional().or(z.literal('')).transform(v => v || null),
  empresa: z.string().optional().or(z.literal('')).transform(v => v || null),
  morada: z.string().optional().or(z.literal('')).transform(v => v || null),
  codigo_postal: z.string().optional().or(z.literal('')).transform(v => v || null),
  localidade: z.string().optional().or(z.literal('')).transform(v => v || null),
  lead_type: z.string().optional().or(z.literal('')).transform(v => v || null),
  temperatura: z.string().optional().or(z.literal('')).transform(v => v || null),
})

const bulkRequestSchema = z.object({
  leads: z.array(bulkLeadSchema).min(1, 'Pelo menos 1 contacto é necessário').max(2000, 'Máximo 2000 contactos por importação'),
  agent_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || null),
  default_origem: z.string().optional().transform(v => v || null),
  file_name: z.string().optional(),
  consentimento_contacto: z.boolean().default(true),
  consentimento_webmarketing: z.boolean().default(false),
})

/** Normalise a Portuguese phone string to digits only (no formatting). */
function normalisePhone(s: string | null): string | null {
  if (!s) return null
  const digits = s.replace(/[^\d+]/g, '')
  if (!digits) return null
  return digits
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads') as any
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = bulkRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { leads, agent_id, default_origem, file_name, consentimento_contacto, consentimento_webmarketing } = validation.data
    const supabase = await createClient()
    const adminDb = createCrmAdminClient() as any

    // Default agent_id to importer if not specified
    const effectiveAgentId = agent_id || auth.user.id

    // Create batch record FIRST so we can stamp its id on every row.
    const { data: batchRow, error: batchErr } = await adminDb
      .from('lead_import_batches')
      .insert({
        imported_by: auth.user.id,
        target_table: 'leads',
        file_name: file_name || null,
        options: { agent_id: effectiveAgentId, default_origem, consentimento_contacto, consentimento_webmarketing },
      })
      .select('id')
      .single()
    if (batchErr || !batchRow) {
      return NextResponse.json(
        { error: 'Erro ao criar registo do lote', details: batchErr?.message },
        { status: 500 },
      )
    }
    const batchId = (batchRow as { id: string }).id

    const results: { index: number; id?: string; error?: string }[] = []
    const errorEntries: { index: number; error: string }[] = []

    // Build rows for batch insert
    type LeadInsert = {
      nome: string
      email: string | null
      telemovel: string | null
      telefone: string | null
      telefone_fixo: string | null
      origem: string | null
      observacoes: string | null
      nif: string | null
      empresa: string | null
      morada: string | null
      codigo_postal: string | null
      localidade: string | null
      lead_type: string | null
      temperatura: string | null
      agent_id: string
      consentimento_contacto: boolean
      consentimento_webmarketing: boolean
      tem_empresa: boolean
      import_batch_id: string
    }

    const rows: LeadInsert[] = leads.map((lead) => ({
      nome: lead.nome,
      email: lead.email ? lead.email.toLowerCase().trim() : null,
      telemovel: normalisePhone(lead.telemovel),
      telefone: normalisePhone(lead.telefone),
      telefone_fixo: normalisePhone(lead.telefone_fixo),
      origem: lead.origem || default_origem,
      observacoes: lead.observacoes,
      nif: lead.nif,
      empresa: lead.empresa,
      morada: lead.morada,
      codigo_postal: lead.codigo_postal,
      localidade: lead.localidade,
      lead_type: lead.lead_type,
      temperatura: lead.temperatura,
      agent_id: effectiveAgentId,
      consentimento_contacto,
      consentimento_webmarketing,
      tem_empresa: !!lead.empresa,
      import_batch_id: batchId,
    }))

    // Insert in chunks of 500 to keep payloads manageable.
    const CHUNK = 500
    let insertedTotal = 0
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(chunk)
        .select('id')
      if (error) {
        // Fall back to per-row inserts so partial success is preserved.
        for (let j = 0; j < chunk.length; j++) {
          const idx = i + j
          const { data: one, error: oneErr } = await supabase
            .from('leads')
            .insert(chunk[j])
            .select('id')
            .single()
          if (oneErr || !one) {
            const msg = oneErr?.message || 'Erro desconhecido'
            results.push({ index: idx, error: msg })
            errorEntries.push({ index: idx, error: msg })
          } else {
            results.push({ index: idx, id: one.id })
            insertedTotal++
          }
        }
      } else {
        for (let j = 0; j < (inserted?.length || 0); j++) {
          results.push({ index: i + j, id: inserted![j].id })
        }
        insertedTotal += inserted?.length || 0
      }
    }

    // Update batch with final counts
    await adminDb
      .from('lead_import_batches')
      .update({
        inserted_count: insertedTotal,
        failed_count: errorEntries.length,
        errors: errorEntries.length ? errorEntries : null,
      })
      .eq('id', batchId)

    // Notify assigned agent if it's not the importer themselves
    if (agent_id && agent_id !== auth.user.id && insertedTotal > 0) {
      adminDb.from('leads_notifications').insert({
        recipient_id: agent_id,
        type: 'new_lead',
        title: 'Importação em massa',
        body: `${insertedTotal} contacto${insertedTotal !== 1 ? 's' : ''} importado${insertedTotal !== 1 ? 's' : ''} e atribuído${insertedTotal !== 1 ? 's' : ''} a si.`,
        link: '/dashboard/crm/contactos',
      }).then(() => {}).catch(() => {})
    }

    return NextResponse.json({
      success: insertedTotal,
      errors: errorEntries.length,
      total: leads.length,
      batch_id: batchId,
      results,
    }, { status: 201 })
  } catch (error) {
    console.error('Erro na importação em massa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
