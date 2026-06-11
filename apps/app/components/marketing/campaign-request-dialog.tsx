'use client'

import { useState, useEffect, useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import type { CartCampaignItem } from '@/types/marketing'
import { CAMPAIGN_OBJECTIVES, formatCurrency } from '@/lib/constants'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { Megaphone, Loader2, Building2, Link2, Users, CalendarDays } from 'lucide-react'

const CAMPAIGN_TYPES = {
  compradores: 'Compradores',
  vendedores: 'Vendedores',
  arrendatarios: 'Arrendatários',
  senhorios: 'Senhorios',
  outros: 'Outros',
} as const

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

interface PartnerOption {
  id: string
  commercial_name: string
}

export function CampaignRequestDialog({
  open,
  onOpenChange,
  onAddToCart,
}: CampaignRequestDialogProps) {
  const { user } = useUser()
  const { hasPermission } = usePermissions()
  // Gestão/admin (permissão `users`) escolhe entre todos os imóveis da
  // agência; consultor só entre os seus.
  const canSeeAllProperties = hasPermission('users')

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [objective, setObjective] = useState('')
  const [campaignType, setCampaignType] = useState('')
  const [linkMode, setLinkMode] = useState<'property' | 'url'>('property')
  const [propertyId, setPropertyId] = useState('')
  const [promoteUrl, setPromoteUrl] = useState('')
  const [budgetType, setBudgetType] = useState<'daily' | 'total'>('daily')
  const [budgetAmount, setBudgetAmount] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [creativeNotes, setCreativeNotes] = useState('')

  // Properties for selector
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)

  // Marketing partners for the picker (who executes the campaign).
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)

  // Fetch properties when sheet opens — gestão/admin vê todos os imóveis;
  // consultor só os seus. Mais recentes primeiro (a API pagina por
  // `per_page`, máx. 100).
  useEffect(() => {
    if (!open || !user?.id) return
    setLoadingProperties(true)
    const base = '/api/properties?per_page=100&sort_by=created_at&sort_dir=desc'
    fetch(canSeeAllProperties ? base : `${base}&consultant_id=${user.id}`)
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
  }, [open, user?.id, canSeeAllProperties])

  // Fetch marketing partners when sheet opens; auto-select if only one.
  useEffect(() => {
    if (!open) return
    setLoadingPartners(true)
    fetch('/api/marketing/partners')
      .then((r) => r.json())
      .then((data) => {
        const items: PartnerOption[] = Array.isArray(data) ? data : data?.data ?? []
        setPartners(items)
        if (items.length === 1) setPartnerId(items[0].id)
      })
      .catch(() => setPartners([]))
      .finally(() => setLoadingPartners(false))
  }, [open])

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setPartnerId('')
      setObjective('')
      setCampaignType('')
      setLinkMode('property')
      setPropertyId('')
      setPromoteUrl('')
      setBudgetType('daily')
      setBudgetAmount('')
      setDateRange(undefined)
      setCalendarOpen(false)
      setCreativeNotes('')
    }
  }, [open])

  const amount = parseFloat(budgetAmount) || 0

  // Inclusive day count from the selected date range (e.g. 1→7 Jun = 7 dias).
  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange.to) return 0
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1
  }, [dateRange])

  const adsBudget = useMemo(() => {
    if (budgetType === 'daily') return amount * days
    return amount
  }, [budgetType, amount, days])

  const computedTotal = adsBudget

  const isValid =
    partnerId !== '' &&
    objective !== '' &&
    campaignType !== '' &&
    (linkMode === 'property' ? propertyId !== '' : promoteUrl.trim() !== '') &&
    amount > 0 &&
    days > 0

  const handleSubmit = () => {
    if (!isValid || !dateRange?.from || !dateRange.to) return

    const typeLabel = CAMPAIGN_TYPES[campaignType as keyof typeof CAMPAIGN_TYPES] ?? campaignType
    const label = `Campanha ${CAMPAIGN_OBJECTIVES[objective] ?? objective} (${typeLabel}) — ${days} dias`

    onAddToCart({
      type: 'campaign',
      campaignData: {
        partner_id: partnerId,
        objective,
        campaign_type: campaignType as CartCampaignItem['campaignData']['campaign_type'],
        property_id: linkMode === 'property' ? propertyId : undefined,
        promote_url: linkMode === 'url' ? promoteUrl.trim() : undefined,
        budget_type: budgetType,
        budget_amount: amount,
        duration_days: days,
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
        creative_notes: creativeNotes.trim() || undefined,
      },
      managementFee: 0,
      totalCost: computedTotal,
      label,
    })

    onOpenChange(false)
  }

  const rangeLabel =
    dateRange?.from && dateRange.to
      ? `${format(dateRange.from, 'dd MMM', { locale: pt })} – ${format(dateRange.to, 'dd MMM yyyy', { locale: pt })}`
      : dateRange?.from
        ? `${format(dateRange.from, 'dd MMM yyyy', { locale: pt })} – …`
        : 'Escolher datas'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          'w-full sm:max-w-[580px] rounded-l-3xl sm:rounded-l-3xl'
        )}
      >
        {/* ─── Header ─── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            Nova Campanha Meta Ads
          </SheetTitle>
          <SheetDescription>Configure os detalhes da campanha</SheetDescription>
        </SheetHeader>

        {/* ─── Body ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* ─── Parceiro executor ─── */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Users className="h-3.5 w-3.5" />
              Parceiro *
            </Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className="h-11 rounded-full text-[15px]">
                <SelectValue placeholder="Seleccionar parceiro" />
              </SelectTrigger>
              <SelectContent>
                {partners.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {loadingPartners ? 'A carregar parceiros...' : 'Sem parceiros disponíveis'}
                  </div>
                )}
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O parceiro recebe o pedido e fica como referenciado dos leads gerados.
            </p>
          </div>

          {/* ─── Objectivo ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Objectivo *
            </Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger className="h-11 rounded-full text-[15px]">
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

          {/* ─── Tipo de Campanha ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Tipo *
            </Label>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger className="h-11 rounded-full text-[15px]">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAMPAIGN_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ─── Imóvel ou Link ─── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Imóvel ou Link *
            </Label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLinkMode('property')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  linkMode === 'property'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Imóvel
              </button>
              <button
                type="button"
                onClick={() => setLinkMode('url')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  linkMode === 'url'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                URL
              </button>
            </div>

            {linkMode === 'property' ? (
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="h-11 rounded-full text-[15px] max-w-full overflow-hidden">
                  <span className="truncate block text-left">
                    <SelectValue
                      placeholder={loadingProperties ? 'A carregar imóveis...' : 'Seleccionar imóvel'}
                    />
                  </span>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] max-h-[320px]"
                >
                  {properties.length === 0 && !loadingProperties && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Não tens imóveis angariados.
                    </div>
                  )}
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="block truncate">
                        {p.external_ref ? `${p.external_ref} — ` : ''}
                        {p.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-11 rounded-full text-[15px]"
                placeholder="https://..."
                value={promoteUrl}
                onChange={(e) => setPromoteUrl(e.target.value)}
              />
            )}
          </div>

          {/* ─── Orçamento ─── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Orçamento *
            </Label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBudgetType('daily')}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  budgetType === 'daily'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                Diário
              </button>
              <button
                type="button"
                onClick={() => setBudgetType('total')}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  budgetType === 'total'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                Total
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Valor ({budgetType === 'daily' ? 'por dia' : 'total'})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  &euro;
                </span>
                <Input
                  className="h-11 rounded-full pl-8 text-[15px]"
                  type="number"
                  min={1}
                  step={0.01}
                  placeholder="0,00"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ─── Período (calendário) ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Período *
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-11 w-full justify-start rounded-full text-[15px] font-normal',
                    !dateRange?.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {rangeLabel}
                  {days > 0 && (
                    <span className="ml-auto text-xs font-medium text-muted-foreground">{days} dias</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={pt}
                  numberOfMonths={1}
                  defaultMonth={dateRange?.from ?? new Date()}
                  disabled={{ before: new Date() }}
                />
                <div className="flex justify-end gap-2 border-t p-2">
                  <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dateRange?.from || !dateRange.to}
                    onClick={() => setCalendarOpen(false)}
                  >
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* ─── Notas criativas ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
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
          <div className="rounded-2xl bg-foreground text-background p-4 space-y-1">
            <div className="flex justify-between text-xs opacity-70">
              <span>{budgetType === 'daily' ? `${formatCurrency(amount)} /dia × ${days} dias` : 'Orçamento total'}</span>
              <span>{formatCurrency(adsBudget)}</span>
            </div>
            <div className="border-t border-background/15 pt-1 flex justify-between text-base font-bold">
              <span>Total estimado</span>
              <span>{formatCurrency(computedTotal)}</span>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 shrink-0">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" disabled={!isValid} onClick={handleSubmit}>
            Adicionar ao Carrinho
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
