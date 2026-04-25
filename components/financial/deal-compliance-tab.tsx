'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  ShieldCheck, ShieldAlert, AlertTriangle,
  Upload, Copy, Loader2, CheckCircle2, FileText, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getCompliance, updateCompliance, markAsReported, generateImpicFormData,
} from '@/app/dashboard/financeiro/compliance/actions'
import type {
  DealCompliance, ImpicFormData,
} from '@/types/compliance'
import {
  RISK_LEVELS, PEP_RESULTS, PAYMENT_METHODS,
  COMPLIANCE_STATUSES, RISK_FLAGS,
} from '@/types/compliance'
import type { RiskLevel, PepResult, PaymentMethod } from '@/types/compliance'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────────────────────────────

interface DealComplianceTabProps {
  dealId: string
  dealValue: number
  dealDate: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ─── Component ──────────────────────────────────────────────────────────────

export function DealComplianceTab({ dealId, dealValue, dealDate }: DealComplianceTabProps) {
  const [data, setData] = useState<DealCompliance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [reportDialog, setReportDialog] = useState(false)
  const [impicDialog, setImpicDialog] = useState(false)
  const [impicData, setImpicData] = useState<ImpicFormData | null>(null)
  const [reportRef, setReportRef] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [submittingReport, setSubmittingReport] = useState(false)
  const [generatingImpic, setGeneratingImpic] = useState(false)
  const timers = useRef<Record<string, NodeJS.Timeout>>({})

  const load = useCallback(async () => {
    try {
      const result = await getCompliance(dealId)
      setData(result)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao obter dados de compliance.')
    }
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load])

  const save = useCallback((field: string, value: unknown) => {
    if (!data) return
    setData((prev) => prev ? { ...prev, [field]: value } as DealCompliance : prev)
    if (timers.current[field]) clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(async () => {
      setSaving(true)
      try {
        const result = await updateCompliance(dealId, { [field]: value })
        setData(result)
      } catch (err: any) {
        toast.error(err?.message ?? 'Erro ao actualizar compliance.')
      }
      setSaving(false)
    }, 500)
  }, [data, dealId])

  const handleMarkReported = async () => {
    if (!reportRef.trim()) { toast.error('Referência IMPIC obrigatória.'); return }
    setSubmittingReport(true)
    try {
      const result = await markAsReported(dealId, reportRef, reportDate)
      toast.success('Marcado como reportado.')
      setData(result)
      setReportDialog(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao marcar como reportado.')
    }
    setSubmittingReport(false)
  }

  const handleGenerateImpic = async () => {
    setGeneratingImpic(true)
    try {
      const result = await generateImpicFormData(dealId)
      setImpicData(result)
      setImpicDialog(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao gerar dados IMPIC.')
    }
    setGeneratingImpic(false)
  }

  const copyImpicData = () => {
    if (!impicData) return
    const lines = Object.entries(impicData).map(([k, v]) => `${k}: ${v}`).join('\n')
    navigator.clipboard.writeText(lines)
    toast.success('Dados copiados.')
  }

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />
  if (!data) return <p className="text-sm text-muted-foreground">Sem dados de compliance.</p>

  const statusCfg = COMPLIANCE_STATUSES[data.status]
  const riskCfg = RISK_LEVELS[data.overall_risk_level]

  // Summary checklist — the only "is this done?" signals that matter at a glance.
  const checklist = [
    { label: 'KYC Comprador', done: !!data.buyer_docs_complete },
    { label: 'KYC Vendedor', done: !!data.seller_docs_complete },
    { label: 'Verificações PEP', done: !!data.buyer_pep_check && !!data.seller_pep_check },
    { label: 'Forma de pagamento', done: !!data.payment_method },
    { label: 'Reporte IMPIC', done: !!data.impic_reported },
  ]

  return (
    <>
      {/* ═══ Compact summary card ═══ */}
      <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
        {/* Top row: status + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
          <Badge className={riskCfg.color}>Risco {riskCfg.label}</Badge>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => setEditSheetOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
            {!data.impic_reported ? (
              <Button size="sm" className="rounded-full h-8" onClick={() => setReportDialog(true)}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Reportar IMPIC
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="rounded-full h-8" onClick={handleGenerateImpic} disabled={generatingImpic}>
                {generatingImpic ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                Gerar dados
              </Button>
            )}
          </div>
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0',
                  item.done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn(item.done ? 'text-foreground' : 'text-muted-foreground')}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Risk flags — only shown when present */}
        {data.risk_flags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Flags</span>
            {data.risk_flags.map((f) => {
              const flag = RISK_FLAGS[f]
              if (!flag) return null
              const sev = RISK_LEVELS[flag.severity]
              return <Badge key={f} className={cn('text-[10px]', sev.color)}>{flag.label}</Badge>
            })}
          </div>
        )}

        {/* IMPIC reported info — only when reported */}
        {data.impic_reported && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>
              Reportado · Ref <span className="font-mono text-foreground">{data.impic_reference}</span>
              {data.impic_report_date && ` · ${fmtDate(data.impic_report_date)}`}
              {data.impic_quarter && ` · ${data.impic_quarter}`}
            </span>
          </div>
        )}
      </div>

      {/* ═══ Full-edit sheet ═══ */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Compliance</SheetTitle>
            <SheetDescription>
              Dados de KYC, transacção e actividade suspeita. As alterações são guardadas automaticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-4 px-4">
            {/* KYC Comprador */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">KYC Comprador</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome" value={data.buyer_name ?? ''} onChange={(v) => save('buyer_name', v)} />
                <Field label="NIF" value={data.buyer_nif ?? ''} onChange={(v) => save('buyer_nif', v)} />
                <Field label="Nº CC/Passaporte" value={data.buyer_cc_number ?? ''} onChange={(v) => save('buyer_cc_number', v)} />
                <Field label="Nacionalidade" value={data.buyer_nationality ?? ''} onChange={(v) => save('buyer_nationality', v)} />
              </div>
              <Field label="Morada" value={data.buyer_address ?? ''} onChange={(v) => save('buyer_address', v)} />
              <div className="flex items-center gap-3">
                <Switch checked={data.buyer_pep_check} onCheckedChange={(v) => save('buyer_pep_check', v)} />
                <Label className="text-sm">Verificação PEP realizada</Label>
              </div>
              {data.buyer_pep_check && (
                <div>
                  <Label className="mb-1 text-xs">Resultado PEP</Label>
                  <Select value={data.buyer_pep_result ?? ''} onValueChange={(v) => save('buyer_pep_result', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(PEP_RESULTS) as [PepResult, { label: string }][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-1 text-xs">Classificação de risco</Label>
                <Select value={data.buyer_risk_level} onValueChange={(v) => save('buyer_risk_level', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RISK_LEVELS) as [RiskLevel, { label: string }][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 text-xs">Origem dos fundos</Label>
                <Textarea rows={2} value={data.buyer_funds_origin ?? ''} onChange={(e) => save('buyer_funds_origin', e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={data.buyer_funds_declared} onCheckedChange={(v) => save('buyer_funds_declared', v)} />
                <Label className="text-sm">Fundos declarados</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <UploadPlaceholder label="Doc identificação" hasFile={!!data.buyer_id_doc_url} />
                <UploadPlaceholder label="Comprovativo morada" hasFile={!!data.buyer_address_proof_url} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={data.buyer_docs_complete} onCheckedChange={(v) => save('buyer_docs_complete', !!v)} />
                <Label className="text-sm">Documentação completa</Label>
              </div>
            </section>

            <Separator />

            {/* KYC Vendedor */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">KYC Vendedor</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome" value={data.seller_name ?? ''} onChange={(v) => save('seller_name', v)} />
                <Field label="NIF" value={data.seller_nif ?? ''} onChange={(v) => save('seller_nif', v)} />
                <Field label="Nº CC/Passaporte" value={data.seller_cc_number ?? ''} onChange={(v) => save('seller_cc_number', v)} />
                <Field label="Nacionalidade" value={data.seller_nationality ?? ''} onChange={(v) => save('seller_nationality', v)} />
              </div>
              <Field label="Morada" value={data.seller_address ?? ''} onChange={(v) => save('seller_address', v)} />
              <div className="flex items-center gap-3">
                <Switch checked={data.seller_is_company} onCheckedChange={(v) => save('seller_is_company', v)} />
                <Label className="text-sm">Pessoa Colectiva</Label>
              </div>
              {data.seller_is_company && (
                <div className="space-y-3">
                  <UploadPlaceholder label="Certidão Permanente" hasFile={!!data.seller_company_cert_url} />
                  <Field label="Beneficiário Efectivo" value={data.seller_beneficial_owner ?? ''} onChange={(v) => save('seller_beneficial_owner', v)} />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Switch checked={data.seller_pep_check} onCheckedChange={(v) => save('seller_pep_check', v)} />
                <Label className="text-sm">Verificação PEP realizada</Label>
              </div>
              {data.seller_pep_check && (
                <div>
                  <Label className="mb-1 text-xs">Resultado PEP</Label>
                  <Select value={data.seller_pep_result ?? ''} onValueChange={(v) => save('seller_pep_result', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(PEP_RESULTS) as [PepResult, { label: string }][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-1 text-xs">Classificação de risco</Label>
                <Select value={data.seller_risk_level} onValueChange={(v) => save('seller_risk_level', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RISK_LEVELS) as [RiskLevel, { label: string }][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <UploadPlaceholder label="Doc identificação" hasFile={!!data.seller_id_doc_url} />
                <UploadPlaceholder label="Comprovativo morada" hasFile={!!data.seller_address_proof_url} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={data.seller_docs_complete} onCheckedChange={(v) => save('seller_docs_complete', !!v)} />
                <Label className="text-sm">Documentação completa</Label>
              </div>
            </section>

            <Separator />

            {/* Transacção */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Transacção</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 text-xs">Valor do negócio</Label>
                  <Input value={fmtCurrency(dealValue)} disabled />
                </div>
                <div>
                  <Label className="mb-1 text-xs">Data</Label>
                  <Input value={fmtDate(dealDate)} disabled />
                </div>
              </div>
              <div>
                <Label className="mb-1 text-xs">Forma de pagamento</Label>
                <Select value={data.payment_method ?? ''} onValueChange={(v) => save('payment_method', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(data.payment_method === 'cash' || data.payment_method === 'mixed') && (
                <div>
                  <Label className="mb-1 text-xs">Montante em numerário</Label>
                  <Input
                    type="number"
                    value={data.cash_amount || ''}
                    onChange={(e) => save('cash_amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </section>

            {/* Suspicious activity — shown when status flagged or already reported */}
            {(data.status === 'flagged' || data.suspicious_activity_reported) && (
              <>
                <Separator />
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold">Actividade Suspeita</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={data.suspicious_activity_reported} onCheckedChange={(v) => save('suspicious_activity_reported', v)} />
                    <Label className="text-sm">Comunicação de actividade suspeita</Label>
                  </div>
                  {data.suspicious_activity_reported && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Data da comunicação" value={data.suspicious_activity_date ?? ''} onChange={(v) => save('suspicious_activity_date', v)} type="date" />
                      <Field label="Referência" value={data.suspicious_activity_ref ?? ''} onChange={(v) => save('suspicious_activity_ref', v)} />
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Report IMPIC dialog ═══ */}
      <Dialog open={reportDialog} onOpenChange={setReportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Marcar como Reportado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 text-xs">Referência IMPIC</Label>
              <Input value={reportRef} onChange={(e) => setReportRef(e.target.value)} placeholder="Ex: IMPIC-2026-XXXX" />
            </div>
            <div>
              <Label className="mb-1 text-xs">Data do reporte</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialog(false)}>Cancelar</Button>
            <Button onClick={handleMarkReported} disabled={submittingReport}>
              {submittingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ IMPIC Data dialog ═══ */}
      <Dialog open={impicDialog} onOpenChange={setImpicDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Dados para IMPIC</DialogTitle></DialogHeader>
          {impicData && (
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs">
              {Object.entries(impicData).map(([k, v]) => `${k}: ${v}`).join('\n')}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpicDialog(false)}>Fechar</Button>
            <Button onClick={copyImpicData}><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function UploadPlaceholder({ label, hasFile }: { label: string; hasFile: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
      {hasFile ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <Upload className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
      <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs">
        {hasFile ? 'Substituir' : 'Carregar'}
      </Button>
    </div>
  )
}
