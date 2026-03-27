import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * POST — AI-detect fillable fields on a PDF template.
 *
 * Converts PDF pages to images, sends to GPT-4 Vision,
 * returns detected field positions + suggested variable keys.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    // Fetch template
    const admin = createAdminClient() as any
    const { data: template } = await admin
      .from('tpl_doc_library')
      .select('id, name, file_url, template_type')
      .eq('id', id)
      .single()

    if (!template?.file_url) {
      return NextResponse.json({ error: 'Template nao encontrado ou sem ficheiro' }, { status: 404 })
    }

    // Get page images from request body (rendered client-side via pdf.js)
    const body = await request.json()
    const { page_images } = body as { page_images: { page: number; data_url: string }[] }

    if (!page_images?.length) {
      return NextResponse.json({ error: 'Nenhuma imagem de pagina fornecida' }, { status: 400 })
    }

    const allFields: any[] = []

    for (const pageImg of page_images) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing document templates. You identify blank spaces, lines, or areas where data should be filled in.

For each fillable field you find, return a JSON object with:
- x_percent: horizontal position from left edge (0-100)
- y_percent: vertical position from top edge (0-100)
- width_percent: width of the field area (0-100)
- height_percent: height of the field area (0-100)
- variable_key: a snake_case identifier (use Portuguese convention: nome_completo, nif, morada_completa, data_nascimento, cc_numero, cc_validade, estado_civil, naturalidade, niss, telemovel, email, iban, data_contrato, empresa, taxa_comissao, salario_base, etc.)
- display_label: human-readable Portuguese label
- confidence: 0 to 1

Only return fillable blank spaces — NOT pre-printed text or headings.
Return ONLY a JSON array, no markdown, no explanation.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze page ${pageImg.page} of this document template. Find all blank/fillable areas and return their positions and suggested variable names as a JSON array.`,
              },
              {
                type: 'image_url',
                image_url: { url: pageImg.data_url, detail: 'high' },
              },
            ],
          },
        ],
      })

      const content = response.choices[0]?.message?.content?.trim() || '[]'
      try {
        // Strip markdown code blocks if present
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        const fields = JSON.parse(cleaned)
        if (Array.isArray(fields)) {
          allFields.push(
            ...fields.map((f: any) => ({
              page_number: pageImg.page,
              x_percent: Math.max(0, Math.min(100, Number(f.x_percent) || 0)),
              y_percent: Math.max(0, Math.min(100, Number(f.y_percent) || 0)),
              width_percent: Math.max(1, Math.min(100, Number(f.width_percent) || 20)),
              height_percent: Math.max(0.5, Math.min(20, Number(f.height_percent) || 3)),
              variable_key: String(f.variable_key || 'campo').replace(/\s+/g, '_').toLowerCase(),
              display_label: String(f.display_label || f.variable_key || 'Campo'),
              confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.5)),
            }))
          )
        }
      } catch {
        console.error('[detect-fields] Failed to parse AI response for page', pageImg.page, content)
      }
    }

    return NextResponse.json({ fields: allFields })
  } catch (err: any) {
    console.error('[detect-fields]', err)
    return NextResponse.json({ error: err?.message || 'Erro na deteccao de campos' }, { status: 500 })
  }
}
