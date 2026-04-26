import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

/**
 * Bulk import of LEADS (`leads_entries` table = inbound entries). Each CSV
 * row creates BOTH:
 *   - a new row in `leads` (the contact this entry belongs to), since
 *     `leads_entries.contact_id` is NOT NULL.
 *   - a new row in `leads_entries` linked to that contact.
 *
 * Defaults:
 *   - "create anyway": no DB-side dedup. The matching/merge step lives on
 *     the contactos page; this importer just inserts.
 *   - default `assigned_consultant_id` & `assigned_agent_id` = the importer.
 *   - default source = 'csv_import' (overridable per row or via
 *     `default_source`).
 */

const bulkEntrySchema = z.object({
  // Contact-level fields (go into `leads`)
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).transform(v => v || null),
  telemovel: z.string().optional().or(z.literal('')).transform(v => v || null),
  telefone: z.string().optional().or(z.literal('')).transform(v => v || null),
  observacoes: z.string().optional().transform(v => v || null),
  // Entry-level fields (go into `leads_entries`)
  source: z.string().optional().transform(v => v || null),
  campaign: z.string().optional().or(z.literal('')).transform(v => v || null),
  utm_source: z.string().optional().or(z.literal('')).transform(v => v || null),
  utm_medium: z.string().optional().or(z.literal('')).transform(v => v || null),
  utm_campaign: z.string().optional().or(z.literal('')).transform(v => v || null),
  notes: z.string().optional().or(z.literal('')).transform(v => v || null),
  property_external_ref: z.string().optional().or(z.literal('')).transform(v => v || null),
  sector: z.string().optional().or(z.literal('')).transform(v => v || null),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().or(z.literal('')).transform(v => (v || 'medium') as 'low' | 'medium' | 'high' | 'urgent'),
})

const bulkRequestSchema = z.object({
  entries: z.array(bulkEntrySchema).min(1, 'Pelo menos 1 lead é necessário').max(2000, 'Máximo 2000 leads por importação'),
  assigned_consultant_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || null),
  default_source: z.string().optional().transform(v => v || 'csv_import'),
  default_priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  default_status: z.enum(['new', 'qualified', 'contacted', 'archived']).default('new'),
  file_name: z.string().optional(),
  consentimento_contacto: z.boolean().default(true),
})

function normalisePhone(s: string | null): string | null {
  if (!s) return null
  const digits = s.replace(/[^\d+]/g, '')
  return digits || null
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
        { status: 400 },
      )
    }

    const {
      entries,
      assigned_consultant_id,
      default_source,
      default_priority,
      default_status,
      file_name,
      consentimento_contacto,
    } = validation.data

    const supabase = await createClient()
    const adminDb = createCrmAdminClient() as any

    const effectiveConsultantId = assigned_consultant_id || auth.user.id

    // Create the batch record up-front
    const { data: batchRow, error: batchErr } = await adminDb
      .from('lead_import_batches')
      .insert({
        imported_by: auth.user.id,
        target_table: 'leads_entries',
        file_name: file_name || null,
        options: {
          assigned_consultant_id: effectiveConsultantId,
          default_source,
          default_priority,
          default_status,
          consentimento_contacto,
        },
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

    const results: { index: number; contact_id?: string; entry_id?: string; error?: string }[] = []
    const errorEntries: { index: number; error: string }[] = []
    let insertedTotal = 0

    // We need atomic per-row contact+entry creation. Do it per-row rather
    // than batched so a failure in one row doesn't poison the rest.
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      try {
        // 1) Insert the contact
        const { data: contact, error: contactErr } = await supabase
          .from('leads')
          .insert({
            nome: entry.nome,
            email: entry.email ? entry.email.toLowerCase().trim() : null,
            telemovel: normalisePhone(entry.telemovel),
            telefone: normalisePhone(entry.telefone),
            origem: entry.source || default_source,
            observacoes: entry.observacoes,
            agent_id: effectiveConsultantId,
            consentimento_contacto,
            consentimento_webmarketing: false,
            import_batch_id: batchId,
          })
          .select('id')
          .single()

        if (contactErr || !contact) {
          const msg = contactErr?.message || 'Erro ao criar contacto'
          results.push({ index: i, error: msg })
          errorEntries.push({ index: i, error: msg })
          continue
        }

        // 2) Insert the entry linked to that contact
        const { data: entryRow, error: entryErr } = await supabase
          .from('leads_entries')
          .insert({
            contact_id: contact.id,
            source: entry.source || default_source,
            status: default_status,
            priority: entry.priority || default_priority,
            assigned_consultant_id: effectiveConsultantId,
            assigned_agent_id: effectiveConsultantId,
            raw_name: entry.nome,
            raw_email: entry.email || null,
            raw_phone: normalisePhone(entry.telemovel) || normalisePhone(entry.telefone),
            utm_source: entry.utm_source,
            utm_medium: entry.utm_medium,
            utm_campaign: entry.utm_campaign,
            notes: entry.notes || entry.observacoes,
            property_external_ref: entry.property_external_ref,
            sector: entry.sector,
            sla_status: 'pending',
            import_batch_id: batchId,
          })
          .select('id')
          .single()

        if (entryErr || !entryRow) {
          const msg = entryErr?.message || 'Erro ao criar entry'
          results.push({ index: i, contact_id: contact.id, error: msg })
          errorEntries.push({ index: i, error: msg })
          continue
        }

        results.push({ index: i, contact_id: contact.id, entry_id: entryRow.id })
        insertedTotal++
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        results.push({ index: i, error: msg })
        errorEntries.push({ index: i, error: msg })
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

    return NextResponse.json({
      success: insertedTotal,
      errors: errorEntries.length,
      total: entries.length,
      batch_id: batchId,
      results,
    }, { status: 201 })
  } catch (error) {
    console.error('Erro na importação em massa de leads_entries:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
