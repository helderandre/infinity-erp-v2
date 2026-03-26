// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, Shield, ShieldCheck, Settings, Euro,
  Save, Loader2, Users, Landmark, Layers, Plug,
} from 'lucide-react'
import { MetaIntegrationsClient } from './integracoes/meta/meta-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RoleDialog } from '@/components/roles/role-dialog'
import { PERMISSION_MODULES } from '@/lib/constants'
import {
  getAgencySettings, updateAgencySetting,
  getCommissionTiers, upsertCommissionTier, deleteCommissionTier,
} from '@/app/dashboard/comissoes/actions'
import type { AgencySetting, CommissionTier } from '@/types/financial'

// ─── Financial constants ─────────────────────────────────────────────────────

interface Role {
  id: string
  name: string
  description: string | null
  permissions: Record<string, boolean> | null
  created_at: string
  updated_at: string | null
}

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DefinicoesPage() {
  const [mainTab, setMainTab] = useState('roles')

  // Roles
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null)

  // Financial
  const [finLoading, setFinLoading] = useState(true)
  const [finTab, setFinTab] = useState('geral')
  const [settings, setSettings] = useState<AgencySetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [tierDialogOpen, setTierDialogOpen] = useState(false)
  const [tierForm, setTierForm] = useState<Partial<CommissionTier>>({ ...emptyTier })
  const [tierSaving, setTierSaving] = useState(false)
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null)

  const vendaTiers = tiers.filter(t => t.business_type === 'venda')
  const arrendamentoTiers = tiers.filter(t => t.business_type === 'arrendamento')

  // Integrations
  const [intLoading, setIntLoading] = useState(false)
  const [intConfig, setIntConfig] = useState<any>(null)
  const [intAudiences, setIntAudiences] = useState<any[]>([])

  const loadIntegrations = useCallback(async () => {
    if (intConfig) return
    setIntLoading(true)
    try {
      const [configRes, audRes] = await Promise.all([
        fetch('/api/settings/integrations/meta'),
        fetch('/api/meta-ads/audiences'),
      ])
      if (configRes.ok) setIntConfig(await configRes.json())
      if (audRes.ok) { const d = await audRes.json(); setIntAudiences(d.audiences || []) }
    } catch {}
    finally { setIntLoading(false) }
  }, [intConfig])

  // ── Roles fetch ──
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/libraries/roles')
      const data = await res.json()
      if (res.ok) setRoles(data.filter((r: Role) => r.name.toLowerCase() !== 'admin'))
    } catch { toast.error('Erro ao carregar roles') }
    finally { setRolesLoading(false) }
  }, [])

  // ── Financial fetch ──
  const loadFinancial = useCallback(async () => {
    setFinLoading(true)
    try {
      const [settingsRes, tiersRes] = await Promise.all([getAgencySettings(), getCommissionTiers()])
      if (!settingsRes.error) {
        setSettings(settingsRes.settings)
        const map: Record<string, string> = {}
        for (const s of settingsRes.settings) map[s.key] = s.value
        setValues(map)
      }
      if (!tiersRes.error) setTiers(tiersRes.tiers)
    } catch { toast.error('Erro ao carregar definições financeiras.') }
    finally { setFinLoading(false) }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  // ── Role handlers ──
  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return
    try {
      const res = await fetch(`/api/libraries/roles/${deleteRoleTarget.id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); toast.error(data.error || 'Erro'); return }
      toast.success('Role eliminada')
      fetchRoles()
    } catch { toast.error('Erro ao eliminar role') }
    finally { setDeleteRoleTarget(null) }
  }

  const countPermissions = (permissions: Record<string, boolean> | null) => {
    if (!permissions) return 0
    return Object.values(permissions).filter(Boolean).length
  }

  // ── Financial handlers ──
  const handleSaveSetting = async (key: string) => {
    const value = values[key]
    if (value == null) return
    setSavingKey(key)
    const { error } = await updateAgencySetting(key, value)
    setSavingKey(null)
    if (error) toast.error(error)
    else toast.success('Definição guardada.')
  }

  const handleSaveTier = async () => {
    if (!tierForm.name?.trim()) { toast.error('Nome é obrigatório.'); return }
    setTierSaving(true)
    const { error } = await upsertCommissionTier(tierForm)
    setTierSaving(false)
    if (error) { toast.error(error) } else {
      toast.success(tierForm.id ? 'Escalão actualizado.' : 'Escalão criado.')
      setTierDialogOpen(false); setTierForm({ ...emptyTier }); loadFinancial()
    }
  }

  const handleDeleteTier = async () => {
    if (!deleteTierId) return
    const { error } = await deleteCommissionTier(deleteTierId)
    if (error) toast.error(error)
    else { toast.success('Escalão eliminado.'); loadFinancial() }
    setDeleteTierId(null)
  }

  const handleToggleTier = async (tier: CommissionTier) => {
    const { error } = await upsertCommissionTier({ ...tier, is_active: !tier.is_active })
    if (error) toast.error(error)
    else { toast.success(tier.is_active ? 'Desativado.' : 'Ativado.'); loadFinancial() }
  }

  // ── Setting field renderer ──
  function SettingField({ config }: { config: SettingConfig }) {
    return (
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 transition-all hover:shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{config.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {config.type === 'month' ? (
              <Select value={values[config.key] ?? '1'} onValueChange={v => setValues(prev => ({ ...prev, [config.key]: v }))}>
                <SelectTrigger className="w-[140px] rounded-full h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                <Input
                  type={config.type === 'text' ? 'text' : 'number'}
                  step={config.type === 'percent' ? '0.1' : '1'}
                  value={values[config.key] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                  className={cn('w-[120px] rounded-full h-8 text-xs', config.type === 'percent' && 'pr-7')}
                />
                {config.type === 'percent' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                )}
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              disabled={savingKey === config.key}
              onClick={() => handleSaveSetting(config.key)}
            >
              {savingKey === config.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Settings className="h-4 w-4 text-white/80" />
            </div>
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Sistema
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Definições
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm max-w-lg">
            Roles, permissões e configurações financeiras do sistema.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => {
        setMainTab(v)
        if (v === 'financeiro' && tiers.length === 0 && settings.length === 0) loadFinancial()
        if (v === 'integracoes') loadIntegrations()
      }}>
        <TabsList className="bg-muted/30">
          <TabsTrigger value="roles" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4" />
            Roles e Permissões
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Euro className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Plug className="h-4 w-4" />
            Integrações
          </TabsTrigger>
        </TabsList>

        {/* ═══ Roles Tab ═══ */}
        <TabsContent value="roles" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Gestão de roles e permissões dos utilizadores.</p>
            <Button className="rounded-full" onClick={() => { setEditingRole(null); setDialogOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Role
            </Button>
          </div>

          <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Nome</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Descrição</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Permissões</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhuma role encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => {
                    const permCount = countPermissions(role.permissions)
                    const total = PERMISSION_MODULES.length
                    const allEnabled = permCount === total
                    return (
                      <TableRow key={role.id} className="transition-colors hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {allEnabled ? (
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {role.description || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={allEnabled ? 'default' : permCount > 0 ? 'secondary' : 'outline'}
                            className="rounded-full text-[10px]"
                          >
                            {permCount}/{total}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => { setEditingRole(role); setDialogOpen(true) }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive hover:text-destructive" onClick={() => setDeleteRoleTarget(role)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ Financeiro Tab ═══ */}
        <TabsContent value="financeiro" className="mt-6">
          {finLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-80" />
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <Tabs value={finTab} onValueChange={setFinTab}>
              {/* Sub-tabs as pills */}
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm mb-6">
                {[
                  { value: 'geral', label: 'Configurações Gerais', icon: Settings },
                  { value: 'escaloes', label: 'Escalões de Comissão', icon: Layers },
                  { value: 'rede', label: 'Rede e Pagamentos', icon: Landmark },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setFinTab(tab.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                      finTab === tab.value
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab: Configurações Gerais */}
              <TabsContent value="geral" className="mt-0">
                <div className="space-y-3 max-w-2xl">
                  {SETTING_CONFIGS.map(config => <SettingField key={config.key} config={config} />)}
                </div>
              </TabsContent>

              {/* Sub-tab: Escalões de Comissão */}
              <TabsContent value="escaloes" className="mt-0">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">Escalões de comissão por tipo de negócio.</p>
                  <Button className="rounded-full" onClick={() => { setTierForm({ ...emptyTier }); setTierDialogOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Escalão
                  </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Venda */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      Venda
                      <Badge variant="secondary" className="text-[10px] rounded-full">{vendaTiers.length}</Badge>
                    </h3>
                    {vendaTiers.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                        Nenhum escalão configurado.
                      </div>
                    ) : vendaTiers.map(tier => (
                      <TierCard key={tier.id} tier={tier}
                        onEdit={t => { setTierForm({ ...t }); setTierDialogOpen(true) }}
                        onDelete={setDeleteTierId}
                        onToggle={handleToggleTier}
                      />
                    ))}
                  </div>

                  {/* Arrendamento */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      Arrendamento
                      <Badge variant="secondary" className="text-[10px] rounded-full">{arrendamentoTiers.length}</Badge>
                    </h3>
                    {arrendamentoTiers.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                        Nenhum escalão configurado.
                      </div>
                    ) : arrendamentoTiers.map(tier => (
                      <TierCard key={tier.id} tier={tier}
                        onEdit={t => { setTierForm({ ...t }); setTierDialogOpen(true) }}
                        onDelete={setDeleteTierId}
                        onToggle={handleToggleTier}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Sub-tab: Rede e Pagamentos */}
              <TabsContent value="rede" className="mt-0">
                <div className="space-y-3 max-w-2xl">
                  {NETWORK_CONFIGS.map(config => <SettingField key={config.key} config={config} />)}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ═══ Integrações Tab ═══ */}
        <TabsContent value="integracoes" className="mt-6">
          {intLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-80" />
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : intConfig ? (
            <MetaIntegrationsClient
              webhookUrl={intConfig.webhookUrl}
              appId={intConfig.appId}
              hasAppSecret={intConfig.hasAppSecret}
              hasAccessToken={intConfig.hasAccessToken}
              hasPixelId={intConfig.hasPixelId}
              pixelId={intConfig.pixelId}
              audiences={intAudiences}
              audiencesError={null}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <Plug className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Clique na tab para carregar as integrações</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}

      <RoleDialog open={dialogOpen} onOpenChange={setDialogOpen} role={editingRole} onSaved={() => { setDialogOpen(false); setEditingRole(null); fetchRoles() }} />

      {/* Delete role */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={() => setDeleteRoleTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar role</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar a role &quot;{deleteRoleTarget?.name}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tier dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Layers className="h-4 w-4" />
                </div>
                {tierForm.id ? 'Editar Escalão' : 'Novo Escalão'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input className="rounded-xl" value={tierForm.name ?? ''} onChange={e => setTierForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Standard, Premium" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Tipo de Negócio</Label>
              <Select value={tierForm.business_type ?? 'venda'} onValueChange={v => setTierForm(p => ({ ...p, business_type: v as any }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="arrendamento">Arrendamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Valor Mínimo</Label>
                <Input className="rounded-xl" type="number" value={tierForm.min_value ?? 0} onChange={e => setTierForm(p => ({ ...p, min_value: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Valor Máximo</Label>
                <Input className="rounded-xl" type="number" placeholder="Sem limite" value={tierForm.max_value ?? ''} onChange={e => setTierForm(p => ({ ...p, max_value: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Taxa Agência (%)</Label>
                <Input className="rounded-xl" type="number" step="0.1" value={tierForm.agency_rate ?? ''} onChange={e => setTierForm(p => ({ ...p, agency_rate: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Taxa Consultor (%)</Label>
                <Input className="rounded-xl" type="number" step="0.1" value={tierForm.consultant_rate ?? ''} onChange={e => setTierForm(p => ({ ...p, consultant_rate: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setTierDialogOpen(false)}>Cancelar</Button>
            <Button className="rounded-full px-6" onClick={handleSaveTier} disabled={tierSaving}>
              {tierSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {tierForm.id ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tier */}
      <AlertDialog open={!!deleteTierId} onOpenChange={open => !open && setDeleteTierId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar escalão</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTier} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tier Card ───────────────────────────────────────────────────────────────

function TierCard({ tier, onEdit, onDelete, onToggle }: {
  tier: CommissionTier
  onEdit: (t: CommissionTier) => void
  onDelete: (id: string) => void
  onToggle: (t: CommissionTier) => void
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-card/50 backdrop-blur-sm p-4 transition-all hover:shadow-sm',
      !tier.is_active && 'opacity-50'
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{tier.name}</h3>
            <Badge
              variant={tier.is_active ? 'default' : 'secondary'}
              className="text-[10px] rounded-full"
            >
              {tier.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtCurrency(tier.min_value)} — {tier.max_value ? fmtCurrency(tier.max_value) : 'Sem limite'}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Switch checked={tier.is_active} onCheckedChange={() => onToggle(tier)} />
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onEdit(tier)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive hover:text-destructive" onClick={() => onDelete(tier.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa Agência</p>
          <p className="text-lg font-bold tabular-nums">{tier.agency_rate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa Consultor</p>
          <p className="text-lg font-bold tabular-nums">{tier.consultant_rate}%</p>
        </div>
      </div>
    </div>
  )
}
