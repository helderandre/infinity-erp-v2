'use client'

import { useState } from 'react'
import { Save, Loader2, Star, Briefcase, TrendingUp, Euro } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  upsertOriginProfile,
  upsertPainPitch,
  upsertFinancialEvolution,
  upsertBudget,
} from '@/app/dashboard/recrutamento/actions'
import type {
  RecruitmentOriginProfile,
  RecruitmentPainPitch,
  RecruitmentFinancialEvolution,
  RecruitmentBudget,
  OriginBrand,
  CampaignPlatform,
} from '@/types/recruitment'
import { ORIGIN_BRANDS, CAMPAIGN_PLATFORMS } from '@/types/recruitment'

interface CandidateQualificationTabProps {
  candidateId: string
  originProfile: RecruitmentOriginProfile | null
  painPitchRecords: RecruitmentPainPitch[]
  financial: RecruitmentFinancialEvolution | null
  budget: RecruitmentBudget | null
  onSave: () => Promise<void>
}

const glassCard = 'rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-6 space-y-4'

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-lg font-semibold">
      <Icon className="h-5 w-5 text-muted-foreground" />
      {children}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              star <= value
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40'
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{value > 0 ? `${value}/5` : 'Sem avaliação'}</span>
    </div>
  )
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={saving} size="sm" className="mt-2">
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Guardar
    </Button>
  )
}

export function CandidateQualificationTab({
  candidateId, originProfile, painPitchRecords, financial, budget, onSave,
}: CandidateQualificationTabProps) {
  // ─── Origin Profile State ──────────────────────────────────────────
  const [op, setOp] = useState({
    currently_active_real_estate: originProfile?.currently_active_real_estate ?? false,
    origin_brand: (originProfile?.origin_brand ?? '') as OriginBrand | '',
    origin_brand_custom: originProfile?.origin_brand_custom ?? '',
    time_at_origin_months: originProfile?.time_at_origin_months ?? '',
    billing_avg_month: originProfile?.billing_avg_month ?? '',
    billing_avg_year: originProfile?.billing_avg_year ?? '',
    reason_for_leaving: originProfile?.reason_for_leaving ?? '',
  })
  const [savingOp, setSavingOp] = useState(false)

  // ─── Pain & Pitch State ────────────────────────────────────────────
  const lastPp = painPitchRecords.length > 0 ? painPitchRecords[painPitchRecords.length - 1] : null
  const [pp, setPp] = useState({
    id: lastPp?.id ?? '',
    identified_pains: lastPp?.identified_pains ?? '',
    solutions_presented: lastPp?.solutions_presented ?? '',
    candidate_objections: lastPp?.candidate_objections ?? '',
    fit_score: lastPp?.fit_score ?? 0,
  })
  const [savingPp, setSavingPp] = useState(false)

  // ─── Financial State ───────────────────────────────────────────────
  const [fin, setFin] = useState({
    billing_month_1: financial?.billing_month_1 ?? '',
    billing_month_2: financial?.billing_month_2 ?? '',
    billing_month_3: financial?.billing_month_3 ?? '',
    billing_month_6: financial?.billing_month_6 ?? '',
    billing_month_12: financial?.billing_month_12 ?? '',
    months_to_match_previous: financial?.months_to_match_previous ?? '',
    notes: financial?.notes ?? '',
  })
  const [savingFin, setSavingFin] = useState(false)

  // ─── Budget State ──────────────────────────────────────────────────
  const [bg, setBg] = useState({
    paid_campaign_used: budget?.paid_campaign_used ?? false,
    campaign_platform: (budget?.campaign_platform ?? '') as CampaignPlatform | '',
    estimated_cost: budget?.estimated_cost ?? '',
    resources_used: budget?.resources_used ?? '',
  })
  const [savingBg, setSavingBg] = useState(false)

  // ─── Handlers ──────────────────────────────────────────────────────
  async function handleSaveOrigin() {
    setSavingOp(true)
    const { error } = await upsertOriginProfile(candidateId, {
      currently_active_real_estate: op.currently_active_real_estate,
      origin_brand: op.origin_brand || null,
      origin_brand_custom: op.origin_brand === 'other' ? op.origin_brand_custom || null : null,
      time_at_origin_months: op.time_at_origin_months ? Number(op.time_at_origin_months) : null,
      billing_avg_month: op.billing_avg_month ? Number(op.billing_avg_month) : null,
      billing_avg_year: op.billing_avg_year ? Number(op.billing_avg_year) : null,
      reason_for_leaving: op.reason_for_leaving || null,
    } as Partial<RecruitmentOriginProfile>)
    setSavingOp(false)
    if (error) return toast.error(error)
    toast.success('Perfil de origem guardado')
    await onSave()
  }

  async function handleSavePainPitch() {
    setSavingPp(true)
    const payload: Partial<RecruitmentPainPitch> = {
      identified_pains: pp.identified_pains || null,
      solutions_presented: pp.solutions_presented || null,
      candidate_objections: pp.candidate_objections || null,
      fit_score: pp.fit_score || null,
    }
    if (pp.id) (payload as Record<string, unknown>).id = pp.id
    const { error } = await upsertPainPitch(candidateId, payload)
    setSavingPp(false)
    if (error) return toast.error(error)
    toast.success('Pain & Pitch guardado')
    await onSave()
  }

  async function handleSaveFinancial() {
    setSavingFin(true)
    const { error } = await upsertFinancialEvolution(candidateId, {
      billing_month_1: fin.billing_month_1 ? Number(fin.billing_month_1) : null,
      billing_month_2: fin.billing_month_2 ? Number(fin.billing_month_2) : null,
      billing_month_3: fin.billing_month_3 ? Number(fin.billing_month_3) : null,
      billing_month_6: fin.billing_month_6 ? Number(fin.billing_month_6) : null,
      billing_month_12: fin.billing_month_12 ? Number(fin.billing_month_12) : null,
      months_to_match_previous: fin.months_to_match_previous ? Number(fin.months_to_match_previous) : null,
      notes: fin.notes || null,
    } as Partial<RecruitmentFinancialEvolution>)
    setSavingFin(false)
    if (error) return toast.error(error)
    toast.success('Projecção financeira guardada')
    await onSave()
  }

  async function handleSaveBudget() {
    setSavingBg(true)
    const { error } = await upsertBudget(candidateId, {
      paid_campaign_used: bg.paid_campaign_used,
      campaign_platform: bg.paid_campaign_used && bg.campaign_platform ? bg.campaign_platform : null,
      estimated_cost: bg.estimated_cost ? Number(bg.estimated_cost) : null,
      resources_used: bg.resources_used || null,
    } as Partial<RecruitmentBudget>)
    setSavingBg(false)
    if (error) return toast.error(error)
    toast.success('Orçamento guardado')
    await onSave()
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Perfil de Origem ─────────────────────────────── */}
      <div className={glassCard}>
        <SectionTitle icon={Briefcase}>Perfil de Origem</SectionTitle>

        <div className="flex items-center gap-3">
          <Checkbox
            id="active-re"
            checked={op.currently_active_real_estate}
            onCheckedChange={(v) => setOp({ ...op, currently_active_real_estate: !!v })}
          />
          <Label htmlFor="active-re">Activo no imobiliário</Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Marca de origem</Label>
            <Select value={op.origin_brand} onValueChange={(v) => setOp({ ...op, origin_brand: v as OriginBrand })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGIN_BRANDS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {op.origin_brand === 'other' && (
            <div className="space-y-1.5">
              <Label>Outra marca</Label>
              <Input value={op.origin_brand_custom} onChange={(e) => setOp({ ...op, origin_brand_custom: e.target.value })} placeholder="Nome da marca" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Tempo na marca (meses)</Label>
            <Input type="number" min={0} value={op.time_at_origin_months} onChange={(e) => setOp({ ...op, time_at_origin_months: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Facturação média/mês (EUR)</Label>
            <Input type="number" min={0} step={0.01} value={op.billing_avg_month} onChange={(e) => setOp({ ...op, billing_avg_month: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Facturação média/ano (EUR)</Label>
            <Input type="number" min={0} step={0.01} value={op.billing_avg_year} onChange={(e) => setOp({ ...op, billing_avg_year: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Motivo de saída</Label>
          <Textarea value={op.reason_for_leaving} onChange={(e) => setOp({ ...op, reason_for_leaving: e.target.value })} rows={3} placeholder="Porquê pretende sair da marca actual..." />
        </div>

        <SaveButton saving={savingOp} onClick={handleSaveOrigin} />
      </div>

      {/* ── Section 2: Pain & Pitch ─────────────────────────────────── */}
      <div className={glassCard}>
        <SectionTitle icon={Star}>Pain & Pitch</SectionTitle>

        <div className="space-y-1.5">
          <Label>Dores identificadas</Label>
          <Textarea value={pp.identified_pains} onChange={(e) => setPp({ ...pp, identified_pains: e.target.value })} rows={3} placeholder="Principais dores do candidato..." />
        </div>
        <div className="space-y-1.5">
          <Label>Soluções apresentadas</Label>
          <Textarea value={pp.solutions_presented} onChange={(e) => setPp({ ...pp, solutions_presented: e.target.value })} rows={3} placeholder="Soluções que a equipa oferece..." />
        </div>
        <div className="space-y-1.5">
          <Label>Objecções do candidato</Label>
          <Textarea value={pp.candidate_objections} onChange={(e) => setPp({ ...pp, candidate_objections: e.target.value })} rows={3} placeholder="Objecções levantadas..." />
        </div>
        <div className="space-y-1.5">
          <Label>Fit Score</Label>
          <StarRating value={pp.fit_score} onChange={(v) => setPp({ ...pp, fit_score: v })} />
        </div>

        <SaveButton saving={savingPp} onClick={handleSavePainPitch} />
      </div>

      {/* ── Section 3: Projecção Financeira & Budget ─────────────────── */}
      <div className={glassCard}>
        <SectionTitle icon={TrendingUp}>Projecção Financeira & Orçamento</SectionTitle>

        <p className="text-sm font-medium text-muted-foreground">Projecção de Facturação</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {([
            ['billing_month_1', 'Mês 1'],
            ['billing_month_2', 'Mês 2'],
            ['billing_month_3', 'Mês 3'],
            ['billing_month_6', 'Mês 6'],
            ['billing_month_12', 'Mês 12'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label} (EUR)</Label>
              <Input
                type="number" min={0} step={0.01}
                value={fin[key]}
                onChange={(e) => setFin({ ...fin, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Meses até igualar anterior</Label>
            <Input type="number" min={0} value={fin.months_to_match_previous} onChange={(e) => setFin({ ...fin, months_to_match_previous: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={fin.notes} onChange={(e) => setFin({ ...fin, notes: e.target.value })} rows={2} placeholder="Notas sobre projecção..." />
        </div>

        <SaveButton saving={savingFin} onClick={handleSaveFinancial} />

        <Separator className="my-2" />

        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Euro className="h-4 w-4" /> Orçamento de Captação
        </p>

        <div className="flex items-center gap-3">
          <Checkbox
            id="campaign-used"
            checked={bg.paid_campaign_used}
            onCheckedChange={(v) => setBg({ ...bg, paid_campaign_used: !!v })}
          />
          <Label htmlFor="campaign-used">Campanha paga utilizada</Label>
        </div>

        {bg.paid_campaign_used && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={bg.campaign_platform} onValueChange={(v) => setBg({ ...bg, campaign_platform: v as CampaignPlatform })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPAIGN_PLATFORMS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Custo estimado (EUR)</Label>
            <Input type="number" min={0} step={0.01} value={bg.estimated_cost} onChange={(e) => setBg({ ...bg, estimated_cost: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Recursos utilizados</Label>
          <Textarea value={bg.resources_used} onChange={(e) => setBg({ ...bg, resources_used: e.target.value })} rows={2} placeholder="Tempo, materiais, anúncios..." />
        </div>

        <SaveButton saving={savingBg} onClick={handleSaveBudget} />
      </div>
    </div>
  )
}
