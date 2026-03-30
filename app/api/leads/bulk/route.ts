import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const bulkLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).transform(v => v || null),
  telemovel: z.string().optional().or(z.literal('')).transform(v => v || null),
  telefone: z.string().optional().or(z.literal('')).transform(v => v || null),
  origem: z.string().optional().transform(v => v || null),
  observacoes: z.string().optional().transform(v => v || null),
})

const bulkRequestSchema = z.object({
  leads: z.array(bulkLeadSchema).min(1, 'Pelo menos 1 lead é necessário').max(500, 'Máximo 500 leads por importação'),
  agent_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || null),
  default_origem: z.string().optional().transform(v => v || null),
})

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

    const { leads, agent_id, default_origem } = validation.data
    const supabase = await createClient()

    const results: { index: number; id?: string; error?: string; duplicate?: boolean }[] = []

    // Check for duplicates within the batch (by email or phone)
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]

      // Check internal duplicates
      if (lead.email) {
        if (seenEmails.has(lead.email.toLowerCase())) {
          results.push({ index: i, error: 'Email duplicado no ficheiro' })
          continue
        }
        seenEmails.add(lead.email.toLowerCase())
      }
      if (lead.telemovel) {
        const normalized = lead.telemovel.replace(/\s/g, '')
        if (seenPhones.has(normalized)) {
          results.push({ index: i, error: 'Telemóvel duplicado no ficheiro' })
          continue
        }
        seenPhones.add(normalized)
      }

      // Check DB duplicates
      if (lead.email) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('email', lead.email)
          .limit(1)
          .single()
        if (existing) {
          results.push({ index: i, id: existing.id, duplicate: true, error: 'Contacto já existe (email)' })
          continue
        }
      }
      if (lead.telemovel) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('telemovel', lead.telemovel.replace(/\s/g, ''))
          .limit(1)
          .single()
        if (existing) {
          results.push({ index: i, id: existing.id, duplicate: true, error: 'Contacto já existe (telemóvel)' })
          continue
        }
      }

      // Insert
      const { data: created, error } = await supabase
        .from('leads')
        .insert({
          nome: lead.nome,
          email: lead.email,
          telemovel: lead.telemovel,
          telefone: lead.telefone,
          origem: lead.origem || default_origem,
          observacoes: lead.observacoes,
          agent_id: agent_id,
        })
        .select('id')
        .single()

      if (error) {
        results.push({ index: i, error: error.message })
      } else {
        results.push({ index: i, id: created.id })
      }
    }

    // Notify assigned agent about bulk import
    const created = results.filter(r => r.id && !r.duplicate)
    if (agent_id && agent_id !== auth.user.id && created.length > 0) {
      const db = createCrmAdminClient()
      Promise.resolve(db.from('leads_notifications').insert({
        recipient_id: agent_id,
        type: 'new_lead',
        title: 'Importação em massa',
        body: `${created.length} lead${created.length !== 1 ? 's' : ''} ${created.length !== 1 ? 'foram' : 'foi'} importada${created.length !== 1 ? 's' : ''} e atribuída${created.length !== 1 ? 's' : ''} a si.`,
        link: '/dashboard/crm/contactos',
      })).then(() => {}).catch(() => {})
    }

    const successCount = created.length
    const duplicateCount = results.filter(r => r.duplicate).length
    const errorCount = results.filter(r => r.error && !r.duplicate).length

    return NextResponse.json({
      success: successCount,
      duplicates: duplicateCount,
      errors: errorCount,
      total: leads.length,
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
