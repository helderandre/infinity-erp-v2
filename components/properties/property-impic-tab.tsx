'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  ShieldCheck, ShieldAlert, ExternalLink, Copy, CheckCircle2, XCircle,
  User, FileText, Banknote, AlertTriangle, Building2, Calendar, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const IMPIC_PORTAL_URL = 'https://www.impic.pt/areareservada/login.xhtml'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  low:    { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Baixo' },
  medium: { bg: 'bg-amber-500/10',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Médio' },
  high:   { bg: 'bg-red-500/10',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Alto' },
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Rascunho',  bg: 'bg-slate-500/10', text: 'text-slate-600' },
  pending:   { label: 'Pendente',  bg: 'bg-amber-500/10', text: 'text-amber-600' },
  reported:  { label: 'Reportado', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  flagged:   { label: 'Sinalizado', bg: 'bg-red-500/10', text: 'text-red-600' },
}

interface Deal {
  id: string
  reference: string | null
  deal_type: string
  deal_value: number
  deal_date: string
  status: string
  consultant: { commercial_name: string } | null
}

interface Compliance {
  id: string
  deal_id: string
  buyer_name: string | null
  buyer_nif: string | null
  buyer_cc_number: string | null
  buyer_nationality: string | null
  buyer_address: string | null
  buyer_pep_check: boolean
  buyer_pep_result: string | null
  buyer_risk_level: string | null
  buyer_funds_origin: string | null
  buyer_funds_declared: boolean
  buyer_docs_complete: boolean
  seller_name: string | null
  seller_nif: string | null
  seller_cc_number: string | null
  seller_nationality: string | null
  seller_address: string | null
  seller_pep_check: boolean
  seller_pep_result: string | null
  seller_risk_level: string | null
  seller_is_company: boolean
  seller_beneficial_owner: string | null
  seller_docs_complete: boolean
  payment_method: string | null
  cash_amount: number | null
  overall_risk_level: string
  impic_reported: boolean
  impic_report_date: string | null
  impic_reference: string | null
  impic_quarter: string | null
  impic_notes: string | null
  suspicious_activity_reported: boolean
  suspicious_activity_date: string | null
  suspicious_activity_ref: string | null
  status: string
  created_at: string
}

interface DealWithCompliance {
  deal: Deal
  compliance: Compliance | null
}

interface PropertyImpicTabProps {
  propertyId: string
  propertyTitle?: string
  owners?: Array<{
    owners: { name: string; nif: string | null; email: string | null; phone: string | null } | null
    ownership_percentage: number
  }>
}

export function PropertyImpicTab({ propertyId, propertyTitle, owners }: PropertyImpicTabProps) {
  const [deals, setDeals] = useState<DealWithCompliance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<DealWithCompliance | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/impic`)
      if (res.ok) {
        const data = await res.json()
        setDeals(data)
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [propertyId])

  useEffect(() => { fetchData() }, [fetchData])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  // Info card helper
  function InfoRow({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
    if (!value) return null
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-right">{value}</span>
          {copyable && (
            <button onClick={() => copyToClipboard(value, label)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  function KycCard({ title, icon: Icon, name, nif, cc, nationality, address, pepCheck, riskLevel, docsComplete, extra }: {
    title: string; icon: React.ElementType; name: string | null; nif: string | null; cc: string | null
    nationality: string | null; address: string | null; pepCheck: boolean; riskLevel: string | null
    docsComplete: boolean; extra?: React.ReactNode
  }) {
    const risk = RISK_COLORS[riskLevel || 'low'] || RISK_COLORS.low
    return (
      <div className="rounded-xl bg-muted/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <Icon className="h-3 w-3" />{title}
          </p>
          <div className="flex items-center gap-1.5">
            {docsComplete ? (
              <Badge className="bg-emerald-100 text-emerald-700 text-[9px] rounded-full">KYC Completo</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 text-[9px] rounded-full">KYC Incompleto</Badge>
            )}
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium', risk.bg, risk.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', risk.dot)} />{risk.label}
            </span>
          </div>
        </div>
        <div className="divide-y">
          <InfoRow label="Nome" value={name} copyable />
          <InfoRow label="NIF" value={nif} copyable />
          <InfoRow label="CC/BI" value={cc} copyable />
          <InfoRow label="Nacionalidade" value={nationality} />
          <InfoRow label="Morada" value={address} />
          <InfoRow label="PEP" value={pepCheck ? 'Verificado' : 'Não verificado'} />
        </div>
        {extra}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with IMPIC portal link */}
      <div className="rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md p-5 shadow-sm dark:bg-white/5 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="font-semibold text-base">IMPIC — Compliance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informação para reporte ao IMPIC relativa a este imóvel
              </p>
            </div>
          </div>
          <a
            href={IMPIC_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-slate-800 transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Portal IMPIC
          </a>
        </div>
      </div>

      {/* Sellers (from property owners) */}
      {owners && owners.length > 0 && (
        <div className="rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md p-5 shadow-sm dark:bg-white/5 dark:border-white/10">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
            <Building2 className="h-3 w-3" />Proprietários / Vendedores (dados do CRM)
          </p>
          <div className="space-y-2">
            {owners.map((po, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{po.owners?.name || '—'}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {po.owners?.nif && <span>NIF: {po.owners.nif}</span>}
                    {po.owners?.email && <span>{po.owners.email}</span>}
                    {po.owners?.phone && <span>{po.owners.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-muted rounded-full px-2 py-0.5">{po.ownership_percentage}%</span>
                  {po.owners?.nif && (
                    <button onClick={() => copyToClipboard(po.owners!.nif!, 'NIF')} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deals */}
      {deals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Sem negócios registados"
          description="Quando existir uma venda ou arrendamento associado a este imóvel, a informação IMPIC aparecerá aqui."
        />
      ) : (
        <div className="space-y-3">
          {deals.map(({ deal, compliance }) => {
            const statusCfg = STATUS_LABELS[compliance?.status || 'draft'] || STATUS_LABELS.draft
            const hasCompliance = !!compliance
            const riskCfg = RISK_COLORS[compliance?.overall_risk_level || 'low'] || RISK_COLORS.low

            return (
              <button
                key={deal.id}
                onClick={() => setSelectedDeal({ deal, compliance })}
                className="w-full text-left rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.003] dark:bg-white/5 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{deal.reference || `Negócio ${deal.deal_type}`}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', statusCfg.bg, statusCfg.text)}>
                        {statusCfg.label}
                      </span>
                      {hasCompliance && (
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', riskCfg.bg, riskCfg.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', riskCfg.dot)} />Risco {riskCfg.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(deal.deal_date)}</span>
                      <span className="font-medium text-foreground">{fmtCurrency(deal.deal_value)}</span>
                      {deal.consultant?.commercial_name && <span>{deal.consultant.commercial_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasCompliance && (
                      <>
                        {compliance!.buyer_docs_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                        {compliance!.seller_docs_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                        {compliance!.impic_reported ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px] rounded-full">IMPIC</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-[9px] rounded-full">Pendente</Badge>
                        )}
                      </>
                    )}
                    {!hasCompliance && (
                      <Badge className="bg-slate-100 text-slate-500 text-[9px] rounded-full">Sem dados</Badge>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Deal Compliance Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(o) => !o && setSelectedDeal(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto p-0">
          {selectedDeal && (() => {
            const { deal, compliance: c } = selectedDeal
            return (
              <div className="flex flex-col">
                {/* Hero */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 pt-8 pb-6 text-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{deal.reference || 'Negócio'}</h3>
                      <p className="text-slate-400 text-sm mt-0.5">{fmtDate(deal.deal_date)} · {fmtCurrency(deal.deal_value)}</p>
                    </div>
                  </div>
                  {c && (
                    <div className="flex items-center gap-2 mt-4">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_LABELS[c.status]?.bg || 'bg-muted', STATUS_LABELS[c.status]?.text || 'text-muted-foreground')}>
                        {STATUS_LABELS[c.status]?.label || c.status}
                      </span>
                      {c.impic_reported && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" />Reportado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 py-5 space-y-4">
                  {!c ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center dark:bg-amber-500/5 dark:border-amber-500/20">
                      <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Sem dados de compliance</p>
                      <p className="text-xs text-amber-600 mt-1 dark:text-amber-400">Os dados serão preenchidos quando o processo for concluído.</p>
                    </div>
                  ) : (
                    <>
                      {/* Buyer KYC */}
                      <KycCard
                        title="Comprador"
                        icon={User}
                        name={c.buyer_name}
                        nif={c.buyer_nif}
                        cc={c.buyer_cc_number}
                        nationality={c.buyer_nationality}
                        address={c.buyer_address}
                        pepCheck={c.buyer_pep_check}
                        riskLevel={c.buyer_risk_level}
                        docsComplete={c.buyer_docs_complete}
                        extra={c.buyer_funds_origin ? (
                          <div className="pt-2 border-t">
                            <InfoRow label="Origem dos fundos" value={c.buyer_funds_origin} />
                            <InfoRow label="Fundos declarados" value={c.buyer_funds_declared ? 'Sim' : 'Não'} />
                          </div>
                        ) : undefined}
                      />

                      {/* Seller KYC */}
                      <KycCard
                        title="Vendedor"
                        icon={Building2}
                        name={c.seller_name}
                        nif={c.seller_nif}
                        cc={c.seller_cc_number}
                        nationality={c.seller_nationality}
                        address={c.seller_address}
                        pepCheck={c.seller_pep_check}
                        riskLevel={c.seller_risk_level}
                        docsComplete={c.seller_docs_complete}
                        extra={c.seller_is_company ? (
                          <div className="pt-2 border-t">
                            <InfoRow label="Empresa" value="Sim" />
                            <InfoRow label="Beneficiário efectivo" value={c.seller_beneficial_owner} />
                          </div>
                        ) : undefined}
                      />

                      {/* Payment & Risk */}
                      <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                          <Banknote className="h-3 w-3" />Pagamento & Risco
                        </p>
                        <InfoRow label="Método de pagamento" value={c.payment_method} />
                        {c.cash_amount && Number(c.cash_amount) > 0 && (
                          <InfoRow label="Valor em numerário" value={fmtCurrency(Number(c.cash_amount))} />
                        )}
                        <InfoRow label="Risco global" value={RISK_COLORS[c.overall_risk_level]?.label || c.overall_risk_level} />
                      </div>

                      {/* IMPIC Report */}
                      <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                          <FileText className="h-3 w-3" />Reporte IMPIC
                        </p>
                        <InfoRow label="Reportado" value={c.impic_reported ? 'Sim' : 'Não'} />
                        {c.impic_report_date && <InfoRow label="Data de reporte" value={fmtDate(c.impic_report_date)} />}
                        {c.impic_reference && <InfoRow label="Referência IMPIC" value={c.impic_reference} copyable />}
                        {c.impic_quarter && <InfoRow label="Trimestre" value={c.impic_quarter} />}
                        {c.impic_notes && <InfoRow label="Notas" value={c.impic_notes} />}
                      </div>

                      {/* Suspicious activity */}
                      {c.suspicious_activity_reported && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-500/5 dark:border-red-500/20">
                          <p className="text-[9px] uppercase tracking-wider text-red-600 font-medium flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-3 w-3" />Actividade Suspeita Reportada
                          </p>
                          {c.suspicious_activity_date && <InfoRow label="Data" value={fmtDate(c.suspicious_activity_date)} />}
                          {c.suspicious_activity_ref && <InfoRow label="Referência" value={c.suspicious_activity_ref} copyable />}
                        </div>
                      )}

                      {/* Copy all data button */}
                      <Button
                        variant="outline"
                        className="w-full rounded-full gap-2"
                        onClick={() => {
                          const lines = [
                            `Negócio: ${deal.reference || deal.id}`,
                            `Data: ${fmtDate(deal.deal_date)}`,
                            `Valor: ${fmtCurrency(deal.deal_value)}`,
                            '',
                            'COMPRADOR:',
                            `Nome: ${c.buyer_name || '—'}`,
                            `NIF: ${c.buyer_nif || '—'}`,
                            `CC: ${c.buyer_cc_number || '—'}`,
                            `Nacionalidade: ${c.buyer_nationality || '—'}`,
                            `Morada: ${c.buyer_address || '—'}`,
                            `Origem fundos: ${c.buyer_funds_origin || '—'}`,
                            '',
                            'VENDEDOR:',
                            `Nome: ${c.seller_name || '—'}`,
                            `NIF: ${c.seller_nif || '—'}`,
                            `CC: ${c.seller_cc_number || '—'}`,
                            `Nacionalidade: ${c.seller_nationality || '—'}`,
                            `Morada: ${c.seller_address || '—'}`,
                            c.seller_is_company ? `Beneficiário efectivo: ${c.seller_beneficial_owner || '—'}` : '',
                            '',
                            `Método pagamento: ${c.payment_method || '—'}`,
                            c.cash_amount ? `Numerário: ${fmtCurrency(Number(c.cash_amount))}` : '',
                            `Risco: ${RISK_COLORS[c.overall_risk_level]?.label || c.overall_risk_level}`,
                          ].filter(Boolean).join('\n')
                          copyToClipboard(lines, 'Dados IMPIC')
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copiar todos os dados
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
