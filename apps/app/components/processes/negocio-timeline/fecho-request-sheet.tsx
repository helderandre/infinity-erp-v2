'use client'

import { useEffect, useState } from 'react'
import {
  Banknote,
  Handshake,
  Home,
  Users,
  ClipboardList,
  Sparkles,
  GitBranch,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
import { DetailRow } from '@/components/shared/detail-row'
import { PersonCard } from '@/components/processes/angariacao-timeline/angariacao-request-sheet'
import { DealToggleGroup } from '@/components/deals/deal-toggle-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FieldRow, TextInput, NumInput, DateInput, SelectInput, BoolInput,
  TextAreaField as TextArea,
} from '@/components/processes/editable-fields'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { formatCurrency, formatDate } from '@/lib/constants'
import { DEAL_SCENARIOS, BUSINESS_TYPES, HOUSING_REGIMES } from '@/types/deal'

/* eslint-disable @typescript-eslint/no-explicit-any */

const yesNo = (v: unknown): string | undefined =>
  v === true ? 'Sim' : v === false ? 'Não' : undefined

const eur = (v: number | null | undefined): string | undefined =>
  v == null || Number(v) === 0 ? undefined : formatCurrency(Number(v))

const pct = (v: number | null | undefined): string | undefined =>
  v == null || Number(v) === 0 ? undefined : `${Number(v)}%`

// Labels das condições dependem do tipo de negócio (espelha o step-3 do form).
function conditionLabels(bt: string | null | undefined) {
  switch (bt) {
    case 'arrendamento':
      return {
        value: 'Valor da renda mensal',
        deposit: 'Caução / Rendas adiantadas',
        date: 'Data prevista do Contrato de Arrendamento',
        deadline: 'Duração do arrendamento',
      }
    case 'trespasse':
      return {
        value: 'Valor do trespasse',
        deposit: 'Sinal / Pagamento inicial',
        date: 'Data prevista do Contrato de Trespasse',
        deadline: 'Prazo para contrato definitivo',
      }
    default:
      return {
        value: 'Preço de venda',
        deposit: 'Valor do sinal no CPCV',
        date: 'Data prevista do CPCV',
        deadline: 'Prazo máximo para a Escritura',
      }
  }
}

function mobiliaLabel(bt: string | null | undefined) {
  if (bt === 'trespasse') return 'Trespassado com mobília/equipamentos?'
  if (bt === 'arrendamento') return 'Arrendado com mobília?'
  return 'Vendido com mobília?'
}

interface EditClient {
  id?: string
  person_type: string
  name: string
  nif: string
  email: string
  phone: string
  is_main_contact: boolean
  nationality: string
  marital_status: string
}

/**
 * Sheet com TODA a informação submetida no "pedido de fecho" (o formulário de
 * fecho de negócio): partilha, clientes, condições, extra e referenciação.
 * Recebe o `deal` já carregado (de `/api/processes/[id]`, que embute
 * `deal_clients`). **A gestão pode editar** os campos e adicionar/remover
 * clientes (botão "Editar"); guarda via PUT /api/deals/[id].
 */
export function FechoRequestSheet({
  deal,
  open,
  onClose,
  onSaved,
}: {
  deal: any | null
  open: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const { user } = useUser()
  const canEdit = isManagementRole(user?.role_names ?? [])

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [clients, setClients] = useState<EditClient[]>([])
  // Listas para os selectores estruturais (colega / imóvel) — só em edição.
  const [consultants, setConsultants] = useState<{ value: string; label: string }[]>([])
  const [properties, setProperties] = useState<{ value: string; label: string }[]>([])
  const [colleagueProperties, setColleagueProperties] = useState<{ value: string; label: string }[]>([])

  // Reset ao fechar / mudar de deal.
  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])
  useEffect(() => {
    setEditing(false)
  }, [deal?.id])

  // Consultores + imóveis (para os selectores de cenário).
  useEffect(() => {
    if (!editing) return
    fetch('/api/consultants?per_page=100&status=active')
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data
        if (Array.isArray(list)) setConsultants(list.map((c: any) => ({ value: c.id, label: c.commercial_name })))
      })
      .catch(() => {})
    fetch('/api/properties?per_page=100&status=active')
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data
        if (Array.isArray(list)) setProperties(list.map((p: any) => ({ value: p.id, label: p.external_ref ? `${p.external_ref} - ${p.title}` : p.title })))
      })
      .catch(() => {})
  }, [editing])

  // Imóveis do colega seleccionado (pleno de agência).
  useEffect(() => {
    const cid = form.internal_colleague_id
    if (!editing || form.scenario !== 'pleno_agencia' || !cid) {
      setColleagueProperties([])
      return
    }
    let cancelled = false
    fetch(`/api/properties?consultant_id=${cid}&status=active&per_page=100`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res) ? res : res.data
        if (Array.isArray(list)) setColleagueProperties(list.map((p: any) => ({ value: p.id, label: p.external_ref ? `${p.external_ref} - ${p.title}` : p.title })))
      })
      .catch(() => { if (!cancelled) setColleagueProperties([]) })
    return () => { cancelled = true }
  }, [editing, form.scenario, form.internal_colleague_id])

  const scenario = deal?.deal_type
    ? DEAL_SCENARIOS[deal.deal_type as keyof typeof DEAL_SCENARIOS]
    : undefined
  const businessLabel = deal?.business_type
    ? BUSINESS_TYPES[deal.business_type as keyof typeof BUSINESS_TYPES] ?? deal.business_type
    : null
  const displayClients: any[] = Array.isArray(deal?.deal_clients)
    ? deal.deal_clients
    : Array.isArray(deal?.clients)
      ? deal.clients
      : []
  const editBt = editing ? form.business_type : deal?.business_type
  const labels = conditionLabels(editBt)
  const reference =
    deal?.reference || deal?.pv_number || (deal?.id ? `Negócio ${String(deal.id).slice(0, 8)}` : '')

  // Campos por cenário — só mostramos os que pertencem ao cenário. Em edição o
  // cenário é editável (form.scenario); fora de edição usa o valor guardado.
  const dealType: string | undefined = editing ? form.scenario : deal?.deal_type
  const isPleno = dealType === 'pleno'
  const isPlenoAgencia = dealType === 'pleno_agencia'
  const isCompradorExterno = dealType === 'comprador_externo'
  const isExternalShare = dealType === 'comprador_externo' || dealType === 'angariacao_externa'
  const isAngExterna = dealType === 'angariacao_externa'

  const startEdit = () => {
    if (!deal) return
    setForm({
      scenario: deal.deal_type ?? 'pleno',
      property_id: deal.property_id ?? '',
      internal_colleague_id: deal.internal_colleague_id ?? '',
      share_network_type: deal.share_network_type ?? '',
      external_property_link: deal.external_property_link ?? '',
      external_property_type: deal.external_property_type ?? '',
      external_property_typology: deal.external_property_typology ?? '',
      external_property_zone: deal.external_property_zone ?? '',
      external_property_id: deal.external_property_id ?? '',
      external_property_construction_year: deal.external_property_construction_year ?? '',
      share_pct: deal.share_pct ?? '',
      partner_agency_name: deal.partner_agency_name ?? '',
      partner_agency_nif: deal.partner_agency_nif ?? '',
      partner_contact: deal.partner_contact ?? '',
      external_consultant_name: deal.external_consultant_name ?? '',
      external_consultant_phone: deal.external_consultant_phone ?? '',
      external_consultant_email: deal.external_consultant_email ?? '',
      business_type: deal.business_type ?? 'venda',
      deal_value: deal.deal_value ?? '',
      commission_type: deal.commission_type ?? 'percentage',
      commission_pct: deal.commission_pct ?? '',
      cpcv_pct: deal.cpcv_pct ?? '',
      escritura_pct: deal.escritura_pct ?? '',
      deposit_value: deal.deposit_value ?? '',
      contract_signing_date: deal.contract_signing_date ? String(deal.contract_signing_date).slice(0, 10) : '',
      max_deadline: deal.max_deadline ?? '',
      conditions_notes: deal.conditions_notes ?? '',
      has_guarantor: deal.has_guarantor ?? false,
      has_furniture: deal.has_furniture ?? false,
      is_bilingual: deal.is_bilingual ?? false,
      has_financing: deal.has_financing ?? false,
      has_financing_condition: deal.has_financing_condition ?? false,
      has_signature_recognition: deal.has_signature_recognition ?? false,
      housing_regime: deal.housing_regime ?? '',
      extra_info: deal.extra_info ?? '',
      has_referral: deal.has_referral ?? false,
      referral_pct: deal.referral_pct ?? '',
      referral_type: deal.referral_type ?? '',
      referral_info: deal.referral_info ?? '',
    })
    setClients(
      displayClients
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((c) => ({
          id: c.id,
          person_type: c.person_type ?? 'singular',
          name: c.name ?? '',
          nif: c.nif ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          is_main_contact: Boolean(c.is_main_contact),
          nationality: c.kyc?.nationality ?? '',
          marital_status: c.kyc?.marital_status ?? '',
        })),
    )
    setEditing(true)
  }

  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const setClient = (i: number, k: keyof EditClient, v: any) =>
    setClients((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)))
  const addClient = () =>
    setClients((p) => [
      ...p,
      {
        person_type: 'singular', name: '', nif: '', email: '', phone: '',
        is_main_contact: p.length === 0, nationality: '', marital_status: '',
      },
    ])
  const removeClient = (i: number) => setClients((p) => p.filter((_, idx) => idx !== i))

  const num = (v: any) => (v === '' || v == null ? null : Number(v))

  const handleSave = async () => {
    if (!deal?.id) return
    setSaving(true)
    try {
      // O cenário escolhido decide que campos de partilha persistem. O PUT
      // mapeia `scenario` → deal_type + has_share + share_type.
      const sc = form.scenario as string
      const ext = sc === 'comprador_externo' || sc === 'angariacao_externa'
      const payload: Record<string, any> = {
        scenario: sc,
        // Associação estrutural por cenário.
        property_id: sc === 'angariacao_externa' ? null : (form.property_id || null),
        internal_colleague_id: sc === 'pleno_agencia' ? (form.internal_colleague_id || null) : null,
        share_network_type: ext ? (form.share_network_type || null) : null,
        external_property_link: sc === 'angariacao_externa' ? (form.external_property_link || null) : null,
        external_property_type: sc === 'angariacao_externa' ? (form.external_property_type || null) : null,
        external_property_typology: sc === 'angariacao_externa' ? (form.external_property_typology || null) : null,
        external_property_zone: sc === 'angariacao_externa' ? (form.external_property_zone || null) : null,
        external_property_id: sc === 'angariacao_externa' ? (form.external_property_id || null) : null,
        external_property_construction_year: sc === 'angariacao_externa' ? (form.external_property_construction_year || null) : null,
        share_pct: sc === 'pleno' ? null : num(form.share_pct),
        partner_agency_name: ext ? (form.partner_agency_name || null) : null,
        partner_agency_nif: ext ? (form.partner_agency_nif || null) : null,
        partner_contact: ext ? (form.partner_contact || null) : null,
        external_consultant_name: ext ? (form.external_consultant_name || null) : null,
        external_consultant_phone: ext ? (form.external_consultant_phone || null) : null,
        external_consultant_email: ext ? (form.external_consultant_email || null) : null,
        business_type: form.business_type || null,
        deal_value: num(form.deal_value),
        commission_type: form.commission_type || null,
        commission_pct: num(form.commission_pct),
        cpcv_pct: num(form.cpcv_pct),
        escritura_pct: num(form.escritura_pct),
        deposit_value: form.deposit_value || null,
        contract_signing_date: form.contract_signing_date || null,
        max_deadline: form.max_deadline || null,
        conditions_notes: form.conditions_notes || null,
        has_guarantor: !!form.has_guarantor,
        has_furniture: !!form.has_furniture,
        is_bilingual: !!form.is_bilingual,
        has_financing: !!form.has_financing,
        has_financing_condition: !!form.has_financing_condition,
        has_signature_recognition: !!form.has_signature_recognition,
        housing_regime: form.housing_regime || null,
        extra_info: form.extra_info || null,
        has_referral: !!form.has_referral,
        referral_pct: num(form.referral_pct),
        referral_type: form.referral_type || null,
        referral_info: form.referral_info || null,
        clients: clients.map((c) => ({
          person_type: c.person_type,
          name: c.name,
          nif: c.nif || null,
          email: c.email || null,
          phone: c.phone || null,
          is_main_contact: c.is_main_contact,
          nationality: c.nationality || undefined,
          marital_status: c.marital_status || undefined,
        })),
      }
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao guardar o pedido')
      }
      toast.success('Pedido de fecho actualizado')
      setEditing(false)
      onSaved?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="wide"
      title="Pedido de fecho"
      accent={<Banknote className="h-4 w-4 text-emerald-600" />}
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{reference}</span>
          {scenario && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{scenario.label}</span>
            </>
          )}
          {businessLabel && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{businessLabel}</span>
            </>
          )}
        </span>
      }
      footer={
        deal && canEdit ? (
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="rounded-full">
                <X className="mr-1.5 h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Guardar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEdit} className="rounded-full">
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
          )
        ) : null
      }
    >
      {!deal ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem dados do pedido de fecho.
        </p>
      ) : (
        <>
          {/* Cenário — editável (decide os campos de partilha mostrados) */}
          {editing && (
            <Section title="Cenário" icon={Handshake}>
              <DealToggleGroup
                value={form.scenario}
                onChange={(v) => setF('scenario', v)}
                options={Object.entries(DEAL_SCENARIOS).map(([value, { label }]) => ({ value, label }))}
              />
              {form.scenario && DEAL_SCENARIOS[form.scenario as keyof typeof DEAL_SCENARIOS] && (
                <p className="pt-1 text-xs text-muted-foreground">
                  {DEAL_SCENARIOS[form.scenario as keyof typeof DEAL_SCENARIOS].description}
                </p>
              )}
            </Section>
          )}

          {/* Imóvel & Angariação — campos do cenário (editáveis em gestão) */}
          <Section title="Imóvel & Angariação" icon={Home}>
            {/* Angariação externa → link + campos do imóvel externo */}
            {isAngExterna && (
              <>
                <FieldRow label="Link do imóvel" editing={editing} display={deal.external_property_link}>
                  <TextInput value={form.external_property_link} onChange={(v) => setF('external_property_link', v)} />
                </FieldRow>
                <FieldRow label="Tipo de imóvel" editing={editing} display={deal.external_property_type}>
                  <TextInput value={form.external_property_type} onChange={(v) => setF('external_property_type', v)} />
                </FieldRow>
                <FieldRow label="Tipologia" editing={editing} display={deal.external_property_typology}>
                  <TextInput value={form.external_property_typology} onChange={(v) => setF('external_property_typology', v)} />
                </FieldRow>
                <FieldRow label="Zona" editing={editing} display={deal.external_property_zone}>
                  <TextInput value={form.external_property_zone} onChange={(v) => setF('external_property_zone', v)} />
                </FieldRow>
              </>
            )}

            {/* Pleno de agência → colega + imóvel do colega */}
            {isPlenoAgencia && (
              <>
                <FieldRow label="Colega (angariação)" editing={editing} display={deal.colleague?.commercial_name}>
                  <SelectInput
                    value={form.internal_colleague_id}
                    onChange={(v) => { setF('internal_colleague_id', v); setF('property_id', '') }}
                    options={[{ value: '', label: 'Seleccionar colega...' }, ...consultants]}
                  />
                </FieldRow>
                <FieldRow
                  label="Imóvel do colega"
                  editing={editing}
                  display={deal.property ? `${deal.property.external_ref ? `${deal.property.external_ref} · ` : ''}${deal.property.title ?? ''}` : undefined}
                >
                  <SelectInput
                    value={form.property_id}
                    onChange={(v) => setF('property_id', v)}
                    options={[{ value: '', label: form.internal_colleague_id ? 'Seleccionar imóvel...' : 'Escolhe primeiro o colega' }, ...colleagueProperties]}
                  />
                </FieldRow>
              </>
            )}

            {/* Pleno / comprador externo → o teu imóvel */}
            {(isPleno || isCompradorExterno) && (
              <FieldRow
                label="Imóvel"
                editing={editing}
                display={
                  deal.property
                    ? `${deal.property.external_ref ? `${deal.property.external_ref} · ` : ''}${deal.property.title ?? ''}${deal.property.city ? ` — ${deal.property.city}` : ''}`
                    : undefined
                }
              >
                <SelectInput
                  value={form.property_id}
                  onChange={(v) => setF('property_id', v)}
                  options={[{ value: '', label: 'Seleccionar imóvel...' }, ...properties]}
                />
              </FieldRow>
            )}

            <DetailRow label="Consultor responsável" value={deal.consultant?.commercial_name} />
          </Section>

          {/* Partilha — só nos cenários com partilha (não no pleno) */}
          {!isPleno && (
            <Section title="Partilha" icon={Handshake}>
              {!editing && <DetailRow label="Cenário" value={scenario?.label ?? deal.deal_type} />}
              <FieldRow label="% partilha" editing={editing} display={pct(deal.share_pct)}>
                <NumInput value={form.share_pct} onChange={(v) => setF('share_pct', v)} suffix="%" />
              </FieldRow>
              {isExternalShare && (
                <>
                  <FieldRow
                    label="Tipo de rede"
                    editing={editing}
                    display={deal.share_network_type === 'same_network' ? 'Mesma Rede (Remax)' : deal.share_network_type === 'external_network' ? 'Rede Externa' : undefined}
                  >
                    <SelectInput
                      value={form.share_network_type}
                      onChange={(v) => setF('share_network_type', v)}
                      options={[{ value: '', label: '—' }, { value: 'same_network', label: 'Mesma Rede (Remax)' }, { value: 'external_network', label: 'Rede Externa' }]}
                    />
                  </FieldRow>
                  <FieldRow label="Agência parceira" editing={editing} display={deal.partner_agency_name}>
                    <TextInput value={form.partner_agency_name} onChange={(v) => setF('partner_agency_name', v)} />
                  </FieldRow>
                  <FieldRow label="NIF agência parceira" editing={editing} display={deal.partner_agency_nif}>
                    <TextInput value={form.partner_agency_nif} onChange={(v) => setF('partner_agency_nif', v)} />
                  </FieldRow>
                  <FieldRow label="Contacto parceiro" editing={editing} display={deal.partner_contact}>
                    <TextInput value={form.partner_contact} onChange={(v) => setF('partner_contact', v)} />
                  </FieldRow>
                  <FieldRow label="Consultor externo" editing={editing} display={deal.external_consultant_name}>
                    <TextInput value={form.external_consultant_name} onChange={(v) => setF('external_consultant_name', v)} />
                  </FieldRow>
                  <FieldRow label="Telefone consultor externo" editing={editing} display={deal.external_consultant_phone}>
                    <TextInput value={form.external_consultant_phone} onChange={(v) => setF('external_consultant_phone', v)} />
                  </FieldRow>
                  <FieldRow label="Email consultor externo" editing={editing} display={deal.external_consultant_email}>
                    <TextInput value={form.external_consultant_email} onChange={(v) => setF('external_consultant_email', v)} />
                  </FieldRow>
                </>
              )}
            </Section>
          )}

          {/* Clientes */}
          {(displayClients.length > 0 || editing) && (
            <Section title={`Clientes (${editing ? clients.length : displayClients.length})`} icon={Users}>
              {editing ? (
                <div className="space-y-3">
                  {clients.map((c, i) => (
                    <EditPersonCard
                      key={c.id ?? `new-${i}`}
                      client={c}
                      onChange={(k, v) => setClient(i, k, v)}
                      onRemove={() => removeClient(i)}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addClient} className="rounded-full">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar cliente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayClients
                    .slice()
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                    .map((c, i) => (
                      <PersonCard
                        key={c.id ?? i}
                        name={c.name}
                        personType={c.person_type}
                        isMain={c.is_main_contact}
                        rows={[
                          ['NIF', c.nif],
                          ['Email', c.email],
                          ['Telefone', c.phone],
                          ['Nacionalidade', c.kyc?.nationality],
                          ['Estado civil', c.kyc?.marital_status],
                        ]}
                      />
                    ))}
                </div>
              )}
            </Section>
          )}

          {/* Condições */}
          <Section title="Condições" icon={ClipboardList}>
            <FieldRow label="Tipo de negócio" editing={editing} display={businessLabel ?? undefined}>
              <SelectInput
                value={form.business_type}
                onChange={(v) => setF('business_type', v)}
                options={Object.entries(BUSINESS_TYPES).map(([value, label]) => ({ value, label }))}
              />
            </FieldRow>
            <FieldRow label={labels.value} editing={editing} display={eur(deal.deal_value)}>
              <NumInput value={form.deal_value} onChange={(v) => setF('deal_value', v)} suffix="€" />
            </FieldRow>
            <FieldRow
              label="Comissão"
              editing={editing}
              display={
                deal.commission_pct != null
                  ? deal.commission_type === 'fixed'
                    ? formatCurrency(Number(deal.commission_pct))
                    : `${Number(deal.commission_pct)}%`
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <SelectInput
                  value={form.commission_type}
                  onChange={(v) => setF('commission_type', v)}
                  options={[{ value: 'percentage', label: '%' }, { value: 'fixed', label: '€ Fixo' }]}
                  className="w-24"
                />
                <NumInput value={form.commission_pct} onChange={(v) => setF('commission_pct', v)} suffix={form.commission_type === 'fixed' ? '€' : '%'} />
              </div>
            </FieldRow>
            {editBt === 'venda' && (
              <FieldRow
                label="Tranche no CPCV"
                editing={editing}
                display={
                  deal.cpcv_pct != null || deal.escritura_pct != null
                    ? `${Number(deal.cpcv_pct ?? 0)}% · ${Number(deal.escritura_pct ?? 0)}%`
                    : undefined
                }
              >
                <NumInput
                  value={form.cpcv_pct}
                  onChange={(v) => {
                    const c = v === '' ? '' : Math.max(0, Math.min(100, Number(v)))
                    setF('cpcv_pct', c)
                    setF('escritura_pct', c === '' ? '' : 100 - Number(c))
                  }}
                  suffix="%"
                />
              </FieldRow>
            )}
            <FieldRow label={labels.deposit} editing={editing} display={deal.deposit_value}>
              <TextInput value={form.deposit_value} onChange={(v) => setF('deposit_value', v)} />
            </FieldRow>
            <FieldRow
              label={labels.date}
              editing={editing}
              display={deal.contract_signing_date ? formatDate(deal.contract_signing_date) : undefined}
            >
              <DateInput value={form.contract_signing_date} onChange={(v) => setF('contract_signing_date', v)} />
            </FieldRow>
            <FieldRow label={labels.deadline} editing={editing} display={deal.max_deadline}>
              <TextInput value={form.max_deadline} onChange={(v) => setF('max_deadline', v)} />
            </FieldRow>
            {editing ? (
              <TextArea label="Observações" value={form.conditions_notes} onChange={(v) => setF('conditions_notes', v)} />
            ) : (
              deal.conditions_notes && (
                <p className="pt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {deal.conditions_notes}
                </p>
              )
            )}
          </Section>

          {/* Extra */}
          <Section title="Extra" icon={Sparkles}>
            <FieldRow label="Tem fiador?" editing={editing} display={yesNo(deal.has_guarantor)}>
              <BoolInput value={form.has_guarantor} onChange={(v) => setF('has_guarantor', v)} />
            </FieldRow>
            <FieldRow label={mobiliaLabel(editBt)} editing={editing} display={yesNo(deal.has_furniture)}>
              <BoolInput value={form.has_furniture} onChange={(v) => setF('has_furniture', v)} />
            </FieldRow>
            <FieldRow label="Contrato bilingue (PT/ENG)?" editing={editing} display={yesNo(deal.is_bilingual)}>
              <BoolInput value={form.is_bilingual} onChange={(v) => setF('is_bilingual', v)} />
            </FieldRow>
            <FieldRow label="Há financiamento?" editing={editing} display={yesNo(deal.has_financing)}>
              <BoolInput value={form.has_financing} onChange={(v) => setF('has_financing', v)} />
            </FieldRow>
            <FieldRow label="Condição resolutiva?" editing={editing} display={yesNo(deal.has_financing_condition)}>
              <BoolInput value={form.has_financing_condition} onChange={(v) => setF('has_financing_condition', v)} />
            </FieldRow>
            <FieldRow label="Reconhecimento de assinaturas?" editing={editing} display={yesNo(deal.has_signature_recognition)}>
              <BoolInput value={form.has_signature_recognition} onChange={(v) => setF('has_signature_recognition', v)} />
            </FieldRow>
            <FieldRow
              label="Regime"
              editing={editing}
              display={
                deal.housing_regime
                  ? HOUSING_REGIMES[deal.housing_regime as keyof typeof HOUSING_REGIMES] ?? deal.housing_regime
                  : undefined
              }
            >
              <SelectInput
                value={form.housing_regime}
                onChange={(v) => setF('housing_regime', v)}
                options={[{ value: '', label: '—' }, ...Object.entries(HOUSING_REGIMES).map(([value, label]) => ({ value, label }))]}
              />
            </FieldRow>
            {editing ? (
              <TextArea label="Informação extra" value={form.extra_info} onChange={(v) => setF('extra_info', v)} />
            ) : (
              deal.extra_info && (
                <p className="pt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {deal.extra_info}
                </p>
              )
            )}
          </Section>

          {/* Referenciação */}
          {(deal.has_referral || deal.referral_info || editing) && (
            <Section title="Referenciação" icon={GitBranch}>
              <FieldRow label="Existe referência?" editing={editing} display={yesNo(deal.has_referral)}>
                <BoolInput value={form.has_referral} onChange={(v) => setF('has_referral', v)} />
              </FieldRow>
              <FieldRow label="Percentagem" editing={editing} display={pct(deal.referral_pct)}>
                <NumInput value={form.referral_pct} onChange={(v) => setF('referral_pct', v)} suffix="%" />
              </FieldRow>
              <FieldRow
                label="Tipo"
                editing={editing}
                display={
                  deal.referral_type === 'interna' ? 'Interna' : deal.referral_type === 'externa' ? 'Externa' : undefined
                }
              >
                <SelectInput
                  value={form.referral_type}
                  onChange={(v) => setF('referral_type', v)}
                  options={[{ value: '', label: '—' }, { value: 'interna', label: 'Interna' }, { value: 'externa', label: 'Externa' }]}
                />
              </FieldRow>
              {editing ? (
                <TextArea label="Notas de referenciação" value={form.referral_info} onChange={(v) => setF('referral_info', v)} />
              ) : (
                deal.referral_info && (
                  <p className="pt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {deal.referral_info}
                  </p>
                )
              )}
            </Section>
          )}
        </>
      )}
    </FinanceiroSheet>
  )
}

// ─── Cliente editável ────────────────────────────────────────────────────────

function EditPersonCard({
  client, onChange, onRemove,
}: {
  client: EditClient
  onChange: (k: keyof EditClient, v: any) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl ring-1 ring-border/30 bg-background/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <SelectInput
          value={client.person_type}
          onChange={(v) => onChange('person_type', v)}
          options={[{ value: 'singular', label: 'Singular' }, { value: 'coletiva', label: 'Coletiva' }]}
          className="w-28"
        />
        <Input
          value={client.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Nome"
          className="h-8 flex-1 rounded-lg text-sm font-medium"
        />
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={client.is_main_contact} onChange={(e) => onChange('is_main_contact', e.target.checked)} />
          Principal
        </label>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={client.nif} onChange={(e) => onChange('nif', e.target.value)} placeholder="NIF" className="h-8 rounded-lg text-sm" />
        <Input value={client.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="Telefone" className="h-8 rounded-lg text-sm" />
        <Input value={client.email} onChange={(e) => onChange('email', e.target.value)} placeholder="Email" className="h-8 rounded-lg text-sm col-span-2" />
        <Input value={client.nationality} onChange={(e) => onChange('nationality', e.target.value)} placeholder="Nacionalidade" className="h-8 rounded-lg text-sm" />
        <Input value={client.marital_status} onChange={(e) => onChange('marital_status', e.target.value)} placeholder="Estado civil" className="h-8 rounded-lg text-sm" />
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}
