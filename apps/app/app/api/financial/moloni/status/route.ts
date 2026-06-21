import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { moloniConfigured, getActiveCompany } from '@/lib/moloni/client'

export const runtime = 'nodejs'

/**
 * GET /api/financial/moloni/status
 * Health check for the Moloni connection. Returns whether the env vars are set
 * and whether we can resolve an active company (bootstraps the token on first
 * call). Used by the UI to show a "ligado / não configurado" indicator.
 */
export async function GET() {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    if (!moloniConfigured()) {
      return NextResponse.json({ configured: false, connected: false, company: null })
    }

    try {
      const company = await getActiveCompany()
      return NextResponse.json({
        configured: true,
        connected: true,
        company: { id: company.companyId, name: company.name },
      })
    } catch (e: any) {
      return NextResponse.json({
        configured: true,
        connected: false,
        company: null,
        error: e?.message ?? 'Falha na ligação ao Moloni',
      })
    }
  } catch (error) {
    console.error('Erro no status Moloni:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
