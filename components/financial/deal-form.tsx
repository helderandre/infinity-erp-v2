'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ChevronRight, ChevronLeft, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { calculateDealCommission, getApplicableTier } from '@/lib/financial/calculations'
import { getCommissionTiers, getAgencySettings } from '@/app/dashboard/financeiro/actions'
import { createDeal, getConsultantsForSelect, getPropertiesForSelect } from '@/app/dashboard/financeiro/deals/actions'
import type { DealType, ShareType, PaymentStructure, DealCommissionPreview } from '@/types/deal'
import type { CommissionTier, AgencySetting } from '@/types/financial'

interface DealFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface PropertyOption { id: string; title: string; external_ref: string }
interface ConsultantOption { id: string; commercial_name: string }

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

export function DealForm({ open, onOpenChange, onSuccess }: DealFormProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Options
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [settings, setSettings] = useState<AgencySetting[]>([])
  const [propSearch, setPropSearch] = useState('')
  const [propPopoverOpen, setPropPopoverOpen] = useState(false)

  // Step 1
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [consultantId, setConsultantId] = useState('')
  const [dealType, setDealType] = useState<DealType>('venda')
  const [dealValue, setDealValue] = useState('')
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [pvNumber, setPvNumber] = useState('')

  // Step 2
  const [commissionPct, setCommissionPct] = useState('')
  const [hasShare, setHasShare] = useState(false)
  const [shareType, setShareType] = useState<ShareType>('external')
  const [sharePct, setSharePct] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [internalColleagueId, setInternalColleagueId] = useState('')
  const [consultantPct, setConsultantPct] = useState('')
  const [partnerPct, setPartnerPct] = useState('')

  // Referrals (per side)
  const [sellerHasReferral, setSellerHasReferral] = useState(false)
  const [sellerReferralAgentId, setSellerReferralAgentId] = useState('')
  const [sellerReferralPct, setSellerReferralPct] = useState('')
  const [sellerReferralTierPct, setSellerReferralTierPct] = useState('')
  const [buyerHasReferral, setBuyerHasReferral] = useState(false)
  const [buyerReferralAgentId, setBuyerReferralAgentId] = useState('')
  const [buyerReferralPct, setBuyerReferralPct] = useState('')
  const [buyerReferralTierPct, setBuyerReferralTierPct] = useState('')

  // Step 3
  const [paymentStructure, setPaymentStructure] = useState<PaymentStructure>('escritura_only')
  const [cpcvPct, setCpcvPct] = useState('30')
  const [escrituraPct, setEscrituraPct] = useState('70')
  const [cpcvDate, setCpcvDate] = useState('')
  const [escrituraDate, setEscrituraDate] = useState('')

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId]
  )

  // Load data
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getPropertiesForSelect(),
      getConsultantsForSelect(),
      getCommissionTiers(),
      getAgencySettings(),
    ]).then(([propRes, consRes, tierRes, settRes]) => {
      setProperties(propRes.properties ?? [])
      setConsultants(consRes.consultants ?? [])
      setTiers(tierRes.tiers ?? [])
      setSettings(settRes.settings ?? [])
      setLoading(false)
    })
  }, [open])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1)
      setPropertyId(null)
      setConsultantId('')
      setDealType('venda')
      setDealValue('')
      setDealDate(new Date().toISOString().slice(0, 10))
      setReference('')
      setPvNumber('')
      setCommissionPct('')
      setHasShare(false)
      setShareType('external')
      setSharePct('')
      setPartnerName('')
      setInternalColleagueId('')
      setConsultantPct('')
      setPartnerPct('')
      setSellerHasReferral(false)
      setSellerReferralAgentId('')
      setSellerReferralPct('')
      setSellerReferralTierPct('')
      setBuyerHasReferral(false)
      setBuyerReferralAgentId('')
      setBuyerReferralPct('')
      setBuyerReferralTierPct('')
      setPaymentStructure('escritura_only')
      setCpcvPct('30')
      setEscrituraPct('70')
      setCpcvDate('')
      setEscrituraDate('')
    }
  }, [open])

  // Auto-fill consultant when property selected — skipped, property select doesn't include consultant_id

  // Auto detect tier
  const tier = useMemo(() => {
    const val = parseFloat(dealValue) || 0
    if (!val || !commissionPct) return null
    return getApplicableTier(val, dealType, tiers)
  }, [tiers, dealType, dealValue, commissionPct])

  // Auto-fill consultant pct from tier
  useEffect(() => {
    if (tier && !consultantPct) {
      setConsultantPct(String(tier.consultant_rate))
    }
  }, [tier, consultantPct])

  // Auto-fill partner pct from tier when internal colleague selected
  useEffect(() => {
    if (tier && internalColleagueId && !partnerPct) {
      setPartnerPct(String(tier.consultant_rate))
    }
  }, [tier, internalColleagueId, partnerPct])

  // Auto-fill referral tier pcts
  useEffect(() => {
    if (tier && sellerReferralAgentId && !sellerReferralTierPct) {
      setSellerReferralTierPct(String(tier.consultant_rate))
    }
  }, [tier, sellerReferralAgentId, sellerReferralTierPct])

  useEffect(() => {
    if (tier && buyerReferralAgentId && !buyerReferralTierPct) {
      setBuyerReferralTierPct(String(tier.consultant_rate))
    }
  }, [tier, buyerReferralAgentId, buyerReferralTierPct])

  // Force arrendamento to single payment
  useEffect(() => {
    if (dealType === 'arrendamento') setPaymentStructure('single')
  }, [dealType])

  // Commission preview
  const preview: DealCommissionPreview | null = useMemo(() => {
    const val = parseFloat(dealValue) || 0
    const comm = parseFloat(commissionPct) || 0
    const consPct = parseFloat(consultantPct) || 0
    if (!val || !comm) return null
    const networkPct = parseFloat(settings.find(s => s.key === 'network_pct')?.value ?? '8') || 8
    return calculateDealCommission({
      deal_value: val,
      commission_pct: comm,
      has_share: hasShare,
      share_pct: hasShare ? parseFloat(sharePct) || 0 : 0,
      network_pct: networkPct,
      consultant_pct: consPct,
      payment_structure: paymentStructure,
      cpcv_pct: paymentStructure === 'split' ? parseFloat(cpcvPct) || 0 : 0,
      escritura_pct: paymentStructure === 'split' ? parseFloat(escrituraPct) || 0 : 0,
      deal_type: dealType,
    })
  }, [dealValue, commissionPct, consultantPct, hasShare, sharePct, paymentStructure, cpcvPct, escrituraPct, settings, tiers, dealType])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const networkPct = parseFloat(settings.find(s => s.key === 'network_pct')?.value ?? '8') || 8
      const calcInput = {
        deal_value: parseFloat(dealValue),
        commission_pct: parseFloat(commissionPct),
        has_share: hasShare,
        share_pct: hasShare ? parseFloat(sharePct) || 0 : 0,
        network_pct: networkPct,
        consultant_pct: parseFloat(consultantPct) || 0,
        payment_structure: paymentStructure,
        cpcv_pct: paymentStructure === 'split' ? parseFloat(cpcvPct) : paymentStructure === 'cpcv_only' ? 100 : 0,
        escritura_pct: paymentStructure === 'split' ? parseFloat(escrituraPct) : paymentStructure === 'escritura_only' ? 100 : 0,
        deal_type: dealType,
      }
      const calc = calculateDealCommission(calcInput)
      const res = await createDeal({
        property_id: propertyId ?? undefined,
        consultant_id: consultantId,
        deal_type: dealType,
        deal_value: calcInput.deal_value,
        deal_date: dealDate,
        reference: reference || undefined,
        pv_number: pvNumber || undefined,
        commission_pct: calcInput.commission_pct,
        commission_total: calc.commission_total,
        has_share: hasShare,
        share_type: hasShare ? (shareType === 'internal' ? 'internal_agency' : shareType) : undefined,
        share_pct: hasShare ? parseFloat(sharePct) || undefined : undefined,
        share_amount: hasShare ? calc.share_amount : undefined,
        partner_agency_name: hasShare && shareType !== 'internal' ? partnerName || undefined : undefined,
        internal_colleague_id: hasShare && shareType === 'internal' ? internalColleagueId || undefined : undefined,
        network_pct: networkPct,
        network_amount: calc.network_amount,
        agency_margin: calc.agency_margin,
        consultant_pct: parseFloat(consultantPct) || undefined,
        consultant_amount: calc.consultant_amount,
        agency_net: calc.agency_net,
        payment_structure: paymentStructure,
        cpcv_pct: calcInput.cpcv_pct,
        escritura_pct: calcInput.escritura_pct,
        payments: calc.payments.map((p) => ({
          payment_moment: p.moment,
          payment_pct: p.pct,
          amount: p.amount,
          network_amount: p.network,
          agency_amount: p.agency,
          consultant_amount: p.consultant,
          partner_amount: p.partner,
          date: p.moment === 'cpcv' ? (cpcvDate || dealDate) : p.moment === 'escritura' ? (escrituraDate || dealDate) : dealDate,
        })),
        partner_tier_pct: partnerPct ? parseFloat(partnerPct) : undefined,
        referrals: [
          ...(sellerHasReferral && sellerReferralAgentId ? [{
            side: 'angariacao' as const,
            agent_id: sellerReferralAgentId,
            pct: parseFloat(sellerReferralPct) || 0,
            tier_pct: parseFloat(sellerReferralTierPct) || 0,
          }] : []),
          ...(buyerHasReferral && buyerReferralAgentId ? [{
            side: 'negocio' as const,
            agent_id: buyerReferralAgentId,
            pct: parseFloat(buyerReferralPct) || 0,
            tier_pct: parseFloat(buyerReferralTierPct) || 0,
          }] : []),
        ],
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Negocio criado com sucesso')
        onSuccess()
        onOpenChange(false)
      }
    } catch {
      toast.error('Erro ao criar negocio. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [propertyId, consultantId, dealType, dealValue, dealDate, reference, pvNumber, commissionPct, hasShare, shareType, sharePct, partnerName, internalColleagueId, consultantPct, partnerPct, sellerHasReferral, sellerReferralAgentId, sellerReferralPct, sellerReferralTierPct, buyerHasReferral, buyerReferralAgentId, buyerReferralPct, buyerReferralTierPct, paymentStructure, cpcvPct, escrituraPct, cpcvDate, escrituraDate, onSuccess, onOpenChange])

  const canNext = step === 1
    ? consultantId && dealType && dealValue && dealDate
    : step === 2
      ? commissionPct && consultantPct && (!hasShare || sharePct)
      : true

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Negocio</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Negocio — Passo {step} de 3</DialogTitle>
          <div className="flex gap-1 pt-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            {/* Imovel */}
            <div className="space-y-2">
              <Label>Imovel</Label>
              <Popover open={propPopoverOpen} onOpenChange={setPropPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedProperty
                      ? `${selectedProperty.title} (${selectedProperty.external_ref})`
                      : 'Seleccionar imovel...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar imovel..." value={propSearch} onValueChange={setPropSearch} />
                    <CommandList>
                      <CommandEmpty>Nenhum imovel encontrado.</CommandEmpty>
                      <CommandGroup>
                        {properties.map((p) => (
                          <CommandItem key={p.id} value={`${p.title} ${p.external_ref}`} onSelect={() => { setPropertyId(p.id); setPropPopoverOpen(false) }}>
                            <span className="truncate">{p.title}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{p.external_ref}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Consultor */}
            <div className="space-y-2">
              <Label>Consultor *</Label>
              <Select value={consultantId} onValueChange={setConsultantId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar consultor..." /></SelectTrigger>
                <SelectContent>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <RadioGroup value={dealType} onValueChange={(v) => setDealType(v as DealType)} className="flex gap-4">
                {(['venda', 'arrendamento', 'trespasse'] as DealType[]).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <RadioGroupItem value={t} id={`type-${t}`} />
                    <Label htmlFor={`type-${t}`} className="font-normal cursor-pointer capitalize">{t}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Valor + Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor da Transaccao *</Label>
                <Input type="number" min={0} step="0.01" placeholder="0,00 EUR" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
              </div>
            </div>

            {/* Referencia + PV */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input placeholder="Ref. interna" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>PV n.o</Label>
                <Input placeholder="Numero PV" value={pvNumber} onChange={(e) => setPvNumber(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>% Comissao *</Label>
              <Input type="number" min={0} max={100} step={0.1} placeholder="5.0" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>

            {/* Share toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="has-share" className="font-normal">Tem partilha?</Label>
              <Switch id="has-share" checked={hasShare} onCheckedChange={setHasShare} />
            </div>

            {hasShare && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="space-y-2">
                  <Label>Tipo de Partilha</Label>
                  <Select value={shareType} onValueChange={(v) => setShareType(v as ShareType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interna</SelectItem>
                      <SelectItem value="external">Externa</SelectItem>
                      <SelectItem value="network">Rede</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>% Partilha</Label>
                    <Input type="number" min={0} max={100} step={0.1} value={sharePct} onChange={(e) => setSharePct(e.target.value)} />
                  </div>
                  {shareType === 'internal' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Consultor Parceiro</Label>
                        <Select value={internalColleagueId} onValueChange={(v) => { setInternalColleagueId(v); setPartnerPct('') }}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar consultor..." /></SelectTrigger>
                          <SelectContent>
                            {consultants.filter((c) => c.id !== consultantId).map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {internalColleagueId && (
                        <div className="space-y-2 col-span-2">
                          <Label>% Escalao Parceiro</Label>
                          <Input type="number" min={0} max={100} step={0.1} value={partnerPct} onChange={(e) => setPartnerPct(e.target.value)} />
                          {tier && <p className="text-[10px] text-muted-foreground">Auto: {tier.consultant_rate}%</p>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label>Agencia Parceira</Label>
                      <Input placeholder="Nome da agencia" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Referrals */}
            <div className="space-y-3">
              {/* Seller side referral */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="seller-ref" className="font-normal">
                  Referenciacao lado {hasShare && shareType === 'internal' ? 'angariacao' : 'vendedor'}
                </Label>
                <Switch id="seller-ref" checked={sellerHasReferral} onCheckedChange={setSellerHasReferral} />
              </div>
              {sellerHasReferral && (
                <div className="grid grid-cols-3 gap-4 rounded-lg border p-4 bg-muted/30">
                  <div className="space-y-2">
                    <Label>Consultor</Label>
                    <Select value={sellerReferralAgentId} onValueChange={(v) => { setSellerReferralAgentId(v); setSellerReferralTierPct('') }}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {consultants.filter((c) => c.id !== consultantId && c.id !== internalColleagueId).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>% Referenciacao</Label>
                    <Input type="number" min={0} max={100} step={0.1} placeholder="10" value={sellerReferralPct} onChange={(e) => setSellerReferralPct(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>% Escalao</Label>
                    <Input type="number" min={0} max={100} step={0.1} value={sellerReferralTierPct} onChange={(e) => setSellerReferralTierPct(e.target.value)} />
                    {tier && <p className="text-[10px] text-muted-foreground">Auto: {tier.consultant_rate}%</p>}
                  </div>
                </div>
              )}

              {/* Buyer side referral (only visible with internal share) */}
              {hasShare && shareType === 'internal' && (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="buyer-ref" className="font-normal">Referenciacao lado comprador</Label>
                    <Switch id="buyer-ref" checked={buyerHasReferral} onCheckedChange={setBuyerHasReferral} />
                  </div>
                  {buyerHasReferral && (
                    <div className="grid grid-cols-3 gap-4 rounded-lg border p-4 bg-muted/30">
                      <div className="space-y-2">
                        <Label>Consultor</Label>
                        <Select value={buyerReferralAgentId} onValueChange={(v) => { setBuyerReferralAgentId(v); setBuyerReferralTierPct('') }}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            {consultants.filter((c) => c.id !== consultantId && c.id !== internalColleagueId).map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>% Referenciacao</Label>
                        <Input type="number" min={0} max={100} step={0.1} placeholder="10" value={buyerReferralPct} onChange={(e) => setBuyerReferralPct(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>% Escalao</Label>
                        <Input type="number" min={0} max={100} step={0.1} value={buyerReferralTierPct} onChange={(e) => setBuyerReferralTierPct(e.target.value)} />
                        {tier && <p className="text-[10px] text-muted-foreground">Auto: {tier.consultant_rate}%</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tier */}
            {tier && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Escalao detectado:</span>
                <Badge variant="secondary">{tier.name} — {tier.consultant_rate}%</Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label>% Consultor *</Label>
              <Input type="number" min={0} max={100} step={0.1} value={consultantPct} onChange={(e) => setConsultantPct(e.target.value)} />
            </div>

            {/* Preview */}
            {preview && (
              <>
                <Separator />
                <Card>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Comissao total</span><span className="font-medium">{fmtCurrency(preview.commission_total)}</span></div>
                    {hasShare && <div className="flex justify-between text-muted-foreground"><span>Partilha parceiro</span><span>{fmtCurrency(preview.partner_amount)}</span></div>}
                    {hasShare && <div className="flex justify-between"><span>Nossa parte</span><span className="font-medium">{fmtCurrency(preview.share_amount)}</span></div>}
                    <div className="flex justify-between text-muted-foreground"><span>Rede</span><span>{fmtCurrency(preview.network_amount)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Margem agencia</span><span>{fmtCurrency(preview.agency_margin)}</span></div>
                    <div className="flex justify-between"><span>Consultor</span><span className="font-medium">{fmtCurrency(preview.consultant_amount)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Liquido agencia</span><span>{fmtCurrency(preview.agency_net)}</span></div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-medium">Momentos de Pagamento</Label>

            {dealType === 'arrendamento' ? (
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">Arrendamento utiliza momento unico de pagamento.</p>
              </div>
            ) : (
              <RadioGroup value={paymentStructure} onValueChange={(v) => setPaymentStructure(v as PaymentStructure)} className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cpcv_only" id="ps-cpcv" />
                  <Label htmlFor="ps-cpcv" className="font-normal cursor-pointer">100% no CPCV</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="escritura_only" id="ps-esc" />
                  <Label htmlFor="ps-esc" className="font-normal cursor-pointer">100% na Escritura</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="split" id="ps-split" />
                  <Label htmlFor="ps-split" className="font-normal cursor-pointer">Split CPCV / Escritura</Label>
                </div>
              </RadioGroup>
            )}

            {paymentStructure === 'split' && dealType !== 'arrendamento' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>% CPCV</Label>
                  <Input type="number" min={0} max={100} value={cpcvPct} onChange={(e) => { setCpcvPct(e.target.value); setEscrituraPct(String(100 - (parseFloat(e.target.value) || 0))) }} />
                </div>
                <div className="space-y-2">
                  <Label>% Escritura</Label>
                  <Input type="number" min={0} max={100} value={escrituraPct} onChange={(e) => { setEscrituraPct(e.target.value); setCpcvPct(String(100 - (parseFloat(e.target.value) || 0))) }} />
                </div>
              </div>
            )}

            {/* Per-moment dates */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Datas dos Momentos</Label>
              <div className="grid grid-cols-2 gap-4">
                {dealType === 'venda' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Data CPCV</Label>
                      <Input type="date" value={cpcvDate} onChange={(e) => setCpcvDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Data Escritura</Label>
                      <Input type="date" value={escrituraDate} onChange={(e) => setEscrituraDate(e.target.value)} />
                    </div>
                  </>
                )}
                {(dealType === 'arrendamento' || dealType === 'trespasse') && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data de Assinatura</Label>
                    <Input type="date" value={cpcvDate} onChange={(e) => setCpcvDate(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Payment preview */}
            {preview && preview.payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  {preview.payments.map((p) => (
                    <Card key={p.moment}>
                      <CardContent className="pt-4 space-y-1 text-sm">
                        <div className="flex justify-between font-medium">
                          <span className="capitalize">{p.moment === 'single' ? 'Pagamento Unico' : p.moment === 'cpcv' ? 'CPCV' : 'Escritura'}</span>
                          <span>{fmtCurrency(p.amount)} ({p.pct}%)</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground"><span>Rede</span><span>{fmtCurrency(p.network)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Consultor</span><span>{fmtCurrency(p.consultant)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Agencia</span><span>{fmtCurrency(p.agency)}</span></div>
                        {hasShare && <div className="flex justify-between text-muted-foreground"><span>Parceiro</span><span>{fmtCurrency(p.partner)}</span></div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Seguinte <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Negocio
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
