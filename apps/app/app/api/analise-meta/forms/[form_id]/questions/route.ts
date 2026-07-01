/**
 * GET /api/analise-meta/forms/[form_id]/questions
 *
 * Versão leve do bundle do formulário: devolve APENAS a definição das perguntas
 * (label + type + options) para humanizar respostas de leads Meta fora da secção
 * Análise → Meta (ex.: ficha do leads_entry, cartão de origem do negócio). Sem o
 * scan de estatísticas do endpoint completo, e cacheável.
 *
 * Auth: qualquer sessão autenticada (a definição do formulário não é sensível);
 * lê o schema `meta` (service-role-only) via admin client.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const { form_id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()
  const { data: form } = await db
    .schema('meta')
    .from('meta_forms_raw')
    .select('form_id, form_name, payload')
    .eq('form_id', form_id)
    .maybeSingle()

  if (!form) return NextResponse.json({ form_id, form_name: null, questions: [] })

  const questions =
    (form.payload as { form?: { questions?: unknown[] } } | null)?.form?.questions ?? []

  return NextResponse.json(
    { form_id: form.form_id, form_name: form.form_name, questions },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
