'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  Target, Plus, MoreHorizontal, Pencil, Trash2, Loader2,
  ArrowRightLeft, Users, Zap, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { LeadsAssignmentRule, LeadsCampaign } from '@/types/leads-crm'

const SOURCES = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Chamada' },
  { value: 'social_media', label: 'Redes Sociais' },
]

const SECTORS = [
  { value: 'real_estate_buy', label: 'Compra' },
  { value: 'real_estate_sell', label: 'Venda' },
  { value: 'real_estate_rent', label: 'Arrendamento' },
  { value: 'recruitment', label: 'Recrutamento' },
  { value: 'credit', label: 'Crédito' },
]

const FALLBACK_ACTIONS = [
  { value: 'gestora_pool', label: 'Devolver ao pool (gestora)' },
  { value: 'round_robin', label: 'Round-robin na equipa' },
  { value: 'skip', label: 'Ignorar regra' },
]

interface Agent { id: string; commercial_name: string }

export default function RegrasPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-2xl" /></div>}>
      <RegrasContent />
    </Suspense>
  )
}

function RegrasContent() {
  const [rules, setRules] = useState<LeadsAssignmentRule[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [campaigns, setCampaigns] = useState<LeadsCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<LeadsAssignmentRule | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [rulesRes, agentsRes, campsRes] = await Promise.all([
        fetch('/api/crm/assignment-rules'),
        fetch('/api/consultants?active=true'),
        fetch('/api/crm/campaigns'),
      ])
      if (rulesRes.ok) {
        const data = await rulesRes.json()
        setRules(Array.isArray(data) ? data : data.rules ?? [])
      }
      if (agentsRes.ok) {
        const data = await agentsRes.json()
        setAgents(Array.isArray(data) ? data : data.consultants ?? [])
      }
      if (campsRes.ok) {
        const data = await campsRes.json()
        setCampaigns(Array.isArray(data) ? data : data.campaigns ?? [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza de que pretende eliminar esta regra?')) return
    const res = await fetch(`/api/crm/assignment-rules/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Regra eliminada'); fetchData() }
    else toast.error('Erro ao eliminar')
  }

  const handleToggle = async (rule: LeadsAssignmentRule) => {
    const res = await fetch(`/api/crm/assignment-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) fetchData()
  }

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Regras de Atribuição</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">
            Configure como as leads são automaticamente atribuídas aos consultores.
            Regras são avaliadas por prioridade (maior primeiro).
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingRule(null); setDialogOpen(true) }}
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Regra
        </Button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Como funciona</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-muted-foreground">
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
            <p>Quando uma lead chega, as regras são avaliadas da <strong>maior prioridade</strong> para a menor.</p>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
            <p>A primeira regra que <strong>corresponder</strong> (origem, campanha, sector) atribui a lead ao consultor.</p>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
            <p>Se o consultor exceder o <strong>limite de carga</strong>, aplica-se a acção de overflow definida.</p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : sortedRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <ArrowRightLeft className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Sem regras de atribuição</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Todas as leads vão para o pool da gestora. Crie uma regra para atribuição automática.
          </p>
          <Button size="sm" className="mt-4 rounded-full" onClick={() => { setEditingRule(null); setDialogOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Criar regra
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRules.map((rule, idx) => {
            const agent = agents.find(a => a.id === rule.consultant_id)
            const campaign = campaigns.find(c => c.id === rule.campaign_id_match)

            return (
              <div
                key={rule.id}
                className={cn(
                  "group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2",
                  !rule.is_active && "opacity-50",
                )}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {rule.priority}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{rule.name}</p>
                      {!rule.is_active && (
                        <Badge variant="outline" className="text-[9px] rounded-full px-2">Inactiva</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</p>
                    )}

                    {/* Criteria badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {rule.source_match?.map(s => (
                        <span key={s} className="inline-flex items-center text-[9px] font-medium bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          {SOURCES.find(src => src.value === s)?.label ?? s}
                        </span>
                      ))}
                      {campaign && (
                        <span className="inline-flex items-center text-[9px] font-medium bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                          Campanha: {campaign.name}
                        </span>
                      )}
                      {rule.sector_match?.map(s => (
                        <span key={s} className="inline-flex items-center text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                          {SECTORS.find(sec => sec.value === s)?.label ?? s}
                        </span>
                      ))}
                      {(!rule.source_match?.length && !campaign && !rule.sector_match?.length) && (
                        <span className="text-[10px] text-muted-foreground italic">Todas as leads (catch-all)</span>
                      )}
                    </div>

                    {/* Target */}
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      {agent ? (
                        <span className="text-[11px] font-medium">{agent.commercial_name}</span>
                      ) : rule.team_consultant_ids?.length ? (
                        <span className="text-[11px] font-medium flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Round-robin ({rule.team_consultant_ids.length} consultores)
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sem destino definido</span>
                      )}
                      {rule.overflow_threshold && (
                        <span className="text-[10px] text-muted-foreground">
                          (max {rule.overflow_threshold} leads)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingRule(rule); setDialogOpen(true) }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        agents={agents}
        campaigns={campaigns}
        onSaved={fetchData}
      />
    </div>
  )
}

// ============================================================================
// Rule Dialog
// ============================================================================

function RuleDialog({
  open, onOpenChange, rule, agents, campaigns, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: LeadsAssignmentRule | null
  agents: Agent[]
  campaigns: LeadsCampaign[]
  onSaved: () => void
}) {
  const isEdit = !!rule
  const [form, setForm] = useState({
    name: '', description: '', priority: '0',
    source_match: [] as string[],
    campaign_id_match: '',
    sector_match: [] as string[],
    consultant_id: '',
    overflow_threshold: '',
    fallback_action: 'gestora_pool',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name,
        description: rule.description ?? '',
        priority: String(rule.priority),
        source_match: rule.source_match ?? [],
        campaign_id_match: rule.campaign_id_match ?? '',
        sector_match: rule.sector_match ?? [],
        consultant_id: rule.consultant_id ?? '',
        overflow_threshold: rule.overflow_threshold?.toString() ?? '',
        fallback_action: rule.fallback_action ?? 'gestora_pool',
      })
    } else {
      setForm({
        name: '', description: '', priority: '0',
        source_match: [], campaign_id_match: '', sector_match: [],
        consultant_id: '', overflow_threshold: '', fallback_action: 'gestora_pool',
      })
    }
  }, [rule, open])

  const toggleArrayItem = (field: 'source_match' | 'sector_match', value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        priority: parseInt(form.priority) || 0,
        source_match: form.source_match.length ? form.source_match : null,
        campaign_id_match: form.campaign_id_match || null,
        sector_match: form.sector_match.length ? form.sector_match : null,
        consultant_id: form.consultant_id || null,
        overflow_threshold: form.overflow_threshold ? parseInt(form.overflow_threshold) : null,
        fallback_action: form.fallback_action,
        is_active: true,
      }

      const url = isEdit ? `/api/crm/assignment-rules/${rule!.id}` : '/api/crm/assignment-rules'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Regra actualizada' : 'Regra criada')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">
              {isEdit ? 'Editar Regra' : 'Nova Regra de Atribuição'}
            </DialogTitle>
          </div>
        </div>

        <div className="space-y-5">
          {/* Basic */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" placeholder="Ex: Meta Ads → Maria" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Prioridade</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="rounded-xl" placeholder="0" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl text-xs" rows={2} />
          </div>

          {/* Criteria */}
          <div className="rounded-xl border p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critérios de correspondência</span>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Origens (seleccione várias)</Label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => toggleArrayItem('source_match', s.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                      form.source_match.includes(s.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {form.source_match.length === 0 && <p className="text-[10px] text-muted-foreground">Vazio = qualquer origem</p>}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Campanha específica</Label>
              <Select value={form.campaign_id_match} onValueChange={v => setForm(p => ({ ...p, campaign_id_match: v === 'none' ? '' : v }))}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Qualquer campanha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Qualquer campanha</SelectItem>
                  {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Sectores</Label>
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => toggleArrayItem('sector_match', s.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                      form.sector_match.includes(s.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target */}
          <div className="rounded-xl border p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atribuir a</span>

            <div className="grid gap-2">
              <Label className="text-xs font-medium">Consultor</Label>
              <Select value={form.consultant_id} onValueChange={v => setForm(p => ({ ...p, consultant_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (round-robin)</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.commercial_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Limite de carga</Label>
                <Input type="number" value={form.overflow_threshold} onChange={e => setForm(p => ({ ...p, overflow_threshold: e.target.value }))} className="rounded-xl text-xs" placeholder="Sem limite" />
                <p className="text-[10px] text-muted-foreground">Máx leads não contactadas antes de overflow</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium">Se exceder limite</Label>
                <Select value={form.fallback_action} onValueChange={v => setForm(p => ({ ...p, fallback_action: v }))}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FALLBACK_ACTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
