import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import {
  convictusSchema,
  faturacaoSchema,
} from '@/lib/validations/acessos-company-info'

const SCHEMAS = {
  faturacao: faturacaoSchema,
  convictus: convictusSchema,
} as const

// log_audit.entity_id é UUID NOT NULL — mapa de IDs estáveis por scope
const SCOPE_AUDIT_IDS = {
  faturacao: 'a00ace50-fa70-4ac0-8000-000000000001',
  convictus: 'a00ace50-c0c0-4ffe-8000-000000000002',
} as const

type Scope = keyof typeof SCHEMAS

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ scope: string }> }
) {
  try {
    const { scope } = await params
    if (scope !== 'faturacao' && scope !== 'convictus') {
      return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
    }
    const typedScope = scope as Scope

    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const canManage = await hasPermissionServer(supabase, user.id, 'settings')
    if (!canManage) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = SCHEMAS[typedScope].safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: oldRow } = await supabase
      .from('acessos_company_info')
      .select('data')
      .eq('scope', typedScope)
      .maybeSingle()

    const { data, error } = await supabase
      .from('acessos_company_info')
      .upsert(
        { scope: typedScope, data: parsed.data, updated_by: user.id },
        { onConflict: 'scope' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'acessos_company_info',
      entity_id: SCOPE_AUDIT_IDS[typedScope],
      action: 'acessos_company_info.update',
      old_data: oldRow?.data ?? null,
      new_data: parsed.data,
    })

    return NextResponse.json({ scope: typedScope, data: data.data })
  } catch (err) {
    console.error('Erro ao actualizar estrutura de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
