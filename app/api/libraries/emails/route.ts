import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { emailTemplateSchema } from '@/lib/validations/email-template'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const categoriesCsv = searchParams.get('categories')

    let query = supabase
      .from('tpl_email_library')
      .select('id, name, subject, description, body_html, category, usage_count, created_at, updated_at, created_by, creator:dev_users!created_by(id, commercial_name)')
      .order('updated_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)
    }
    if (categoriesCsv) {
      const list = categoriesCsv.split(',').map((s) => s.trim()).filter(Boolean)
      if (list.includes('geral')) {
        const others = list.filter((c) => c !== 'geral')
        if (others.length > 0) {
          query = query.or(`category.is.null,category.in.(${[...others, 'geral'].join(',')})`)
        } else {
          query = query.or('category.is.null,category.eq.geral')
        }
      } else if (list.length > 0) {
        query = query.in('category', list)
      }
    } else if (category) {
      if (category === 'geral') {
        query = query.or('category.is.null,category.eq.geral')
      } else {
        query = query.eq('category', category)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar templates de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const parsed = emailTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Enforce scope: consultants always create as 'consultant' with their own scope_id
    const isBrokerRole = auth.roles.some((r: string) => ['admin', 'Broker/CEO'].includes(r))
    let scope = parsed.data.scope ?? (isBrokerRole ? 'global' : 'consultant')
    let scopeId = parsed.data.scope_id ?? null

    if (scope === 'consultant') {
      scopeId = auth.user.id
    } else if (scope === 'global' && !isBrokerRole) {
      // Non-brokers cannot create global templates — force consultant scope
      scope = 'consultant'
      scopeId = auth.user.id
    }

    const { data, error } = await supabase
      .from('tpl_email_library')
      .insert({ ...parsed.data, scope, scope_id: scopeId, created_by: auth.user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('unique') ? 400 : 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar template de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
