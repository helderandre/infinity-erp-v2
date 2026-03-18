'use client'

import { useState, useEffect, useMemo } from 'react'
import type { CartCampaignItem } from '@/types/marketing'
import { CAMPAIGN_OBJECTIVES, formatCurrency } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Megaphone, Loader2, Building2, Link2 } from 'lucide-react'

interface CampaignRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (item: CartCampaignItem) => void
}

interface PropertyOption {
  id: string
  title: string
  external_ref?: string
}

export function CampaignRequestDialog({
  open,
  onOpenChange,
  onAddToCart,
}: CampaignRequestDialogProps) {
  // Form state
  const [objective, setObjective] = useState('')
  const [linkMode, setLinkMode] = useState<'property' | 'url'>('property')
  const [propertyId, setPropertyId] = useState('')
  const [promoteUrl, setPromoteUrl] = useState('')
  const [targetZone, setTargetZone] = useState('')
  const [targetAgeMin, setTargetAgeMin] = useState<string>('')
  const [targetAgeMax, setTargetAgeMax] = useState<string>('')
  const [targetInterests, setTargetInterests] = useState('')
  const [budgetType, setBudgetType] = useState<'daily' | 'total'>('daily')
  const [budgetAmount, setBudgetAmount] = useState<string>('')
  const [durationDays, setDurationDays] = useState<string>('')
  const [creativeNotes, setCreativeNotes] = useState('')

  // Properties for selector
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)

  // Fetch properties when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadingProperties(true)
    fetch('/api/properties?limit=200')
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.data ?? []
        setProperties(
          items.map((p: Record<string, string>) => ({
            id: p.id,
            title: p.title || 'Sem título',
            external_ref: p.external_ref,
          }))
        )
      })
      .catch(() => setProperties([]))
      .finally(() => setLoadingProperties(false))
  }, [open])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setObjective('')
      setLinkMode('property')
      setPropertyId('')
      setPromoteUrl('')
      setTargetZone('')
      setTargetAgeMin('')
      setTargetAgeMax('')
      setTargetInterests('')
      setBudgetType('daily')
      setBudgetAmount('')
      setDurationDays('')
      setCreativeNotes('')
    }
  }, [open])

  const amount = parseFloat(budgetAmount) || 0
  const days = parseInt(durationDays) || 0

  const computedTotal = useMemo(() => {
    if (budgetType === 'daily') return amount * days
    return amount
  }, [budgetType, amount, days])

  const isValid =
    objective !== '' &&
    (linkMode === 'property' ? propertyId !== '' : promoteUrl.trim() !== '') &&
    amount > 0 &&
    days > 0

  const handleSubmit = () => {
    if (!isValid) return

    const label = `Campanha ${CAMPAIGN_OBJECTIVES[objective] ?? objective} — ${days} dias`

    onAddToCart({
      type: 'campaign',
      campaignData: {
        objective,
        property_id: linkMode === 'property' ? propertyId : undefined,
        promote_url: linkMode === 'url' ? promoteUrl.trim() : undefined,
        target_zone: targetZone.trim() || undefined,
        target_age_min: targetAgeMin ? parseInt(targetAgeMin) : undefined,
        target_age_max: targetAgeMax ? parseInt(targetAgeMax) : undefined,
        target_interests: targetInterests.trim() || undefined,
        budget_type: budgetType,
        budget_amount: amount,
        duration_days: days,
        creative_notes: creativeNotes.trim() || undefined,
      },
      totalCost: computedTotal,
      label,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[80vh] overflow-y-auto rounded-2xl p-0">
        {/* ─── Dark Header ─── */}
        <div className="bg-neutral-900 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Megaphone className="h-5 w-5" />
              </div>
              Nova Campanha Meta Ads
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Configure os detalhes da campanha
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-4">
          {/* ─── Objectivo ─── */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Objectivo *
            </Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger className="rounded-full">
                <SelectValue placeholder="Seleccionar objectivo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAMPAIGN_OBJECTIVES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ─── Imóvel ou Link ─── */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Imóvel ou Link *
            </Label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLinkMode('property')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  linkMode === 'property'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Imóvel
              </button>
              <button
                type="button"
                onClick={() => setLinkMode('url')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  linkMode === 'url'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                URL
              </button>
            </div>

            {linkMode === 'property' ? (
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="rounded-full">
                  <SelectValue
                    placeholder={loadingProperties ? 'A carregar imóveis...' : 'Seleccionar imóvel'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.external_ref ? `${p.external_ref} — ` : ''}
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="rounded-full"
                placeholder="https://..."
                value={promoteUrl}
                onChange={(e) => setPromoteUrl(e.target.value)}
              />
            )}
          </div>

          {/* ─── Público-alvo ─── */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Público-alvo
            </Label>

            <div className="space-y-2">
              <Input
                className="rounded-full"
                placeholder="Ex: Lisboa, Porto, Algarve"
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Idade mínima</Label>
                <Input
                  className="rounded-full"
                  type="number"
                  min={18}
                  max={65}
                  placeholder="18"
                  value={targetAgeMin}
                  onChange={(e) => setTargetAgeMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Idade máxima</Label>
                <Input
                  className="rounded-full"
                  type="number"
                  min={18}
                  max={65}
                  placeholder="65"
                  value={targetAgeMax}
                  onChange={(e) => setTargetAgeMax(e.target.value)}
                />
              </div>
            </div>

            <Input
              className="rounded-full"
              placeholder="Ex: imobiliário, investimento, decoração"
              value={targetInterests}
              onChange={(e) => setTargetInterests(e.target.value)}
            />
          </div>

          {/* ─── Orçamento ─── */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Orçamento *
            </Label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBudgetType('daily')}
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  budgetType === 'daily'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Diário
              </button>
              <button
                type="button"
                onClick={() => setBudgetType('total')}
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  budgetType === 'total'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Total
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Valor ({budgetType === 'daily' ? 'por dia' : 'total'})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    &euro;
                  </span>
                  <Input
                    className="rounded-full pl-8"
                    type="number"
                    min={1}
                    step={0.01}
                    placeholder="0,00"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Número de dias</Label>
                <Input
                  className="rounded-full"
                  type="number"
                  min={1}
                  placeholder="7"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
              </div>
            </div>

            {amount > 0 && days > 0 && (
              <p className="text-xs text-muted-foreground">
                {budgetType === 'daily'
                  ? `${formatCurrency(amount)} /dia x ${days} dias = ${formatCurrency(computedTotal)}`
                  : `${formatCurrency(amount)} total durante ${days} dias`}
              </p>
            )}
          </div>

          {/* ─── Notas criativas ─── */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Notas Criativas
            </Label>
            <Textarea
              className="rounded-xl min-h-[80px] resize-none"
              placeholder="Descrição do que pretende promover, tom da comunicação, etc."
              value={creativeNotes}
              onChange={(e) => setCreativeNotes(e.target.value)}
            />
          </div>

          {/* ─── Total ─── */}
          <div className="rounded-xl bg-neutral-900 text-white p-4">
            <div className="flex justify-between text-base font-bold">
              <span>Total estimado</span>
              <span>{formatCurrency(computedTotal)}</span>
            </div>
            {budgetType === 'daily' && days > 0 && amount > 0 && (
              <p className="text-xs text-white/50 mt-1">
                {formatCurrency(amount)} /dia &times; {days} dias
              </p>
            )}
          </div>

          {/* ─── Footer ─── */}
          <div className="flex justify-end gap-3 pt-1">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              disabled={!isValid}
              onClick={handleSubmit}
            >
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
