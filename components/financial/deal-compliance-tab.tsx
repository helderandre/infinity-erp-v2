'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ShieldCheck, ShieldAlert, AlertTriangle, ChevronDown,
  Upload, Copy, Loader2, CheckCircle2, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getCompliance, updateCompliance, markAsReported, generateImpicFormData,
} from '@/app/dashboard/comissoes/compliance/actions'
import type {
  DealCompliance, ImpicFormData,
} from '@/types/compliance'
import {
  RISK_LEVELS, PEP_RESULTS, PAYMENT_METHODS,
  COMPLIANCE_STATUSES, RISK_FLAGS,
} from '@/types/compliance'
import type { RiskLevel, PepResult, PaymentMethod, ComplianceStatus } from '@/types/compliance'

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

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
  if (!data) return <p className="text-sm text-muted-foreground">Sem dados de compliance.</p>

  const statusCfg = COMPLIANCE_STATUSES[data.status]
  const riskCfg = RISK_LEVELS[data.overall_risk_level]

  return (
    <div className="space-y-6">
      {/* ─── Status Banner ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
        <Badge className={riskCfg.color}>Risco {riskCfg.label}</Badge>
        {data.risk_flags.map((f) => {
          const flag = RISK_FLAGS[f]
          return flag ? <Badge key={f} variant="outline" className="text-xs">{flag.label}</Badge> : null
        })}
        {saving && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* ─── KYC Comprador ──────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">KYC Comprador</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" value={data.buyer_name ?? ''} onChange={(v) => save('buyer_name', v)} />
            <Field label="NIF" value={data.buyer_nif ?? ''} onChange={(v) => save('buyer_nif', v)} />
            <Field label="Nº CC/Passaporte" value={data.buyer_cc_number ?? ''} onChange={(v) => save('buyer_cc_number', v)} />
            <Field label="Nacionalidade" value={data.buyer_nationality ?? ''} onChange={(v) => save('buyer_nationality', v)} />
          </div>
          <Field label="Morada" value={data.buyer_address ?? ''} onChange={(v) => save('buyer_address', v)} />
          <Separator />
          <div className="flex items-center gap-3">
            <Switch checked={data.buyer_pep_check} onCheckedChange={(v) => save('buyer_pep_check', v)} />
            <Label>Verificação PEP realizada</Label>
          </div>
          {data.buyer_pep_check && (
            <div className="w-48">
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
          <div className="w-48">
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
            <Label>Fundos declarados</Label>
          </div>
          <Separator />
          <div className="flex gap-4">
            <UploadPlaceholder label="Doc identificação" hasFile={!!data.buyer_id_doc_url} />
            <UploadPlaceholder label="Comprovativo morada" hasFile={!!data.buyer_address_proof_url} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.buyer_docs_complete} onCheckedChange={(v) => save('buyer_docs_complete', !!v)} />
            <Label className="text-sm">Documentação completa</Label>
          </div>
        </CardContent>
      </Card>

      {/* ─── KYC Vendedor ───────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">KYC Vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" value={data.seller_name ?? ''} onChange={(v) => save('seller_name', v)} />
            <Field label="NIF" value={data.seller_nif ?? ''} onChange={(v) => save('seller_nif', v)} />
            <Field label="Nº CC/Passaporte" value={data.seller_cc_number ?? ''} onChange={(v) => save('seller_cc_number', v)} />
            <Field label="Nacionalidade" value={data.seller_nationality ?? ''} onChange={(v) => save('seller_nationality', v)} />
          </div>
          <Field label="Morada" value={data.seller_address ?? ''} onChange={(v) => save('seller_address', v)} />
          <Separator />
          <div className="flex items-center gap-3">
            <Switch checked={data.seller_is_company} onCheckedChange={(v) => save('seller_is_company', v)} />
            <Label>Pessoa Colectiva</Label>
          </div>
          {data.seller_is_company && (
            <div className="space-y-3">
              <UploadPlaceholder label="Certidão Permanente" hasFile={!!data.seller_company_cert_url} />
              <Field label="Beneficiário Efectivo" value={data.seller_beneficial_owner ?? ''} onChange={(v) => save('seller_beneficial_owner', v)} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={data.seller_pep_check} onCheckedChange={(v) => save('seller_pep_check', v)} />
            <Label>Verificação PEP realizada</Label>
          </div>
          {data.seller_pep_check && (
            <div className="w-48">
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
          <div className="w-48">
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
          <div className="flex gap-4">
            <UploadPlaceholder label="Doc identificação" hasFile={!!data.seller_id_doc_url} />
            <UploadPlaceholder label="Comprovativo morada" hasFile={!!data.seller_address_proof_url} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.seller_docs_complete} onCheckedChange={(v) => save('seller_docs_complete', !!v)} />
            <Label className="text-sm">Documentação completa</Label>
          </div>
        </CardContent>
      </Card>

      {/* ─── Transacção ─────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transacção</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 text-xs">Valor do negócio</Label>
              <Input value={fmtCurrency(dealValue)} disabled />
            </div>
            <div>
              <Label className="mb-1 text-xs">Data</Label>
              <Input value={fmtDate(dealDate)} disabled />
            </div>
          </div>
          <div className="w-64">
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
            <div className="w-64">
              <Label className="mb-1 text-xs">Montante em numerário</Label>
              <Input
                type="number"
                value={data.cash_amount || ''}
                onChange={(e) => save('cash_amount', parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          {data.risk_flags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs font-medium text-muted-foreground">Flags de risco:</span>
              {data.risk_flags.map((f) => {
                const flag = RISK_FLAGS[f]
                if (!flag) return null
                const sev = RISK_LEVELS[flag.severity]
                return <Badge key={f} className={sev.color}>{flag.label}</Badge>
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── IMPIC Report ───────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Reporte IMPIC</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.impic_reported ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Reportado</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Referência:</span> {data.impic_reference}</div>
                <div><span className="text-muted-foreground">Data:</span> {data.impic_report_date ? fmtDate(data.impic_report_date) : '—'}</div>
                <div><span className="text-muted-foreground">Trimestre:</span> {data.impic_quarter ?? '—'}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Não reportado</span>
            </div>
          )}
          <div className="flex gap-2">
            {!data.impic_reported && (
              <Button size="sm" onClick={() => setReportDialog(true)}>
                <FileText className="mr-2 h-4 w-4" /> Marcar como Reportado
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleGenerateImpic} disabled={generatingImpic}>
              {generatingImpic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Gerar Dados para IMPIC
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Suspicious Activity ────────────────────────────────── */}
      {(data.status === 'flagged' || data.suspicious_activity_reported) && (
        <Collapsible defaultOpen={data.suspicious_activity_reported}>
          <Card>
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <span className="text-sm font-semibold">Actividade Suspeita</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center gap-3">
                  <Switch checked={data.suspicious_activity_reported} onCheckedChange={(v) => save('suspicious_activity_reported', v)} />
                  <Label>Comunicação de actividade suspeita</Label>
                </div>
                {data.suspicious_activity_reported && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Data da comunicação" value={data.suspicious_activity_date ?? ''} onChange={(v) => save('suspicious_activity_date', v)} type="date" />
                    <Field label="Referência" value={data.suspicious_activity_ref ?? ''} onChange={(v) => save('suspicious_activity_ref', v)} />
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ─── Report Dialog ──────────────────────────────────────── */}
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

      {/* ─── IMPIC Data Dialog ──────────────────────────────────── */}
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
    </div>
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
