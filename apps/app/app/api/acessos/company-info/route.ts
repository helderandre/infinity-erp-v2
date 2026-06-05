import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import type {
  AcessosCompanyInfoPayload,
  ConvictusCompanyData,
  FaturacaoCompanyData,
} from '@/types/acessos'

const FATURACAO_FALLBACK: FaturacaoCompanyData = {
  nome: 'LECOQIMMO - MEDIAÇÃO IMOBILIÁRIA, UNIPESSOAL LDA',
  sede: 'Avenida da Liberdade, Nº 129 B 1250-140 Lisboa',
  nipc: '514828528',
}

const CONVICTUS_FALLBACK: ConvictusCompanyData = {
  agencia: {
    nome: 'RE/MAX COLLECTION CONVICTUS',
    morada: 'Avenida Ressano Garcia, 37 A 1070-234 Lisboa',
    telefone: '218 036 779',
  },
  sede: {
    nome: 'RE/MAX CONVICTUS',
    morada: 'Av. das Forças Armadas 22 C 1600-082 Lisboa',
    telefone: '217978189',
    ami: '4719',
  },
}

export async function GET() {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('acessos_company_info')
      .select('scope, data')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as { scope: string; data: unknown }[]
    const faturacao = (rows.find((r) => r.scope === 'faturacao')?.data as
      | FaturacaoCompanyData
      | undefined) ?? FATURACAO_FALLBACK
    const convictus = (rows.find((r) => r.scope === 'convictus')?.data as
      | ConvictusCompanyData
      | undefined) ?? CONVICTUS_FALLBACK

    const canManage = await hasPermissionServer(supabase, user.id, 'settings')

    const payload: AcessosCompanyInfoPayload = {
      faturacao,
      convictus,
      can_manage: canManage,
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('Erro ao carregar estrutura de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
