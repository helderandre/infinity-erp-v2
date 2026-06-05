import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { DESCRIPTION_LANGUAGES, type DescriptionLanguage } from '@/lib/properties/description-prompt'

function parseLang(searchParams: URLSearchParams): DescriptionLanguage {
  const raw = (searchParams.get('lang') || 'pt') as DescriptionLanguage
  return DESCRIPTION_LANGUAGES.includes(raw) ? raw : 'pt'
}

/**
 * GET /api/properties/[id]/description-thread?lang=pt
 *
 * Devolve a thread (criando-a lazy se ainda não existir), as mensagens
 * ordenadas, e o documento actual desse idioma.
 *
 * Para PT: documento = description_per_language.pt OR dev_properties.description (fallback).
 * Para outros: documento = description_per_language[lang] OR ''.
 *
 * Se a thread está vazia mas existe um documento histórico (description em PT
 * pré-canvas), injecta uma mensagem assistant sintética com o snapshot inicial
 * para a UI mostrar como ponto de partida.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const { searchParams } = new URL(request.url)
    const lang = parseLang(searchParams)

    const supabase = await createClient()

    // Property lookup — para descrição PT fallback e para validar acesso.
    const { data: prop, error: propErr } = await supabase
      .from('dev_properties')
      .select('id, description, description_per_language')
      .eq('id', propertyId)
      .single()

    if (propErr) {
      if (propErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: propErr.message }, { status: 500 })
    }

    const perLang = (prop.description_per_language ?? {}) as Record<string, string>
    const currentDocument =
      perLang[lang] ?? (lang === 'pt' ? (prop.description ?? '') : '')

    // Thread lookup-or-create
    let { data: thread, error: threadErr } = await supabase
      .from('property_description_threads')
      .select('*')
      .eq('property_id', propertyId)
      .eq('language', lang)
      .maybeSingle()

    if (threadErr && threadErr.code !== 'PGRST116') {
      return NextResponse.json({ error: threadErr.message }, { status: 500 })
    }

    if (!thread) {
      const { data: created, error: createErr } = await supabase
        .from('property_description_threads')
        .insert({
          property_id: propertyId,
          language: lang,
          created_by: auth.user.id,
        })
        .select()
        .single()
      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
      thread = created
    }

    // Messages
    const { data: messages, error: msgErr } = await supabase
      .from('property_description_messages')
      .select('id, role, content, document_snapshot, selection_text, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Synthetic seed: thread vazia + documento existente (legado pré-canvas) →
    // mostra como ponto de partida. NÃO é guardada em DB; vive só na resposta.
    let resolvedMessages = messages || []
    if (resolvedMessages.length === 0 && currentDocument.trim()) {
      resolvedMessages = [
        {
          id: 'seed-' + thread.id,
          role: 'assistant',
          content:
            lang === 'pt'
              ? 'Descrição importada do estado anterior. Diz-me o que queres alterar.'
              : 'Imported existing description. Tell me what you would like to change.',
          document_snapshot: currentDocument,
          selection_text: null,
          created_at: thread.created_at,
        } as typeof resolvedMessages[number],
      ]
    }

    return NextResponse.json({
      thread,
      messages: resolvedMessages,
      current_document: currentDocument,
    })
  } catch (error) {
    console.error('Erro ao obter description thread:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/properties/[id]/description-thread?lang=pt
 *
 * Reset: apaga as mensagens, mantém a thread + documento. Útil para
 * "começar conversa do zero" sem perder o conteúdo já guardado.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const { searchParams } = new URL(request.url)
    const lang = parseLang(searchParams)

    const supabase = await createClient()

    const { data: thread } = await supabase
      .from('property_description_threads')
      .select('id')
      .eq('property_id', propertyId)
      .eq('language', lang)
      .maybeSingle()

    if (!thread) {
      return NextResponse.json({ ok: true, deleted: 0 })
    }

    const { error } = await supabase
      .from('property_description_messages')
      .delete()
      .eq('thread_id', thread.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao reset description thread:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
