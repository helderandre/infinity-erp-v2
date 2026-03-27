import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fillPdfOverlay } from '@/lib/pdf/fill-overlay'
import type { PdfTemplateField } from '@/types/pdf-overlay'

/**
 * POST — Generates a filled PDF contract from a submission's data.
 *
 * Uses the same PDF fill pipeline as the doc library system:
 * 1. Finds a linked contract template (PDF) in tpl_doc_library
 * 2. Fetches the PDF + its field mappings
 * 3. Maps submission fields to template variables
 * 4. Returns filled PDF
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const { submission_id, template_id } = body
    if (!submission_id) {
      return NextResponse.json({ error: 'ID da submissão é obrigatório.' }, { status: 400 })
    }

    // Fetch submission data
    const admin = createAdminClient() as any
    const { data: sub, error: subError } = await admin
      .from('recruitment_entry_submissions')
      .select('*')
      .eq('id', submission_id)
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Submissão não encontrada.' }, { status: 404 })
    }

    // Find the contract PDF template — check defaults first
    let tplId = template_id
    if (!tplId) {
      const { data: defaultEntry } = await admin
        .from('template_defaults')
        .select('template_id')
        .eq('section', 'contrato_entrada')
        .single()

      if (defaultEntry) {
        tplId = defaultEntry.template_id
      } else {
        // Fallback: search by name
        const { data: templates } = await admin
          .from('tpl_doc_library')
          .select('id')
          .eq('template_type', 'pdf')
          .ilike('name', '%contrato%prestacao%')
          .limit(1)

        if (templates && templates.length > 0) {
          tplId = templates[0].id
        }
      }
    }

    if (!tplId) {
      return NextResponse.json(
        { error: 'Nenhum template de contrato PDF encontrado. Carregue um template PDF na biblioteca de documentos com o nome "Contrato Prestação Serviços".' },
        { status: 404 }
      )
    }

    // Fetch template
    const { data: template, error: tplError } = await admin
      .from('tpl_doc_library')
      .select('id, name, file_url, template_type')
      .eq('id', tplId)
      .single()

    if (tplError || !template) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }
    if (!template.file_url) {
      return NextResponse.json({ error: 'Template não tem ficheiro PDF associado.' }, { status: 400 })
    }

    // Fetch PDF bytes
    const pdfResponse = await fetch(template.file_url)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Erro ao carregar ficheiro PDF do template.' }, { status: 500 })
    }
    const templateBytes = new Uint8Array(await pdfResponse.arrayBuffer())

    // Fetch overlay fields (new system) — fallback to old form-field mappings
    const { data: overlayFields } = await admin
      .from('pdf_template_fields')
      .select('*')
      .eq('template_id', tplId)
      .order('page_number')
      .order('sort_order')

    const fields = (overlayFields || []) as PdfTemplateField[]

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'Este template nao tem campos configurados. Abra o editor visual em Documentos > Templates e configure os campos.' },
        { status: 400 }
      )
    }

    // Build variables from submission data
    const variables: Record<string, string> = {
      nome_completo: sub.full_name || '',
      tipo_documento: sub.document_type || 'Cartão de Cidadão',
      cc_numero: sub.cc_number || '',
      cc_validade: sub.cc_expiry || '',
      cc_data_emissao: sub.cc_issue_date || '',
      data_nascimento: sub.date_of_birth || '',
      nif: sub.nif || '',
      niss: sub.niss || '',
      naturalidade: sub.naturalidade || '',
      nome_profissional: sub.display_name || '',
      estado_civil: sub.estado_civil || '',
      morada_completa: sub.full_address || '',
      telemovel: sub.professional_phone || '',
      email_pessoal: sub.personal_email || '',
      contacto_emergencia: sub.emergency_contact_name || '',
      telefone_emergencia: sub.emergency_contact_phone || '',
      data_contrato: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      data_hoje: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    }

    if (body.manual_values) {
      Object.assign(variables, body.manual_values)
    }

    // Fill PDF using overlay system
    const pdfBytes = await fillPdfOverlay(templateBytes, fields, variables)

    const fileName = `Contrato_${(sub.full_name || 'consultor').replace(/\s+/g, '_')}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('[entry-form/contract POST]', err)
    return NextResponse.json({ error: err?.message || 'Erro ao gerar contrato.' }, { status: 500 })
  }
}
