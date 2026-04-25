'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink, Loader2, FileSignature, Banknote, FileCheck, Building2,
  CheckCircle2, Receipt, Handshake, NotebookText, Save, Briefcase, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { FinanceiroSheet } from './financeiro-sheet'
import {
  updatePaymentStatus, updatePaymentInvoice,
  updateSplitInvoice, updateSplitPaid,
} from '@/app/dashboard/financeiro/deals/actions'
import { PAYMENT_MOMENTS } from '@/types/deal'
import type { MapaGestaoRow } from '@/types/financial'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const isoDate = (d: string | null) => d ? d.slice(0, 10) : ''

interface MapaRowSheetProps {
  row: MapaGestaoRow | null
  onClose: () => void
  onChanged?: () => void
}

export function MapaRowSheet({ row, onClose, onChanged }: MapaRowSheetProps) {
  const [tab, setTab] = useState<'detalhes' | 'gestao'>('detalhes')

  // Reset to "detalhes" on every new open
  useEffect(() => {
    if (row) setTab('detalhes')
  }, [row?.split_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) {
    return <FinanceiroSheet open={false} onOpenChange={() => {}} title=""><div /></FinanceiroSheet>
  }

  const momentLabel = PAYMENT_MOMENTS[row.payment_moment as keyof typeof PAYMENT_MOMENTS] ?? row.payment_moment
  const dotColor =
    row.consultant_paid ? 'bg-emerald-500' :
    row.is_received ? 'bg-blue-500' :
    row.is_signed ? 'bg-amber-500' : 'bg-slate-300'

  return (
    <FinanceiroSheet
      open={row !== null}
      onOpenChange={(v) => !v && onClose()}
      title={momentLabel}
      accent={<span className={cn('inline-flex h-2 w-2 rounded-full', dotColor)} />}
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{row.deal_type}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{fmtDate(row.deal_date)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{row.payment_pct}% do negócio</span>
        </span>
      }
      footer={
        <Button variant="ghost" onClick={onClose} className="rounded-full">
          Fechar
        </Button>
      }
    >
      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger
              value="detalhes"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Detalhes
            </TabsTrigger>
            <TabsTrigger
              value="gestao"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Gestão
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalhes" className="mt-5 space-y-4">
          <DetalhesView row={row} />
        </TabsContent>

        <TabsContent value="gestao" className="mt-5 space-y-4">
          <GestaoEditor row={row} onChanged={onChanged} />
        </TabsContent>
      </Tabs>
    </FinanceiroSheet>
  )
}

// ─── Tab 1: Detalhes (read view, mantém overview compacto) ────────────────

function DetalhesView({ row }: { row: MapaGestaoRow }) {
  const propertyTitle = row.property
    ? `${row.property.external_ref ?? ''} ${row.property.title}`.trim()
    : 'Sem imóvel'
  const consultantName = row.agent?.commercial_name ?? 'Sem consultor'
  const consultantInitials =
    consultantName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—'
  const isPartnerSplit = row.split_role === 'partner'
  const isReferralSplit = row.split_role === 'referral'
  const isPredicted = row.date_type === 'predicted' && row.signed_date != null
  const showPartner = row.has_share && (row.partner_amount || row.partner_agency_name)

  return (
    <>
      {/* Consultor */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-gradient-to-br from-background/80 to-muted/20 p-4 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">
            {consultantInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Consultor</p>
          <p className="text-sm font-semibold tracking-tight truncate">{consultantName}</p>
        </div>
        {(isPartnerSplit || isReferralSplit) && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            {isPartnerSplit ? 'Partilha' : 'Referral'}
          </Badge>
        )}
      </div>

      {/* Imóvel */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full p-2 bg-slate-500/10 shrink-0">
            <Building2 className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium tracking-tight truncate">{propertyTitle}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {row.reference ?? row.deal_id.slice(0, 8)} · {row.business_type ?? '—'}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px] shrink-0">
            {fmt(row.deal_value)}
          </Badge>
        </div>
      </div>

      {/* Montantes */}
      <div className="grid gap-3 grid-cols-2">
        <Tile label="Comissão consultor" value={fmt(row.split_amount)} tone="emerald" />
        <Tile label="Total pagamento" value={fmt(row.payment_amount)} tone="slate" />
        {row.network_amount != null && row.network_amount > 0 && (
          <Tile label="Rede" value={fmt(row.network_amount)} tone="indigo" />
        )}
        {row.agency_amount != null && row.agency_amount > 0 && (
          <Tile label="Agência" value={fmt(row.agency_amount)} tone="violet" />
        )}
      </div>

      {/* Partilha */}
      {showPartner && (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
            <Handshake className="h-3 w-3" />
            Partilha
          </p>
          <div className="space-y-2">
            {row.partner_agency_name && (
              <DetailRow label="Agência parceira" value={row.partner_agency_name} />
            )}
            {row.partner_amount != null && row.partner_amount > 0 && (
              <DetailRow label="Valor parceiro" value={fmt(row.partner_amount)} />
            )}
          </div>
        </div>
      )}

      {/* Estado (read-only summary) */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-5 space-y-3">
        <p className="text-xs font-semibold tracking-tight">Estado</p>
        <StatusReadRow label="Assinado" icon={FileSignature} checked={row.is_signed} date={row.signed_date} datePredicted={isPredicted} />
        <StatusReadRow label="Recebido" icon={Banknote} checked={row.is_received} date={row.received_date} />
        <StatusReadRow label="Reportado" icon={FileCheck} checked={row.is_reported} date={row.reported_date} />
        <StatusReadRow label="Pago ao consultor" icon={CheckCircle2} checked={row.consultant_paid} date={row.consultant_paid_date} />
      </div>

      {/* Facturação */}
      {(row.agency_invoice_number || row.agency_invoice_date || row.agency_invoice_recipient
        || row.consultant_invoice_number || row.consultant_invoice_date) && (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 space-y-4">
          <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
            <Receipt className="h-3 w-3" />
            Facturação
          </p>

          {(row.agency_invoice_number || row.agency_invoice_date || row.agency_invoice_recipient) && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Agência</p>
              <div className="space-y-1.5">
                {row.agency_invoice_number && <DetailRow label="Número" value={row.agency_invoice_number} />}
                {row.agency_invoice_date && <DetailRow label="Data" value={fmtDate(row.agency_invoice_date)} />}
                {row.agency_invoice_recipient && (
                  <DetailRow
                    label="Cliente"
                    value={
                      <span className="text-right">
                        {row.agency_invoice_recipient}
                        {row.agency_invoice_recipient_nif && (
                          <span className="text-muted-foreground"> · NIF {row.agency_invoice_recipient_nif}</span>
                        )}
                      </span>
                    }
                  />
                )}
                {row.agency_invoice_amount_gross != null && (
                  <DetailRow label="Valor (bruto)" value={fmt(row.agency_invoice_amount_gross)} />
                )}
              </div>
            </div>
          )}

          {(row.consultant_invoice_number || row.consultant_invoice_date) && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Consultor</p>
              <div className="space-y-1.5">
                {row.consultant_invoice_number && <DetailRow label="Número" value={row.consultant_invoice_number} />}
                {row.consultant_invoice_date && <DetailRow label="Data" value={fmtDate(row.consultant_invoice_date)} />}
                {row.consultant_invoice_type && <DetailRow label="Tipo" value={row.consultant_invoice_type} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notas */}
      {row.payment_notes && (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
          <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5 mb-2">
            <NotebookText className="h-3 w-3" />
            Notas
          </p>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{row.payment_notes}</p>
        </div>
      )}
    </>
  )
}

// ─── Tab 2: Gestão (editor + link to deal) ────────────────────────────────

function GestaoEditor({
  row, onChanged,
}: {
  row: MapaGestaoRow
  onChanged?: () => void
}) {
  // Status form state
  const [signed, setSigned] = useState(row.is_signed)
  const [signedDate, setSignedDate] = useState(isoDate(row.signed_date))
  const [received, setReceived] = useState(row.is_received)
  const [receivedDate, setReceivedDate] = useState(isoDate(row.received_date))
  const [reported, setReported] = useState(row.is_reported)
  const [reportedDate, setReportedDate] = useState(isoDate(row.reported_date))
  const [paid, setPaid] = useState(row.consultant_paid)
  const [paidDate, setPaidDate] = useState(isoDate(row.consultant_paid_date))

  // Agency invoice state
  const [agencyInvNum, setAgencyInvNum] = useState(row.agency_invoice_number ?? '')
  const [agencyInvDate, setAgencyInvDate] = useState(isoDate(row.agency_invoice_date))
  const [agencyInvRecipient, setAgencyInvRecipient] = useState(row.agency_invoice_recipient ?? '')
  const [agencyInvNif, setAgencyInvNif] = useState(row.agency_invoice_recipient_nif ?? '')
  const [agencyInvNet, setAgencyInvNet] = useState(row.agency_invoice_amount_net != null ? String(row.agency_invoice_amount_net) : '')
  const [agencyInvGross, setAgencyInvGross] = useState(row.agency_invoice_amount_gross != null ? String(row.agency_invoice_amount_gross) : '')

  // Consultor invoice state
  const [consInvNum, setConsInvNum] = useState(row.consultant_invoice_number ?? '')
  const [consInvDate, setConsInvDate] = useState(isoDate(row.consultant_invoice_date))
  const [consInvType, setConsInvType] = useState(row.consultant_invoice_type ?? '')

  const [savingStatus, setSavingStatus] = useState(false)
  const [savingAgency, setSavingAgency] = useState(false)
  const [savingConsultor, setSavingConsultor] = useState(false)

  const propertyTitle = row.property
    ? `${row.property.external_ref ?? ''} ${row.property.title}`.trim()
    : 'Sem imóvel'

  // Save status (deal-level + split-level)
  const handleSaveStatus = async () => {
    setSavingStatus(true)
    try {
      // Deal-level: signed/received/reported with dates
      const inv = await updatePaymentInvoice(row.payment_id, {
        signed_date: signed ? (signedDate || null) : null,
        received_date: received ? (receivedDate || null) : null,
        reported_date: reported ? (reportedDate || null) : null,
      })
      if (!inv.success) throw new Error(inv.error ?? 'Erro')

      // Toggle the booleans separately (the dates were already saved above)
      const tasks: Promise<any>[] = []
      if (signed !== row.is_signed) {
        tasks.push(updatePaymentStatus(row.payment_id, 'is_signed', signed, signedDate || undefined))
      }
      if (received !== row.is_received) {
        tasks.push(updatePaymentStatus(row.payment_id, 'is_received', received, receivedDate || undefined))
      }
      if (reported !== row.is_reported) {
        tasks.push(updatePaymentStatus(row.payment_id, 'is_reported', reported, reportedDate || undefined))
      }
      await Promise.all(tasks)

      // Split-level: consultant_paid
      if (paid !== row.consultant_paid || (paid && paidDate !== isoDate(row.consultant_paid_date))) {
        const r = await updateSplitPaid(row.split_id, paid, paidDate || undefined)
        if (!r.success) throw new Error(r.error ?? 'Erro')
      }

      toast.success('Estado actualizado')
      onChanged?.()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar estado')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleSaveAgency = async () => {
    setSavingAgency(true)
    try {
      const res = await updatePaymentInvoice(row.payment_id, {
        agency_invoice_number: agencyInvNum || undefined,
        agency_invoice_date: agencyInvDate || undefined,
        agency_invoice_recipient: agencyInvRecipient || undefined,
        agency_invoice_recipient_nif: agencyInvNif || undefined,
        agency_invoice_amount_net: agencyInvNet ? Number(agencyInvNet) : undefined,
        agency_invoice_amount_gross: agencyInvGross ? Number(agencyInvGross) : undefined,
      })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Factura da agência guardada')
      onChanged?.()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar')
    } finally {
      setSavingAgency(false)
    }
  }

  const handleSaveConsultor = async () => {
    setSavingConsultor(true)
    try {
      const res = await updateSplitInvoice(row.split_id, {
        consultant_invoice_number: consInvNum || undefined,
        consultant_invoice_date: consInvDate || undefined,
        consultant_invoice_type: consInvType || undefined,
      })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Factura do consultor guardada')
      onChanged?.()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar')
    } finally {
      setSavingConsultor(false)
    }
  }

  return (
    <>
      {/* Card "Abrir negócio" */}
      <Link
        href={`/dashboard/financeiro/deals/${row.deal_id}`}
        className="block rounded-2xl ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 p-4 transition-all hover:ring-border hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-gradient-to-br from-blue-500/15 to-blue-500/5 shrink-0">
            <Briefcase className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Negócio · {row.reference ?? row.deal_id.slice(0, 8)}
            </p>
            <p className="text-sm font-semibold tracking-tight truncate">{propertyTitle}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Editar todos os pagamentos, partilha e contratos no detalhe completo
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </Link>

      {/* Estado editável com date pickers */}
      <Section icon={CheckCircle2} title="Estado" onSave={handleSaveStatus} saving={savingStatus}>
        <StatusEditableRow
          label="Assinado"
          checked={signed} onCheckedChange={setSigned}
          date={signedDate} onDateChange={setSignedDate}
          predicted={row.date_type === 'predicted'}
        />
        <StatusEditableRow
          label="Recebido"
          checked={received} onCheckedChange={setReceived}
          date={receivedDate} onDateChange={setReceivedDate}
        />
        <StatusEditableRow
          label="Reportado"
          checked={reported} onCheckedChange={setReported}
          date={reportedDate} onDateChange={setReportedDate}
        />
        <StatusEditableRow
          label="Pago ao consultor"
          checked={paid} onCheckedChange={setPaid}
          date={paidDate} onDateChange={setPaidDate}
        />
      </Section>

      {/* Factura da agência */}
      <Section icon={Receipt} title="Factura da agência" onSave={handleSaveAgency} saving={savingAgency}>
        <Field label="Número" value={agencyInvNum} onChange={setAgencyInvNum} placeholder="FT 2026/123" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" type="date" value={agencyInvDate} onChange={setAgencyInvDate} />
          <Field label="NIF cliente" value={agencyInvNif} onChange={setAgencyInvNif} placeholder="123456789" />
        </div>
        <Field label="Cliente" value={agencyInvRecipient} onChange={setAgencyInvRecipient} placeholder="Nome do cliente" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (líquido)" type="number" value={agencyInvNet} onChange={setAgencyInvNet} placeholder="0,00" />
          <Field label="Valor (bruto)" type="number" value={agencyInvGross} onChange={setAgencyInvGross} placeholder="0,00" />
        </div>
      </Section>

      {/* Factura do consultor */}
      <Section icon={FileSignature} title="Factura do consultor" onSave={handleSaveConsultor} saving={savingConsultor}>
        <Field label="Número" value={consInvNum} onChange={setConsInvNum} placeholder="REC 2026/45" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" type="date" value={consInvDate} onChange={setConsInvDate} />
          <Field label="Tipo" value={consInvType} onChange={setConsInvType} placeholder="Recibo / Factura-recibo" />
        </div>
      </Section>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function Section({
  icon: Icon, title, onSave, saving, children,
}: {
  icon: React.ElementType
  title: string
  onSave: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {title}
        </p>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="rounded-full h-7 text-[11px] gap-1.5"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function StatusEditableRow({
  label, checked, onCheckedChange, date, onDateChange, predicted,
}: {
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  date: string
  onDateChange: (v: string) => void
  predicted?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="shrink-0"
      />
      <Label
        className={cn(
          'text-sm flex-1 cursor-pointer',
          checked ? 'text-foreground' : 'text-muted-foreground'
        )}
        onClick={() => onCheckedChange(!checked)}
      >
        {label}
        {predicted && checked && (
          <span className="ml-2 text-[10px] text-amber-600">(previsto)</span>
        )}
      </Label>
      <Input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        disabled={!checked}
        className="h-8 w-[140px] rounded-full text-xs"
      />
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-xl text-sm"
      />
    </div>
  )
}

function Tile({
  label, value, tone,
}: {
  label: string
  value: string
  tone: 'emerald' | 'slate' | 'indigo' | 'violet'
}) {
  const map = {
    emerald: { from: 'from-emerald-500/15', accent: 'bg-emerald-500/60' },
    slate: { from: 'from-slate-500/10', accent: 'bg-slate-400/40' },
    indigo: { from: 'from-indigo-500/15', accent: 'bg-indigo-500/60' },
    violet: { from: 'from-violet-500/15', accent: 'bg-violet-500/60' },
  }[tone]
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent',
      'ring-1 ring-border/40 p-4',
      map.from,
    )}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', map.accent)} />
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      <p className="text-lg font-semibold tracking-tight tabular-nums truncate mt-1.5">{value}</p>
    </div>
  )
}

function StatusReadRow({
  label, icon: Icon, checked, date, datePredicted,
}: {
  label: string
  icon: React.ElementType
  checked: boolean
  date: string | null
  datePredicted?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'rounded-full p-2 shrink-0 bg-gradient-to-br',
        checked ? 'from-emerald-500/15 to-emerald-500/5' : 'from-slate-500/10 to-slate-500/5'
      )}>
        <Icon className={cn('h-3.5 w-3.5', checked ? 'text-emerald-600' : 'text-slate-500')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {date && (
          <p className={cn(
            'text-[11px]',
            datePredicted ? 'text-amber-600 italic' : 'text-muted-foreground'
          )}>
            {datePredicted && 'Previsto · '}{fmtDate(date)}
          </p>
        )}
      </div>
      {checked && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
