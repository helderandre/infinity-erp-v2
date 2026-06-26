import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import type {
  FinancialAnnualOverview, AnnualCategorySlice, AnnualMovement,
} from '@/types/financial'

const num = (v: any) => Number(v || 0)
const monthOf = (d: string) => parseInt(d.slice(5, 7), 10)
const inRange = (d: string | null, start: string, end: string) =>
  !!d && d >= start && d < end

function momentLabel(m: string | null): string | null {
  if (!m) return null
  const map: Record<string, string> = {
    cpcv: 'CPCV', escritura: 'Escritura', single: 'Pagamento',
  }
  return map[m] || m
}

// Visão geral anual da empresa (tab "Resumo" do Financeiro).
//
// Receita = comissão da agência dos deal_payments (lente agência: agency_amount).
//   • recebido   = recebido no ano
//   • faturado   = assinado no ano (contratado)
//   • a_receber  = assinado e ainda por receber (cumulativo)
// Despesa = company_transactions (type='expense') do ano.
// IVA a pagar = IVA liquidado (sobre receita) − IVA dedutível (sobre despesas).
//
// Nota: não somamos company_transactions type='income' porque o hook do Moloni
// espelha lá a comissão já contada via deal_payments → evita duplicação.
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const year = parseInt(
      searchParams.get('year') || String(new Date().getFullYear()), 10,
    )
    const yStart = `${year}-01-01`
    const yEnd = `${year + 1}-01-01`
    const prevStart = `${year - 1}-01-01`

    const supabase = await createClient()

    const [
      receivedRes, signedRes, expensesRes,
      categoriesRes, recurringRes, propertiesRes,
    ] = await Promise.all([
      // Todos os pagamentos recebidos (lente agência) — agregados em JS.
      (supabase as any).from('deal_payments')
        .select('id, agency_amount, consultant_amount, received_date, is_reported, consultant_paid, agency_invoice_amount_net, agency_invoice_amount_gross, payment_moment, deal_id')
        .eq('is_received', true),
      // Todos os pagamentos assinados.
      (supabase as any).from('deal_payments')
        .select('agency_amount, signed_date, is_received')
        .eq('is_signed', true),
      // Despesas do ano corrente + anterior (para deltas YoY).
      (supabase as any).from('company_transactions')
        .select('id, amount_gross, amount_net, vat_amount, category, date, entity_name, description')
        .eq('type', 'expense').neq('status', 'cancelled')
        .gte('date', prevStart).lt('date', yEnd),
      (supabase as any).from('company_categories').select('name, color, icon'),
      (supabase as any).from('company_recurring_templates')
        .select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('dev_properties')
        .select('listing_price').in('status', ['active', 'available']),
    ])

    const received = receivedRes.data || []
    const signed = signedRes.data || []
    const expenses = expensesRes.data || []
    const categories = categoriesRes.data || []

    // ── Receita (lente agência) ──────────────────────────────────────────
    let recebido = 0, recebidoPrev = 0, ivaLiquidado = 0
    let porReportar = 0, aPagarConsultores = 0
    const monthlyRecebido = new Array(12).fill(0)
    for (const p of received) {
      const a = num(p.agency_amount)
      if (inRange(p.received_date, yStart, yEnd)) {
        recebido += a
        monthlyRecebido[monthOf(p.received_date) - 1] += a
        const g = num(p.agency_invoice_amount_gross)
        const n = num(p.agency_invoice_amount_net)
        ivaLiquidado += g > 0 && n > 0 ? g - n : a * 0.23
      } else if (inRange(p.received_date, prevStart, yStart)) {
        recebidoPrev += a
      }
      // Tesouraria (cumulativo, independente do ano).
      if (p.is_reported === false) porReportar += a
      if (p.consultant_paid === false) aPagarConsultores += num(p.consultant_amount)
    }

    // ── Assinado no ano: faturado + a receber (deste ano) ────────────────
    // Ambos restritos ao ano para serem coerentes com o cabeçalho "Resultado {ano}".
    let faturado = 0, aReceber = 0
    for (const p of signed) {
      if (!inRange(p.signed_date, yStart, yEnd)) continue
      const a = num(p.agency_amount)
      faturado += a
      if (p.is_received === false) aReceber += a
    }

    // ── Despesas + categorias ─────────────────────────────────────────────
    let despesas = 0, despesasPrev = 0, ivaDedutivel = 0
    const monthlyDespesas = new Array(12).fill(0)
    const byCat: Record<string, number> = {}
    for (const t of expenses) {
      const g = num(t.amount_gross) || num(t.amount_net)
      if (inRange(t.date, yStart, yEnd)) {
        despesas += g
        monthlyDespesas[monthOf(t.date) - 1] += g
        ivaDedutivel += num(t.vat_amount) || Math.max(0, num(t.amount_gross) - num(t.amount_net))
        const cat = t.category || 'Outros'
        byCat[cat] = (byCat[cat] || 0) + g
      } else if (inRange(t.date, prevStart, yStart)) {
        despesasPrev += g
      }
    }

    // Join por nome normalizado (sem acentos / case / espaços) — o texto livre
    // em company_transactions.category sofre drift face a company_categories.name
    // (ex.: "Material Fisico" vs "Material Físico").
    const normCat = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
    const catMeta = new Map<string, { color: string | null; icon: string | null }>()
    for (const c of categories) catMeta.set(normCat(c.name), { color: c.color, icon: c.icon })

    const porCategoria: AnnualCategorySlice[] = Object.entries(byCat)
      .map(([category, amount]) => {
        const meta = catMeta.get(normCat(category))
        return {
          category,
          amount,
          pct: despesas > 0 ? Math.round((amount / despesas) * 100) : 0,
          color: meta?.color ?? null,
          icon: meta?.icon ?? null,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const maiorDespesa = porCategoria[0] ?? null

    // ── Movimentos recentes (receita de deals + despesas) ─────────────────
    // Junta os dois tipos, ordena uma única vez (comparador estável que devolve
    // 0 em empates) e corta — sem cortar por tipo antes do merge, para não
    // descartar movimentos mais recentes.
    type MovCandidate = AnnualMovement & { dealId?: string | null }
    const candidates: MovCandidate[] = [
      ...received
        .filter((p: any) => inRange(p.received_date, yStart, yEnd) && num(p.agency_amount) !== 0)
        .map((p: any): MovCandidate => ({
          id: `inc-${p.id}`,
          kind: 'income',
          dealId: p.deal_id ?? null,
          title: '',
          subtitle: momentLabel(p.payment_moment),
          date: p.received_date,
          amount: num(p.agency_amount),
        })),
      ...expenses
        .filter((t: any) => inRange(t.date, yStart, yEnd))
        .map((t: any): MovCandidate => ({
          id: `exp-${t.id}`,
          kind: 'expense',
          title: t.entity_name || t.description || t.category || 'Despesa',
          subtitle: t.category || null,
          date: t.date,
          amount: num(t.amount_gross) || num(t.amount_net),
        })),
    ]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 7)

    const dealIds = [...new Set(
      candidates
        .filter((m) => m.kind === 'income' && m.dealId)
        .map((m) => m.dealId as string),
    )]
    const dealRefs: Record<string, string | null> = {}
    if (dealIds.length) {
      const { data: deals } = await (supabase as any)
        .from('deals').select('id, reference').in('id', dealIds)
      for (const d of deals || []) dealRefs[d.id] = d.reference
    }

    const movimentos: AnnualMovement[] = candidates.map((m): AnnualMovement => ({
      id: m.id,
      kind: m.kind,
      title: m.kind === 'income'
        ? (m.dealId && dealRefs[m.dealId] ? `Comissão · ${dealRefs[m.dealId]}` : 'Comissão recebida')
        : m.title,
      subtitle: m.subtitle,
      date: m.date,
      amount: m.amount,
    }))

    const resultado = recebido - despesas
    const resultadoPrev = recebidoPrev - despesasPrev
    const margemPct = recebido > 0 ? Math.round((resultado / recebido) * 100) : 0
    const ivaAPagar = Math.max(0, ivaLiquidado - ivaDedutivel)
    const activeVolume = (propertiesRes.data || [])
      .reduce((s: number, p: any) => s + num(p.listing_price), 0)

    const payload: FinancialAnnualOverview = {
      year,
      recebido,
      faturado,
      a_receber: aReceber,
      despesas,
      resultado,
      margem_pct: margemPct,
      iva_liquidado: ivaLiquidado,
      iva_dedutivel: ivaDedutivel,
      iva_a_pagar: ivaAPagar,
      subscricoes_ativas: recurringRes.count || 0,
      prev: { recebido: recebidoPrev, despesas: despesasPrev, resultado: resultadoPrev },
      pipeline: { por_reportar: porReportar, a_pagar_consultores: aPagarConsultores },
      carteira: { volume: activeVolume, potencial: activeVolume * 0.05 },
      por_categoria: porCategoria,
      maior_despesa: maiorDespesa,
      faturacao_mensal: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        recebido: monthlyRecebido[i],
        despesas: monthlyDespesas[i],
      })),
      movimentos_recentes: movimentos,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro dashboard anual financeiro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
