'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  Megaphone, Plus, Search, MoreHorizontal, Pencil, Trash2,
  ExternalLink, Calendar, Euro, Loader2, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { LeadsCampaign } from '@/types/leads-crm'

const PLATFORMS = [
  { value: 'meta', label: 'Meta Ads', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  { value: 'google', label: 'Google Ads', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
  { value: 'website', label: 'Website', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  { value: 'landing_page', label: 'Landing Page', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  { value: 'other', label: 'Outro', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
]

const STATUSES = [
  { value: 'active', label: 'Activa', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  { value: 'paused', label: 'Pausada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  { value: 'ended', label: 'Terminada', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
]

const SECTORS = [
  { value: 'real_estate_buy', label: 'Imobiliário — Compra' },
  { value: 'real_estate_sell', label: 'Imobiliário — Venda' },
  { value: 'real_estate_rent', label: 'Imobiliário — Arrendamento' },
  { value: 'recruitment', label: 'Recrutamento' },
  { value: 'credit', label: 'Crédito' },
  { value: 'other', label: 'Outro' },
]

export default function CampanhasPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-2xl" /></div>}>
      <CampanhasContent />
    </Suspense>
  )
}

function CampanhasContent() {
  const [campaigns, setCampaigns] = useState<LeadsCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<LeadsCampaign | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (platformFilter) params.set('platform', platformFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/crm/campaigns?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCampaigns(Array.isArray(data) ? data : data.campaigns ?? [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [search, platformFilter, statusFilter])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza de que pretende eliminar esta campanha?')) return
    const res = await fetch(`/api/crm/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Campanha eliminada')
      fetchCampaigns()
    } else {
      toast.error('Erro ao eliminar campanha')
    }
  }

  const openEdit = (campaign: LeadsCampaign) => {
    setEditingCampaign(campaign)
    setDialogOpen(true)
  }

  const openNew = () => {
    setEditingCampaign(null)
    setDialogOpen(true)
  }

  const platform = (p: string) => PLATFORMS.find(pl => pl.value === p)
  const status = (s: string) => STATUSES.find(st => st.value === s)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Campanhas</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">
            Registe campanhas de Meta Ads, Google e outras fontes para rastrear leads e conversões.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openNew}
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Campanha
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar campanhas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <Select value={platformFilter} onValueChange={v => setPlatformFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 rounded-full text-xs">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9 rounded-full text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhuma campanha</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Crie uma campanha para começar a rastrear a origem das suas leads.
          </p>
          <Button size="sm" className="mt-4 rounded-full" onClick={openNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Criar campanha
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c, idx) => (
            <div
              key={c.id}
              className="group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="outline" className={cn("text-[9px] rounded-full px-2", platform(c.platform)?.color)}>
                      {platform(c.platform)?.label}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[9px] rounded-full px-2", status(c.status)?.color)}>
                      {status(c.status)?.label}
                    </Badge>
                    {c.sector && (
                      <Badge variant="outline" className="text-[9px] rounded-full px-2">
                        {SECTORS.find(s => s.value === c.sector)?.label ?? c.sector}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <button className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {c.description && (
                <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{c.description}</p>
              )}

              <div className="mt-3 pt-3 border-t flex items-center gap-3 text-[11px] text-muted-foreground">
                {c.external_campaign_id && (
                  <span className="inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {c.external_campaign_id}
                  </span>
                )}
                {c.budget && (
                  <span className="inline-flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    {c.budget.toLocaleString('pt-PT')}
                  </span>
                )}
                {c.start_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(c.start_date).toLocaleDateString('pt-PT')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editingCampaign}
        onSaved={fetchCampaigns}
      />
    </div>
  )
}

// ============================================================================
// Campaign Dialog
// ============================================================================

function CampaignDialog({
  open, onOpenChange, campaign, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: LeadsCampaign | null
  onSaved: () => void
}) {
  const isEdit = !!campaign
  const [form, setForm] = useState({
    name: '', platform: 'meta', status: 'active', sector: '',
    external_campaign_id: '', external_adset_id: '', external_ad_id: '',
    budget: '', start_date: '', end_date: '', description: '', notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        sector: campaign.sector ?? '',
        external_campaign_id: campaign.external_campaign_id ?? '',
        external_adset_id: campaign.external_adset_id ?? '',
        external_ad_id: campaign.external_ad_id ?? '',
        budget: campaign.budget?.toString() ?? '',
        start_date: campaign.start_date ?? '',
        end_date: campaign.end_date ?? '',
        description: campaign.description ?? '',
        notes: campaign.notes ?? '',
      })
    } else {
      setForm({
        name: '', platform: 'meta', status: 'active', sector: '',
        external_campaign_id: '', external_adset_id: '', external_ad_id: '',
        budget: '', start_date: '', end_date: '', description: '', notes: '',
      })
    }
  }, [campaign, open])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        platform: form.platform,
        status: form.status,
        sector: form.sector || null,
        external_campaign_id: form.external_campaign_id || null,
        external_adset_id: form.external_adset_id || null,
        external_ad_id: form.external_ad_id || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description || null,
        notes: form.notes || null,
      }

      const url = isEdit ? `/api/crm/campaigns/${campaign!.id}` : '/api/crm/campaigns'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Campanha actualizada' : 'Campanha criada')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao guardar campanha')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">
              {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
            </DialogTitle>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={form.name} onChange={e => updateField('name', e.target.value)} className="rounded-xl" placeholder="Ex: Meta — Apartamentos Lisboa T2" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Plataforma</Label>
              <Select value={form.platform} onValueChange={v => updateField('platform', v)}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Estado</Label>
              <Select value={form.status} onValueChange={v => updateField('status', v)}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Sector</Label>
              <Select value={form.sector} onValueChange={v => updateField('sector', v === 'none' ? '' : v)}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">ID Campanha (Meta/Google)</Label>
              <Input value={form.external_campaign_id} onChange={e => updateField('external_campaign_id', e.target.value)} className="rounded-xl text-xs" placeholder="123456789" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Orçamento (EUR)</Label>
              <Input type="number" value={form.budget} onChange={e => updateField('budget', e.target.value)} className="rounded-xl text-xs" placeholder="500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Data início</Label>
              <Input type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} className="rounded-xl text-xs" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Data fim</Label>
              <Input type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)} className="rounded-xl text-xs" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">Descrição</Label>
            <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} className="rounded-xl text-xs" rows={2} placeholder="Objectivo da campanha..." />
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full w-full sm:w-auto" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
