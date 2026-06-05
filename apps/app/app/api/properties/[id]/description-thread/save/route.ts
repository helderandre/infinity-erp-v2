import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { DESCRIPTION_LANGUAGES, type DescriptionLanguage } from '@/lib/properties/description-prompt'

/**
 * POST /api/properties/[id]/description-thread/save
 *
 * Body: { lang, text }
 *
 * Auto-save de edições manuais no documento:
 *  - Actualiza description_per_language[lang] em dev_properties.
 *  - Para PT, espelha em dev_properties.description (compat com portais).
 *  - Marca a thread correspondente como is_auto_generated=false (edição
 *    manual presente — auto-translate não pode sobrescrever a partir daqui).
 *
 * Idempotente: chamado a cada save debounced no canvas.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const body = (await request.json().catch(() => null)) as
      | { lang?: string; text?: string }
      | null
    if (!body) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const lang = (body.lang || 'pt') as DescriptionLanguage
    if (!DESCRIPTION_LANGUAGES.includes(lang)) {
      return NextResponse.json({ error: 'Idioma inválido' }, { status: 400 })
    }
    const text = typeof body.text === 'string' ? body.text : ''

    const supabase = await createClient()

    // Carregar per-language actual
    const { data: prop, error: propErr } = await supabase
      .from('dev_properties')
      .select('description_per_language')
      .eq('id', propertyId)
      .single()
    if (propErr) {
      if (propErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: propErr.message }, { status: 500 })
    }

    const perLang = (prop.description_per_language ?? {}) as Record<string, string>
    const newPerLang = { ...perLang, [lang]: text }

    const propUpdate: Record<string, unknown> = {
      description_per_language: newPerLang,
      updated_at: new Date().toISOString(),
    }
    if (lang === 'pt') propUpdate.description = text

    const { error: updErr } = await supabase
      .from('dev_properties')
      .update(propUpdate)
      .eq('id', propertyId)
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Marca thread como manualmente editada (edge case: thread ainda não existe)
    await supabase
      .from('property_description_threads')
      .update({ is_auto_generated: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('language', lang)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro a guardar descrição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
