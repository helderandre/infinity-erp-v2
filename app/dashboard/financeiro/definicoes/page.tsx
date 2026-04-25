'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, Loader2, Plus, Pencil, Trash2, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import {
  getAgencySettings, updateAgencySetting,
  getCommissionTiers, upsertCommissionTier, deleteCommissionTier,
} from '@/app/dashboard/comissoes/actions'
import type { AgencySetting, CommissionTier } from '@/types/financial'

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

interface SettingConfig {
  key: string; label: string; description: string; type: 'text' | 'percent' | 'number' | 'month'
}

const SETTING_CONFIGS: SettingConfig[] = [
  { key: 'margin_rate', label: 'Taxa de Margem', description: 'Percentagem aplicada à facturação para cálculo de margem.', type: 'percent' },
  { key: 'vat_rate', label: 'Taxa de IVA', description: 'Taxa de IVA aplicada às comissões.', type: 'percent' },
  { key: 'default_commission_sale', label: 'Comissão Venda Defeito', description: 'Percentagem de comissão padrão para vendas.', type: 'percent' },
  { key: 'default_commission_rent', label: 'Comissão Arrendamento Defeito', description: 'Valor de comissão padrão para arrendamentos.', type: 'number' },
  { key: 'fiscal_year_start', label: 'Início Ano Fiscal', description: 'Mês de início do ano fiscal para cálculos.', type: 'month' },
]

const NETWORK_CONFIGS: SettingConfig[] = [
  { key: 'network_name', label: 'Nome da Rede', description: 'Nome da rede imobiliária (ex: RE/MAX).', type: 'text' },
  { key: 'network_pct', label: 'Percentagem da Rede', description: 'Percentagem fixa da rede sobre o report.', type: 'percent' },
  { key: 'default_cpcv_pct', label: '% CPCV Padrão', description: 'Percentagem padrão paga no momento do CPCV.', type: 'percent' },
  { key: 'default_escritura_pct', label: '% Escritura Padrão', description: 'Percentagem padrão paga no momento da Escritura.', type: 'percent' },
  { key: 'default_rent_commission', label: 'Comissão Arrendamento', description: 'Número de rendas de comissão no arrendamento.', type: 'number' },
  { key: 'vat_rate_services', label: 'Taxa IVA Mediação', description: 'Taxa de IVA para serviços de mediação imobiliária.', type: 'percent' },
]

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const emptyTier: Partial<CommissionTier> = {
  name: '', business_type: 'venda', min_value: 0, max_value: undefined,
  agency_rate: 5, consultant_rate: 50, is_active: true, order_index: 0,
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DefinicoesPage() {
  const [loading, setLoading] = useState(true)

  // Settings state
  const [settings, setSettings] = useState<AgencySetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Tiers state
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [tierDialogOpen, setTierDialogOpen] = useState(false)
  const [tierForm, setTierForm] = useState<Partial<CommissionTier>>({ ...emptyTier })
  const [tierSaving, setTierSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const vendaTiers = tiers.filter(t => t.business_type === 'venda')
  const arrendamentoTiers = tiers.filter(t => t.business_type === 'arrendamento')

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, tiersRes] = await Promise.all([
        getAgencySettings(),
        getCommissionTiers(),
      ])
      if (!settingsRes.error) {
        setSettings(settingsRes.settings)
        const map: Record<string, string> = {}
        for (const s of settingsRes.settings) map[s.key] = s.value
        setValues(map)
      }
      if (!tiersRes.error) setTiers(tiersRes.tiers)
    } catch {
      toast.error('Erro ao carregar definições.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Settings handlers ──

  const handleSaveSetting = async (key: string) => {
    const value = values[key]
    if (value == null) return
    setSavingKey(key)
    const { error } = await updateAgencySetting(key, value)
    setSavingKey(null)
    if (error) toast.error(error)
    else toast.success('Definição guardada com sucesso.')
  }

  // ── Tier handlers ──

  const handleSaveTier = async () => {
    if (!tierForm.name?.trim()) { toast.error('Nome é obrigatório.'); return }
    setTierSaving(true)
    const { error } = await upsertCommissionTier(tierForm)
    setTierSaving(false)
    if (error) { toast.error(error) } else {
      toast.success(tierForm.id ? 'Escalão actualizado.' : 'Escalão criado com sucesso.')
      setTierDialogOpen(false)
      setTierForm({ ...emptyTier })
      loadData()
    }
  }

  const handleDeleteTier = async () => {
    if (!deleteId) return
    const { error } = await deleteCommissionTier(deleteId)
    if (error) toast.error(error)
    else { toast.success('Escalão eliminado.'); loadData() }
    setDeleteId(null)
  }

  const handleToggleTier = async (tier: CommissionTier) => {
    const { error } = await upsertCommissionTier({ ...tier, is_active: !tier.is_active })
    if (error) toast.error(error)
    else { toast.success(tier.is_active ? 'Escalão desactivado.' : 'Escalão activado.'); loadData() }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-80" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl px-6 py-8">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Definições Financeiras</h1>
            <p className="text-sm text-white/60 mt-0.5">Configurações de comissões, escalões e rede</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger value="geral" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm">Configurações Gerais</TabsTrigger>
            <TabsTrigger value="escaloes" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm">Escalões de Comissão</TabsTrigger>
            <TabsTrigger value="rede" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm">Rede e Pagamentos</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Configurações Gerais ── */}
        <TabsContent value="geral" className="mt-6">
          <div className="space-y-4 max-w-2xl">
            {SETTING_CONFIGS.map(config => (
              <Card key={config.key} className="rounded-2xl backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{config.label}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    {config.type === 'month' ? (
                      <div className="flex-1">
                        <Select value={values[config.key] ?? '1'} onValueChange={v => setValues(prev => ({ ...prev, [config.key]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          step={config.type === 'percent' ? '0.1' : '1'}
                          value={values[config.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                          className={config.type === 'percent' ? 'pr-8' : ''}
                        />
                        {config.type === 'percent' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        )}
                      </div>
                    )}
                    <Button size="sm" className="gap-2 rounded-full" disabled={savingKey === config.key} onClick={() => handleSaveSetting(config.key)}>
                      {savingKey === config.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab: Escalões de Comissão ── */}
        <TabsContent value="escaloes" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">Configure os escalões de comissão por tipo de negócio.</p>
            <Button className="gap-2 rounded-full" onClick={() => { setTierForm({ ...emptyTier }); setTierDialogOpen(true) }}>
              <Plus className="h-4 w-4" />
              Novo Escalão
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Venda */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Venda</h2>
              {vendaTiers.length === 0 ? (
                <Card className="rounded-2xl backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground">Nenhum escalão de venda configurado.</CardContent></Card>
              ) : vendaTiers.map(tier => (
                <TierCard key={tier.id} tier={tier}
                  onEdit={t => { setTierForm({ ...t }); setTierDialogOpen(true) }}
                  onDelete={setDeleteId}
                  onToggle={handleToggleTier}
                />
              ))}
            </div>

            {/* Arrendamento */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Arrendamento</h2>
              {arrendamentoTiers.length === 0 ? (
                <Card className="rounded-2xl backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground">Nenhum escalão de arrendamento configurado.</CardContent></Card>
              ) : arrendamentoTiers.map(tier => (
                <TierCard key={tier.id} tier={tier}
                  onEdit={t => { setTierForm({ ...t }); setTierDialogOpen(true) }}
                  onDelete={setDeleteId}
                  onToggle={handleToggleTier}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Rede e Pagamentos ── */}
        <TabsContent value="rede" className="mt-6">
          <div className="space-y-4 max-w-2xl">
            {NETWORK_CONFIGS.map(config => (
              <Card key={config.key} className="rounded-2xl backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{config.label}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    {config.type === 'text' ? (
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={values[config.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                          placeholder={config.label}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          step={config.type === 'percent' ? '0.1' : '1'}
                          value={values[config.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                          className={config.type === 'percent' ? 'pr-8' : ''}
                        />
                        {config.type === 'percent' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        )}
                      </div>
                    )}
                    <Button size="sm" className="gap-2 rounded-full" disabled={savingKey === config.key} onClick={() => handleSaveSetting(config.key)}>
                      {savingKey === config.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tier Create/Edit Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogHeader className="relative overflow-hidden bg-neutral-900 px-6 py-5">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                {tierForm.id ? <Pencil className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
              </div>
              <DialogTitle className="text-white">{tierForm.id ? 'Editar Escalão' : 'Novo Escalão'}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={tierForm.name ?? ''} onChange={e => setTierForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Standard, Premium" />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de Negócio</Label>
              <Select value={tierForm.business_type ?? 'venda'} onValueChange={v => setTierForm(p => ({ ...p, business_type: v as 'venda' | 'arrendamento' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="arrendamento">Arrendamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor Mínimo</Label>
                <Input type="number" value={tierForm.min_value ?? 0} onChange={e => setTierForm(p => ({ ...p, min_value: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>Valor Máximo</Label>
                <Input type="number" placeholder="Sem limite" value={tierForm.max_value ?? ''} onChange={e => setTierForm(p => ({ ...p, max_value: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Taxa Agência (%)</Label>
                <Input type="number" step="0.1" value={tierForm.agency_rate ?? ''} onChange={e => setTierForm(p => ({ ...p, agency_rate: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>Taxa Consultor (%)</Label>
                <Input type="number" step="0.1" value={tierForm.consultant_rate ?? ''} onChange={e => setTierForm(p => ({ ...p, consultant_rate: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-5">
            <Button variant="outline" className="rounded-full" onClick={() => setTierDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTier} disabled={tierSaving} className="gap-2 rounded-full">
              {tierSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tierForm.id ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar escalão</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende eliminar este escalão? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTier} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tier Card ──────────────────────────────────────────────────────────────

function TierCard({ tier, onEdit, onDelete, onToggle }: {
  tier: CommissionTier
  onEdit: (t: CommissionTier) => void
  onDelete: (id: string) => void
  onToggle: (t: CommissionTier) => void
}) {
  return (
    <Card className={`rounded-2xl backdrop-blur-sm ${!tier.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{tier.name}</h3>
              <Badge variant={tier.is_active ? 'default' : 'secondary'} className="rounded-full text-[10px] font-medium border-0">
                {tier.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtCurrency(tier.min_value)} — {tier.max_value ? fmtCurrency(tier.max_value) : 'Sem limite'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Switch checked={tier.is_active} onCheckedChange={() => onToggle(tier)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEdit(tier)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onDelete(tier.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Taxa Agência</p>
            <p className="text-lg font-bold">{tier.agency_rate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Taxa Consultor</p>
            <p className="text-lg font-bold">{tier.consultant_rate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
