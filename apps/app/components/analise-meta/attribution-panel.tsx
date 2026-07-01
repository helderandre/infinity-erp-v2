'use client'

/**
 * Painel de atribuição de uma campanha/anúncio Meta a um consultor (+ referral).
 * Usado nas páginas de detalhe de campanha e de anúncio em Análise Meta.
 *
 * Lê o estado via GET /api/analise-meta/attribution (devolve a regra actual +
 * can_manage). Quem não é gestão/Marketing vê só a leitura. Guardar/Remover
 * fazem POST/DELETE no mesmo endpoint.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserCog, Gift, Pencil, Building2, X, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type Scope = 'campaign' | 'ad'
type ReferralBasis = 'agency_commission' | 'sale_value' | 'fixed'

interface Consultant {
  id: string
  commercial_name: string | null
}

interface AttributionRule {
  id: string
  consultant_id: string | null
  has_referral: boolean
  referral_consultant_id: string | null
  referral_pct: number | null
  referral_basis: ReferralBasis
  referral_fixed_amount: number | null
  lead_sector: string | null
  lead_business_type: string | null
  property_id: string | null
}

interface LinkedProperty {
  id: string
  title: string | null
  external_ref: string | null
}

const BASIS_LABEL: Record<ReferralBasis, string> = {
  agency_commission: '% da comissão da agência',
  sale_value: '% do valor do negócio',
  fixed: 'Valor fixo (€)',
}

const NONE = '__none__'

// Business type options (sell/rent/trespasse).
const BUSINESS_TYPES = ['Venda', 'Arrendamento', 'Trespasse'] as const

// Perspective → sector. The qualify dialog speaks `sector`.
const PERSPECTIVES: { label: string; sector: string }[] = [
  { label: 'Comprador', sector: 'real_estate_buy' },
  { label: 'Vendedor', sector: 'real_estate_sell' },
  { label: 'Arrendatário', sector: 'real_estate_rent' },
  { label: 'Senhorio', sector: 'real_estate_landlord' },
]

export function AttributionPanel({
  scope,
  targetId,
  targetName,
  bare = false,
  compact = false,
}: {
  scope: Scope
  targetId: string
  targetName?: string | null
  /** Render without the outer Card (for embedding inside another card). */
  bare?: boolean
  /** Render as a small clickable chip ("Atribuída a: X" / "Atribuição da
   *  campanha") that opens the edit sheet — for headers/top-right corners. */
  compact?: boolean
}) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [rule, setRule] = useState<AttributionRule | null>(null)
  // The panel shows a read-only summary; editing happens in a glass sheet.
  const [editing, setEditing] = useState(false)

  // form state
  const [consultantId, setConsultantId] = useState('')
  const [hasReferral, setHasReferral] = useState(false)
  const [referralConsultantId, setReferralConsultantId] = useState('')
  const [referralBasis, setReferralBasis] = useState<ReferralBasis>('agency_commission')
  const [referralPct, setReferralPct] = useState('')
  const [referralFixed, setReferralFixed] = useState('')
  const [leadBusinessType, setLeadBusinessType] = useState<string>(NONE)
  const [leadSector, setLeadSector] = useState<string>(NONE)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [propertyLabel, setPropertyLabel] = useState<string | null>(null)

  const hydrate = useCallback((r: AttributionRule | null, property?: LinkedProperty | null) => {
    setRule(r)
    setConsultantId(r?.consultant_id ?? '')
    setHasReferral(r?.has_referral ?? false)
    setReferralConsultantId(r?.referral_consultant_id ?? '')
    setReferralBasis(r?.referral_basis ?? 'agency_commission')
    setReferralPct(r?.referral_pct != null ? String(r.referral_pct) : '')
    setReferralFixed(r?.referral_fixed_amount != null ? String(r.referral_fixed_amount) : '')
    setLeadBusinessType(r?.lead_business_type ?? NONE)
    setLeadSector(r?.lead_sector ?? NONE)
    setPropertyId(r?.property_id ?? null)
    setPropertyLabel(
      property ? [property.title, property.external_ref].filter(Boolean).join(' · ') || null : null,
    )
    // Hydrating always closes the edit sheet (initial load, after save/remove).
    setEditing(false)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [attRes, consRes] = await Promise.all([
          fetch(`/api/analise-meta/attribution?scope=${scope}&target_id=${encodeURIComponent(targetId)}`),
          fetch('/api/users/consultants'),
        ])
        const att = await attRes.json()
        const cons = await consRes.json()
        if (!active) return
        setCanManage(!!att.can_manage)
        hydrate(att.rule ?? null, att.property ?? null)
        setConsultants(Array.isArray(cons) ? cons : cons.data ?? [])
      } catch {
        if (active) toast.error('Erro ao carregar atribuição.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [scope, targetId, hydrate])

  const nameOf = (id: string | null) =>
    consultants.find((c) => c.id === id)?.commercial_name ?? '—'

  const initialsOf = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  async function handleSave() {
    if (!consultantId) {
      toast.error('Escolha o consultor responsável.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/analise-meta/attribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          target_id: targetId,
          target_name: targetName ?? null,
          consultant_id: consultantId,
          has_referral: hasReferral,
          referral_consultant_id: hasReferral ? referralConsultantId || null : null,
          referral_basis: referralBasis,
          referral_pct: hasReferral && referralBasis !== 'fixed' ? Number(referralPct) : null,
          referral_fixed_amount: hasReferral && referralBasis === 'fixed' ? Number(referralFixed) : null,
          lead_business_type: leadBusinessType === NONE ? null : leadBusinessType,
          lead_sector: leadSector === NONE ? null : leadSector,
          property_id: propertyId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Não foi possível guardar.')
        return
      }
      hydrate(json.rule, json.property ?? null)
      toast.success('Atribuição guardada.')
    } catch {
      toast.error('Erro de rede ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/analise-meta/attribution?scope=${scope}&target_id=${encodeURIComponent(targetId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        toast.error('Não foi possível remover.')
        return
      }
      hydrate(null)
      toast.success('Atribuição removida.')
    } catch {
      toast.error('Erro de rede ao remover.')
    } finally {
      setSaving(false)
    }
  }

  // Open the edit sheet, resetting form fields to the saved rule so any
  // discarded edits from a previous open don't linger.
  function openEditor() {
    setConsultantId(rule?.consultant_id ?? '')
    setHasReferral(rule?.has_referral ?? false)
    setReferralConsultantId(rule?.referral_consultant_id ?? '')
    setReferralBasis(rule?.referral_basis ?? 'agency_commission')
    setReferralPct(rule?.referral_pct != null ? String(rule.referral_pct) : '')
    setReferralFixed(rule?.referral_fixed_amount != null ? String(rule.referral_fixed_amount) : '')
    setLeadBusinessType(rule?.lead_business_type ?? NONE)
    setLeadSector(rule?.lead_sector ?? NONE)
    setPropertyId(rule?.property_id ?? null)
    setEditing(true)
  }

  const scopeLabel = scope === 'ad' ? 'deste anúncio' : 'desta campanha'

  const headerNode = (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-base font-semibold">
        <UserCog className="h-4 w-4" />
        Atribuição de leads
      </div>
      <p className="text-muted-foreground text-sm">
        {scope === 'ad'
          ? 'O consultor deste anúncio recebe os leads — sobrepõe-se à atribuição da campanha.'
          : 'Todos os leads desta campanha vão para este consultor (um anúncio pode ter atribuição própria).'}
      </p>
    </div>
  )

  const summaryNode = rule?.consultant_id ? (
    <div className="space-y-3">
      {/* Responsável — avatar + name, with type badges on the right */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {initialsOf(nameOf(rule.consultant_id))}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Responsável
          </p>
          <p className="truncate font-medium leading-tight">{nameOf(rule.consultant_id)}</p>
        </div>
        {(rule.lead_business_type || rule.lead_sector) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            {rule.lead_business_type && (
              <Badge variant="secondary" className="font-normal">
                {rule.lead_business_type}
              </Badge>
            )}
            {rule.lead_sector && (
              <Badge variant="outline" className="font-normal">
                {PERSPECTIVES.find((p) => p.sector === rule.lead_sector)?.label}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Referral + property chips */}
      {((rule.has_referral && rule.referral_consultant_id) || rule.property_id) && (
        <div className="flex flex-wrap gap-2">
          {rule.has_referral && rule.referral_consultant_id && (
            <span className="border-border/60 bg-muted/40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <Gift className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium">{nameOf(rule.referral_consultant_id)}</span>
              <span className="text-muted-foreground">
                {rule.referral_basis === 'fixed'
                  ? `€${rule.referral_fixed_amount ?? 0}`
                  : `${rule.referral_pct ?? 0}% · ${BASIS_LABEL[rule.referral_basis]}`}
              </span>
            </span>
          )}
          {rule.property_id && (
            <span className="border-border/60 bg-muted/40 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span className="truncate">{propertyLabel ?? 'Imóvel associado'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3">
      <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <UserCog className="h-4 w-4" />
      </div>
      <p className="text-muted-foreground text-sm">
        Sem atribuição definida. Os leads {scopeLabel} ficam por atribuir.
      </p>
    </div>
  )

  // Read-only panel body: summary + an affordance to open the edit sheet.
  const body = (
    <div className="space-y-3">
      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : (
        <>
          {summaryNode}
          {canManage && (
            <div className="border-border/40 flex justify-end border-t pt-3">
              <Button variant="outline" size="sm" onClick={openEditor}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {rule?.consultant_id ? 'Editar atribuição' : 'Definir atribuição'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )

  // The editable form — rendered inside the glass sheet.
  const formNode = (
    <>
            <div className="border-primary/20 bg-primary/[0.03] space-y-1.5 rounded-lg border p-3">
              <Label className="flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5" /> Consultor responsável
              </Label>
              <Select value={consultantId} onValueChange={setConsultantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher consultor…" />
                </SelectTrigger>
                <SelectContent>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.commercial_name ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Recebe todos os leads {scopeLabel}.
              </p>
            </div>

            {/* Lead type — pre-fills the qualification of every lead from this campaign/ad */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              <div className="col-span-2">
                <Label className="text-xs">Tipo de lead (opcional)</Label>
                <p className="text-muted-foreground text-xs">
                  Pré-preenche a qualificação — o consultor pode alterar.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-normal">Negócio</Label>
                <Select value={leadBusinessType} onValueChange={setLeadBusinessType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {BUSINESS_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-normal">Perspectiva</Label>
                <Select value={leadSector} onValueChange={setLeadSector}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {PERSPECTIVES.map((p) => (
                      <SelectItem key={p.sector} value={p.sector}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Imóvel associado — liga a campanha/anúncio a um imóvel; os leads
                ficam visíveis na página desse imóvel. */}
            <PropertyField
              valueId={propertyId}
              valueLabel={propertyLabel}
              onChange={(id, label) => {
                setPropertyId(id)
                setPropertyLabel(label)
              }}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" /> Comissão de referência
                </Label>
                <p className="text-muted-foreground text-xs">
                  Atribui uma comissão a outro consultor por cada lead {scopeLabel}.
                </p>
              </div>
              <Switch checked={hasReferral} onCheckedChange={setHasReferral} />
            </div>

            {hasReferral && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label>Beneficiário</Label>
                  <Select value={referralConsultantId} onValueChange={setReferralConsultantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quem recebe a comissão…" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.commercial_name ?? c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Base</Label>
                  <Select
                    value={referralBasis}
                    onValueChange={(v) => setReferralBasis(v as ReferralBasis)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BASIS_LABEL) as ReferralBasis[]).map((b) => (
                        <SelectItem key={b} value={b}>
                          {BASIS_LABEL[b]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {referralBasis === 'fixed' ? (
                  <div className="space-y-1.5">
                    <Label>Valor fixo (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={referralFixed}
                      onChange={(e) => setReferralFixed(e.target.value)}
                      placeholder="Ex.: 200"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Percentagem (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={referralPct}
                      onChange={(e) => setReferralPct(e.target.value)}
                      placeholder="Ex.: 5"
                    />
                    {referralBasis !== 'agency_commission' && (
                      <p className="text-amber-600 text-xs">
                        Nota: só a base &quot;% da comissão&quot; é calculada automaticamente
                        nas comissões por agora.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

    </>
  )

  // The glass sheet that hosts the editable form.
  const sheetNode = (
    <Sheet open={editing} onOpenChange={setEditing}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'border-border/40 flex flex-col gap-0 overflow-hidden p-0 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="bg-muted-foreground/25 absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full" />
        )}

        <SheetHeader className={cn('border-border/40 shrink-0 border-b px-6 pb-4', isMobile ? 'pt-8' : 'pt-6')}>
          <SheetTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" />
            Atribuição de leads
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            {scope === 'ad'
              ? 'O consultor deste anúncio recebe os leads — sobrepõe-se à atribuição da campanha.'
              : 'Todos os leads desta campanha vão para este consultor (um anúncio pode ter atribuição própria).'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">{formNode}</div>

        <SheetFooter className="border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 shrink-0 flex-row items-center gap-2 border-t px-6 py-4 backdrop-blur-md">
          <Button className="rounded-full" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar atribuição
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
          {rule && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={saving}
              className="text-destructive hover:text-destructive ml-auto rounded-full"
            >
              Remover
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )

  if (compact) {
    const attributed = !!rule?.consultant_id
    return (
      <>
        <button
          type="button"
          disabled={!canManage}
          onClick={canManage ? openEditor : undefined}
          title={canManage ? 'Editar atribuição' : undefined}
          className={cn(
            'group border-border/50 bg-card/60 inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left shadow-sm backdrop-blur-xl transition-all',
            canManage && 'hover:border-border/80 cursor-pointer hover:shadow',
          )}
        >
          {loading ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atribuição…
            </span>
          ) : attributed ? (
            <>
              <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                {initialsOf(nameOf(rule!.consultant_id))}
              </span>
              <span className="min-w-0">
                <span className="text-muted-foreground block text-[10px] uppercase leading-none tracking-wide">Atribuída a</span>
                <span className="block max-w-[170px] truncate text-xs font-medium leading-tight">{nameOf(rule!.consultant_id)}</span>
              </span>
            </>
          ) : (
            <>
              <span className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                <UserCog className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium">Atribuição da campanha</span>
            </>
          )}
          {canManage && !loading && (
            <Pencil className="text-muted-foreground/60 group-hover:text-foreground ml-0.5 h-3 w-3 shrink-0" />
          )}
        </button>
        {sheetNode}
      </>
    )
  }

  if (bare) {
    return (
      <div className="space-y-4">
        {headerNode}
        {body}
        {sheetNode}
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>{headerNode}</CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
      {sheetNode}
    </>
  )
}

// ── Property picker ─────────────────────────────────────────────────────────
// Lightweight searchable combobox over /api/properties. Selecting a property
// links the campaign/ad to it; the chosen value renders as a removable chip.

interface PropertyResult {
  id: string
  title: string | null
  external_ref: string | null
  city: string | null
}

function PropertyField({
  valueId,
  valueLabel,
  onChange,
}: {
  valueId: string | null
  valueLabel: string | null
  onChange: (id: string | null, label: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [results, setResults] = useState<PropertyResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setSearching(true)
    const params = new URLSearchParams({ per_page: '8' })
    if (debounced.trim()) params.set('search', debounced.trim())
    fetch(`/api/properties?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setResults(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSearching(false)
      })
    return () => {
      active = false
    }
  }, [debounced, open])

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5" /> Imóvel associado (opcional)
      </Label>
      {valueId ? (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <span className="truncate text-sm">{valueLabel ?? 'Imóvel associado'}</span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="Remover imóvel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="text-muted-foreground w-full justify-between font-normal">
              Escolher imóvel…
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por referência ou título…"
                className="h-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {searching ? (
                <div className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A pesquisar…
                </div>
              ) : results.length === 0 ? (
                <div className="text-muted-foreground px-2 py-3 text-xs">Sem resultados.</div>
              ) : (
                results.map((p) => {
                  const label = [p.title, p.external_ref].filter(Boolean).join(' · ') || p.external_ref || p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onChange(p.id, label)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="hover:bg-muted flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left"
                    >
                      <span className="w-full truncate text-sm font-medium">{p.title || 'Sem título'}</span>
                      <span className="text-muted-foreground text-[11px]">
                        {[p.external_ref, p.city].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <p className="text-muted-foreground text-xs">
        Liga esta campanha a um imóvel — os leads passam a aparecer na página do imóvel.
      </p>
    </div>
  )
}
