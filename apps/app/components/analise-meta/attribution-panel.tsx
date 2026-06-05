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
import { useDebounce } from '@/hooks/use-debounce'

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
}: {
  scope: Scope
  targetId: string
  targetName?: string | null
  /** Render without the outer Card (for embedding inside another card). */
  bare?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [rule, setRule] = useState<AttributionRule | null>(null)
  // Collapsed once attributed; expanded when unattributed or while editing.
  const [expanded, setExpanded] = useState(false)

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
    // Collapse when attributed (show summary); expand to attribute when empty.
    setExpanded(!r?.consultant_id)
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
    <div className="space-y-1 text-sm">
      <p>
        <span className="text-muted-foreground">Responsável: </span>
        <span className="font-medium">{nameOf(rule.consultant_id)}</span>
      </p>
      {(rule.lead_business_type || rule.lead_sector) && (
        <p className="text-muted-foreground">
          Tipo:{' '}
          {[rule.lead_business_type, PERSPECTIVES.find((p) => p.sector === rule.lead_sector)?.label]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {rule.has_referral && rule.referral_consultant_id && (
        <p className="text-muted-foreground flex items-center gap-1.5">
          <Gift className="h-3.5 w-3.5" />
          Referral para {nameOf(rule.referral_consultant_id)}
          {rule.referral_basis === 'fixed'
            ? ` — €${rule.referral_fixed_amount ?? 0}`
            : ` — ${rule.referral_pct ?? 0}% (${BASIS_LABEL[rule.referral_basis]})`}
        </p>
      )}
      {rule.property_id && (
        <p className="text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Imóvel: {propertyLabel ?? 'associado'}
        </p>
      )}
    </div>
  ) : (
    <p className="text-muted-foreground text-sm">
      Sem atribuição definida. Os leads {scopeLabel} ficam por atribuir.
    </p>
  )

  const body = (
    <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
          </div>
        ) : !canManage ? (
          summaryNode
        ) : rule && !expanded ? (
          // Attributed → collapsed summary with an edit affordance.
          <div className="flex items-start justify-between gap-3">
            {summaryNode}
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setExpanded(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        ) : (
          // Editable form for managers/Marketing
          <>
            <div className="space-y-1.5">
              <Label>Consultor responsável</Label>
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
            </div>

            {/* Lead type — pre-fills the qualification of every lead from this campaign/ad */}
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
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

            <div className="flex items-center justify-between rounded-md border p-3">
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
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
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

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar atribuição
              </Button>
              {rule && (
                <Button variant="ghost" onClick={() => setExpanded(false)} disabled={saving}>
                  Cancelar
                </Button>
              )}
              {rule && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={saving}
                  className="text-destructive hover:text-destructive ml-auto"
                >
                  Remover
                </Button>
              )}
            </div>
          </>
        )}
    </div>
  )

  if (bare) {
    return (
      <div className="space-y-4">
        {headerNode}
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>{headerNode}</CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
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
