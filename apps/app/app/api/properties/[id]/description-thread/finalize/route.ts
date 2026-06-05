import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'
import {
  TRANSLATE_SYSTEM_PROMPT_PT_TO_OTHER,
  type DescriptionLanguage,
} from '@/lib/properties/description-prompt'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/properties/[id]/description-thread/finalize
 *
 * Quando o utilizador fecha o editor, dispara auto-translate da PT para
 * EN e FR, e persiste em description_per_language. Idempotente:
 *
 *  - Só sobrescreve threads onde is_auto_generated=true.
 *    Se o utilizador editou EN ou FR à mão (is_auto_generated=false),
 *    a tradução automática NÃO toca nesse idioma.
 *  - Se a thread EN/FR não existe, cria-a com is_auto_generated=true.
 *  - Se PT está vazia, no-op (não há nada para traduzir).
 *
 * Resposta: { translated: ['en', 'fr'], skipped: [{lang, reason}] }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const supabase = await createClient()

    // Carregar PT como source
    const { data: prop, error: propErr } = await supabase
      .from('dev_properties')
      .select('description, description_per_language')
      .eq('id', propertyId)
      .single()
    if (propErr || !prop) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }
    const perLang = (prop.description_per_language ?? {}) as Record<string, string>
    const sourcePt = (perLang.pt ?? prop.description ?? '').trim()

    if (!sourcePt) {
      return NextResponse.json({ translated: [], skipped: [{ lang: 'pt', reason: 'empty_source' }] })
    }

    const targets: DescriptionLanguage[] = ['en', 'fr', 'es']
    const openai = new OpenAI({ apiKey })

    const translated: string[] = []
    const skipped: Array<{ lang: string; reason: string }> = []
    const newPerLang: Record<string, string> = { ...perLang, pt: sourcePt }

    for (const target of targets) {
      // Verifica se a thread target permite overwrite
      const { data: targetThread } = await supabase
        .from('property_description_threads')
        .select('id, is_auto_generated')
        .eq('property_id', propertyId)
        .eq('language', target)
        .maybeSingle()

      if (targetThread && targetThread.is_auto_generated === false) {
        skipped.push({ lang: target, reason: 'manual_edits_present' })
        continue
      }

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 3000,
          messages: [
            { role: 'system', content: TRANSLATE_SYSTEM_PROMPT_PT_TO_OTHER(target) },
            { role: 'user', content: sourcePt },
          ],
        })
        const translation = completion.choices[0]?.message?.content?.trim()
        if (!translation) {
          skipped.push({ lang: target, reason: 'empty_translation' })
          continue
        }

        newPerLang[target] = translation

        // Lookup-or-create thread
        let threadId = targetThread?.id
        if (!threadId) {
          const { data: created } = await supabase
            .from('property_description_threads')
            .insert({
              property_id: propertyId,
              language: target,
              is_auto_generated: true,
              created_by: auth.user.id,
            })
            .select('id')
            .single()
          threadId = created?.id
        } else {
          await supabase
            .from('property_description_threads')
            .update({ is_auto_generated: true, updated_at: new Date().toISOString() })
            .eq('id', threadId)
          // Para repor um snapshot limpo: limpar mensagens anteriores
          await supabase
            .from('property_description_messages')
            .delete()
            .eq('thread_id', threadId)
        }

        // Mensagem assistant sintética com o snapshot (ponto de partida visível)
        if (threadId) {
          await supabase.from('property_description_messages').insert({
            thread_id: threadId,
            role: 'assistant',
            content: `Tradução automática a partir do PT (${target.toUpperCase()}). Diz-me o que queres ajustar.`,
            document_snapshot: translation,
          })
        }

        translated.push(target)
      } catch (err) {
        console.error(`Erro a traduzir para ${target}:`, err)
        skipped.push({
          lang: target,
          reason: err instanceof Error ? err.message : 'unknown_error',
        })
      }
    }

    // Persistir per-language em dev_properties
    await supabase
      .from('dev_properties')
      .update({
        description_per_language: newPerLang,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)

    return NextResponse.json({ translated, skipped })
  } catch (error) {
    console.error('Erro no finalize description-thread:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
