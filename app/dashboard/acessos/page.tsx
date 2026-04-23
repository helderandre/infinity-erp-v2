'use client'


import { Suspense, useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Building2, Link2, Globe, Sparkles, Copy, Check,
  ExternalLink, Phone, MapPin, Plus, Trash2, Search,
  MessageCircle, BarChart3, FileText,
  Home, Users, Laptop, Loader2, UserCircle, AlertTriangle,
  MoreHorizontal, Pencil, CopyCheck,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CustomSiteDialog } from '@/components/acessos/custom-site-dialog'
import { CompanyInfoEditDialog } from '@/components/acessos/company-info-edit-dialog'
import { useAcessosCustomSites } from '@/hooks/use-acessos-custom-sites'
import { useAcessosCompanyInfo } from '@/hooks/use-acessos-company-info'
import type { HydratedAcessosCustomSite } from '@/types/acessos'

// ─── Types ──────────────────────────────────────────────

interface UserLink {
  id: string
  title: string
  url: string
  icon?: string
  created_at: string
}

// ─── Copy Hook ──────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('Copiado!')
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])

  return { copiedKey, copy }
}

// ─── Data ───────────────────────────────────────────────

const ATALHOS = {
  remax: [
    { title: 'MaxWork', icon: Laptop, url: 'https://app.maxwork.pt/home', color: 'from-white/15 to-white/5' },
    { title: 'Contactos', icon: Users, url: 'https://app.maxwork.pt/contact/list', color: 'from-white/15 to-white/5' },
    { title: 'Imóveis RE/MAX', icon: Building2, url: 'https://remax.pt/pt', color: 'from-white/15 to-white/5' },
    { title: 'Convictus', icon: Home, url: 'https://remax.pt/pt/comprar/imoveis/h/r/r/r/t?s=%7B%22of%22%3A%2212149%22%2C%22nm%22%3A%22RE%2FMAX%20ConviCtus%22%2C%22os%22%3A%22false%22%7D&p=1&o=-PublishDate', color: 'from-white/15 to-white/5' },
  ],
  motores: [
    { portal: 'Idealista', site: 'https://www.idealista.pt/', pesquisas: 'https://www.idealista.pt/utilizador/favoritos/', imoveis: 'https://www.idealista.pt/tools/listadostarter' },
    { portal: 'CasaYes', site: 'https://casayes.pt/pt', pesquisas: 'https://casayes.pt/en/perfil/pesquisas-guardadas', imoveis: null },
    { portal: 'ImoVirtual', site: 'https://www.imovirtual.com/', pesquisas: 'https://www.imovirtual.com/pt/guardados/pesquisas', imoveis: 'https://www.imovirtual.com/pt/conta-pessoal' },
  ],
  noticias: [
    { title: 'CI', url: 'https://www.confidencialimobiliario.com/novidades/' },
    { title: 'Idealista', url: 'https://www.idealista.pt/news/' },
    { title: 'Eco Sapo', url: 'https://eco.sapo.pt/topico/imobiliario/' },
  ],
}

const WEBSITES = {
  microsir: {
    label: 'MicroSIR',
    login: 'assistente.filipe.pereira@remax.pt',
    password: '77@Assistente.lb',
    links: [
      { title: 'SIR', url: 'https://sir.confidencialimobiliario.com/' },
    ],
  },
  casafari: {
    label: 'Casafari',
    links: [
      { title: 'Casafari', url: 'https://pt.casafari.com/login?next=%2Faccount%2Fstarting-page' },
    ],
  },
}

// ─── Tabs config ────────────────────────────────────────

const TABS = [
  { key: 'atalhos' as const, label: 'Atalhos', icon: Sparkles },
  { key: 'links' as const, label: 'Os Meus Links', icon: Link2 },
  { key: 'websites' as const, label: 'Websites', icon: Globe },
  { key: 'estrutura' as const, label: 'Estrutura', icon: Building2 },
] as const

type TabKey = (typeof TABS)[number]['key']

const SUB_TABS_ESTRUTURA = [
  { key: 'faturacao' as const, label: 'Faturação' },
  { key: 'convictus' as const, label: 'Convictus' },
]

const SUB_TABS_WEBSITES = [
  { key: 'microsir' as const, label: 'MicroSIR' },
  { key: 'casafari' as const, label: 'Casafari' },
  { key: 'outros' as const, label: 'Outros' },
]

// ─── Shared sub-components ──────────────────────────────

function PillTabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { key: T; label: string }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-medium transition-all',
            active === t.key
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function CopyButton({ text, copyKey, copiedKey, onCopy }: {
  text: string; copyKey: string; copiedKey: string | null; onCopy: (text: string, key: string) => void
}) {
  const isCopied = copiedKey === copyKey
  return (
    <button
      onClick={() => onCopy(text, copyKey)}
      className={cn(
        'p-2 rounded-xl transition-all',
        isCopied
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
      )}
    >
      {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function InfoRow({ label, value, copyKey, copiedKey, onCopy, actions }: {
  label: string; value: string; copyKey: string; copiedKey: string | null
  onCopy: (text: string, key: string) => void; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <CopyButton text={value} copyKey={copyKey} copiedKey={copiedKey} onCopy={onCopy} />
        {actions}
      </div>
    </div>
  )
}

function GlassCard({ children, className, header }: { children: React.ReactNode; className?: string; header?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden', className)}>
      {header && (
        <div className="px-5 py-3.5 bg-neutral-900 dark:bg-neutral-800">
          <p className="text-xs font-semibold text-white tracking-tight">{header}</p>
        </div>
      )}
      {children}
    </div>
  )
}

function IconActionButton({ href, icon: Icon, label }: { href: string; icon: typeof Phone; label?: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="p-2 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
      title={label}
    >
      <Icon className="size-3.5" />
    </a>
  )
}

function LinkCard({
  title, url, icon: Icon = ExternalLink, actions, badge,
}: {
  title: string
  url: string
  icon?: typeof ExternalLink
  actions?: React.ReactNode
  badge?: React.ReactNode
}) {
  const hasTrailing = !!actions || !!badge
  if (!hasTrailing) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3.5 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:border-border/50 hover:-translate-y-0.5"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/30 group-hover:from-primary/10 group-hover:to-primary/5 transition-all">
          <Icon className="size-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
        </div>
        <ExternalLink className="size-3.5 text-muted-foreground/20 group-hover:text-primary/50 transition-colors shrink-0" />
      </a>
    )
  }
  return (
    <div className="group relative flex items-center gap-3.5 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:border-border/50 hover:-translate-y-0.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3.5 flex-1 min-w-0"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/30 group-hover:from-primary/10 group-hover:to-primary/5 transition-all">
          <Icon className="size-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
        </div>
      </a>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {actions}
      </div>
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────

function AcessosSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  )
}

// ─── Tab: Estrutura ─────────────────────────────────────

function CopyAllButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Todos os dados copiados!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all',
        copied
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm'
      )}
    >
      {copied ? <Check className="size-3.5" /> : <CopyCheck className="size-3.5" />}
      {copied ? 'Copiado' : label ?? 'Copiar tudo'}
    </button>
  )
}

function EstruturaContent() {
  const { copiedKey, copy } = useCopy()
  const [subTab, setSubTab] = useState<'faturacao' | 'convictus'>('faturacao')
  const { faturacao, convictus, canManage, isLoading, refetch } = useAcessosCompanyInfo()
  const [editOpen, setEditOpen] = useState(false)

  const faturacaoText = faturacao
    ? [
        `Nome: ${faturacao.nome}`,
        `Sede: ${faturacao.sede}`,
        `NIPC: ${faturacao.nipc}`,
      ].join('\n')
    : ''

  const convictusText = convictus
    ? [
        '— Sede —',
        `${convictus.sede.nome}`,
        `Morada: ${convictus.sede.morada}`,
        `Telefone: ${convictus.sede.telefone}`,
        `AMI: ${convictus.sede.ami}`,
        '',
        '— A Nossa Agência —',
        `${convictus.agencia.nome}`,
        `Morada: ${convictus.agencia.morada}`,
        `Telefone: ${convictus.agencia.telefone}`,
      ].join('\n')
    : ''

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs tabs={SUB_TABS_ESTRUTURA} active={subTab} onChange={setSubTab} />
        <div className="flex items-center gap-2">
          <CopyAllButton text={subTab === 'faturacao' ? faturacaoText : convictusText} />
          {canManage && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium bg-muted/60 text-foreground hover:bg-muted transition-all border border-border/30"
              title="Editar dados"
            >
              <Pencil className="size-3.5" />
              Editar
            </button>
          )}
        </div>
      </div>

      {subTab === 'faturacao' && faturacao && (
        <GlassCard header="Dados de Faturação">
          <div className="divide-y divide-border/30 px-5">
            <InfoRow label="Nome da Empresa" value={faturacao.nome} copyKey="fat-nome" copiedKey={copiedKey} onCopy={copy} />
            <InfoRow label="Sede" value={faturacao.sede} copyKey="fat-sede" copiedKey={copiedKey} onCopy={copy} />
            <InfoRow label="NIPC" value={faturacao.nipc} copyKey="fat-nipc" copiedKey={copiedKey} onCopy={copy} />
          </div>
        </GlassCard>
      )}

      {subTab === 'convictus' && convictus && (
        <div className="space-y-4">
          <GlassCard header="Sede">
            <div className="divide-y divide-border/30 px-5">
              <InfoRow
                label={convictus.sede.nome}
                value={convictus.sede.morada}
                copyKey="sede-morada" copiedKey={copiedKey} onCopy={copy}
                actions={<IconActionButton href={`https://maps.google.com/?q=${encodeURIComponent(convictus.sede.morada)}`} icon={MapPin} label="Ver no mapa" />}
              />
              <InfoRow
                label="Telefone" value={convictus.sede.telefone}
                copyKey="sede-tel" copiedKey={copiedKey} onCopy={copy}
                actions={<IconActionButton href={`tel:${convictus.sede.telefone}`} icon={Phone} label="Ligar" />}
              />
              <InfoRow label="AMI" value={convictus.sede.ami} copyKey="sede-ami" copiedKey={copiedKey} onCopy={copy} />
            </div>
          </GlassCard>

          <GlassCard header="A Nossa Agência">
            <div className="divide-y divide-border/30 px-5">
              <InfoRow
                label={convictus.agencia.nome}
                value={convictus.agencia.morada}
                copyKey="ag-morada" copiedKey={copiedKey} onCopy={copy}
                actions={<IconActionButton href={`https://maps.google.com/?q=${encodeURIComponent(convictus.agencia.morada)}`} icon={MapPin} label="Ver no mapa" />}
              />
              <InfoRow
                label="Telefone Loja" value={convictus.agencia.telefone}
                copyKey="ag-tel" copiedKey={copiedKey} onCopy={copy}
                actions={<IconActionButton href={`tel:${convictus.agencia.telefone}`} icon={Phone} label="Ligar" />}
              />
            </div>
          </GlassCard>
        </div>
      )}

      {canManage && subTab === 'faturacao' && faturacao && (
        <CompanyInfoEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          scope="faturacao"
          initial={faturacao}
          onSaved={refetch}
        />
      )}
      {canManage && subTab === 'convictus' && convictus && (
        <CompanyInfoEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          scope="convictus"
          initial={convictus}
          onSaved={refetch}
        />
      )}
    </div>
  )
}

// ─── Tab: Atalhos ───────────────────────────────────────

function AtalhosContent() {
  return (
    <div className="space-y-5">
      {/* RE/MAX shortcuts */}
      <div className="rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {ATALHOS.remax.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center gap-3.5 p-7 bg-neutral-900 dark:bg-neutral-800 transition-all duration-300 hover:bg-neutral-800 dark:hover:bg-neutral-700 border-r border-b border-white/5 last:border-r-0 md:[&:nth-child(4)]:border-r-0 md:border-b-0"
            >
              <div className={cn('flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-inner transition-all duration-300 group-hover:scale-110', item.color)}>
                <item.icon className="size-6 text-white/70 group-hover:text-white transition-colors" />
              </div>
              <span className="text-sm font-semibold text-white/90">{item.title}</span>
              <ExternalLink className="absolute top-3.5 right-3.5 size-3 text-white/15 group-hover:text-white/40 transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Motores de Pesquisa */}
      <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-neutral-900 dark:bg-neutral-800">
          <p className="text-xs font-semibold text-white tracking-tight">Motores de Pesquisa</p>
        </div>
        <div className="divide-y divide-border/30">
          {ATALHOS.motores.map((motor) => (
            <div key={motor.portal} className="flex items-center">
              <a
                href={motor.site}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-semibold">{motor.portal}</span>
              </a>
              <div className="flex divide-x divide-border/30 border-l border-border/30">
                <a
                  href={motor.pesquisas}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-4 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <Search className="size-3.5" />
                  <span className="hidden sm:inline text-xs font-medium">Pesquisas</span>
                </a>
                {motor.imoveis && (
                  <a
                    href={motor.imoveis}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-4 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <Home className="size-3.5" />
                    <span className="hidden sm:inline text-xs font-medium">Imóveis</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notícias */}
      <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-neutral-900 dark:bg-neutral-800">
          <p className="text-xs font-semibold text-white tracking-tight">Notícias</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
          {ATALHOS.noticias.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/30 group-hover:from-primary/10 group-hover:to-primary/5 transition-all shrink-0">
                <FileText className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-semibold">{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Websites ──────────────────────────────────────

function WebsitesContent() {
  const { copiedKey, copy } = useCopy()
  const [subTab, setSubTab] = useState<'microsir' | 'casafari' | 'outros'>('microsir')

  return (
    <div className="space-y-5">
      <PillTabs tabs={SUB_TABS_WEBSITES} active={subTab} onChange={setSubTab} />

      {subTab === 'outros' ? (
        <OutrosContent />
      ) : (
        <div className="space-y-4">
          {/* Credentials */}
          {'login' in WEBSITES[subTab] && (
            <GlassCard header="Credenciais de Acesso">
              <div className="divide-y divide-border/30 px-5">
                <InfoRow
                  label="Login"
                  value={(WEBSITES[subTab] as typeof WEBSITES.microsir).login}
                  copyKey={`${subTab}-login`} copiedKey={copiedKey} onCopy={copy}
                />
                <InfoRow
                  label="Password"
                  value={(WEBSITES[subTab] as typeof WEBSITES.microsir).password}
                  copyKey={`${subTab}-pass`} copiedKey={copiedKey} onCopy={copy}
                />
              </div>
              {subTab === 'microsir' && (
                <div className="mx-5 mb-5 mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Faz logout do teu Maxwork e entra com as credenciais indicadas acima – Assistente.</span>
                </div>
              )}
            </GlassCard>
          )}

          {/* Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WEBSITES[subTab].links.map((link) => (
              <LinkCard key={link.title} title={link.title} url={link.url} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-tab: Outros (dynamic) ──────────────────────────

function OutrosContent() {
  const { sites, isLoading, canManageGlobal, refetch } = useAcessosCustomSites()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HydratedAcessosCustomSite | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HydratedAcessosCustomSite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/acessos/custom-sites/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao eliminar')
      }
      toast.success('Site eliminado')
      setDeleteTarget(null)
      await refetch()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Adicionar site
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Sem sites"
          description="Adiciona o teu primeiro site para o acessar rapidamente."
          action={{
            label: 'Adicionar site',
            onClick: () => { setEditing(null); setDialogOpen(true) },
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((site) => {
            const systemBadge = site.is_system
              ? <Badge variant="secondary" className="text-[10px]">Sistema</Badge>
              : null
            const showActions = site.can_edit || site.can_delete
            const actions = showActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    aria-label="Acções"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {site.can_edit && (
                    <DropdownMenuItem
                      onClick={() => { setEditing(site); setDialogOpen(true) }}
                    >
                      <Pencil className="mr-2 size-3.5" /> Editar
                    </DropdownMenuItem>
                  )}
                  {site.can_delete && (
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(site)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 size-3.5" /> Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
            return (
              <LinkCard
                key={site.id}
                title={site.title}
                url={site.url}
                badge={systemBadge}
                actions={actions}
              />
            )
          })}
        </div>
      )}

      <CustomSiteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editing}
        canManageGlobal={canManageGlobal}
        onSaved={refetch}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar site</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar &quot;{deleteTarget?.title}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tab: Links ─────────────────────────────────────────

function LinksContent() {
  const isMobile = useIsMobile()
  const [links, setLinks] = useState<UserLink[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/user-links')
      if (res.ok) setLinks(await res.json())
    } catch {
      toast.error('Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const handleCreate = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return
    setSaving(true)
    try {
      let url = newUrl.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      const res = await fetch('/api/user-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), url }),
      })
      if (!res.ok) throw new Error()
      const link = await res.json()
      setLinks((prev) => [link, ...prev])
      setNewTitle('')
      setNewUrl('')
      setDialogOpen(false)
      toast.success('Link adicionado!')
    } catch {
      toast.error('Erro ao guardar link')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/user-links?id=${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLinks((prev) => prev.filter((l) => l.id !== deleteId))
      toast.success('Link eliminado')
    } catch {
      toast.error('Erro ao eliminar link')
    } finally {
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm transition-all duration-200"
        >
          <Plus className="size-3.5" />
          Adicionar Link
        </button>
        <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={cn(
              'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
              'bg-background',
              isMobile
                ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
                : 'w-full data-[side=right]:sm:max-w-[468px] sm:rounded-l-3xl',
            )}
          >
            {isMobile && (
              <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
            )}
            <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
              <SheetHeader className="p-0 gap-0">
                <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                  Novo link
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Adiciona um link rápido ao teu espaço pessoal.
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="link-title" className="text-xs font-medium text-muted-foreground">Título</Label>
                <Input
                  id="link-title"
                  placeholder="Ex: Notion, Trello, ..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-url" className="text-xs font-medium text-muted-foreground">URL</Label>
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background border-t border-border/50">
              <Button type="button" variant="outline" size="sm" className="rounded-full flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="button" size="sm" className="rounded-full flex-1" onClick={handleCreate} disabled={saving || !newTitle.trim() || !newUrl.trim()}>
                {saving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Guardar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Sem links guardados"
          description="Adiciona links para aceder rapidamente às tuas ferramentas do dia-a-dia"
          action={{ label: 'Adicionar Link', onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {links.map((link) => (
            <div key={link.id} className="group relative">
              <LinkCard title={link.title} url={link.url} />
              <button
                onClick={() => setDeleteId(link.id)}
                className="absolute top-3 right-3 flex items-center justify-center size-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/30 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:border-destructive/30"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar link</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este link? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

function AcessosPageInner() {
  return (
    <Suspense fallback={<AcessosSkeleton />}>
      <AcessosPageContent />
    </Suspense>
  )
}

function AcessosPageContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('atalhos')

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Acessos</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Links rápidos, credenciais e informações da empresa.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="size-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <span className="sm:hidden text-xs font-medium text-muted-foreground bg-muted/40 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5">
          {TABS.find((t) => t.key === activeTab)?.label}
        </span>
      </div>

      {/* Content */}
      {activeTab === 'atalhos' && <AtalhosContent />}
      {activeTab === 'links' && <LinksContent />}
      {activeTab === 'websites' && <WebsitesContent />}
      {activeTab === 'estrutura' && <EstruturaContent />}
    </div>
  )
}

export default function AcessosPage() {
  return (
    <Suspense fallback={null}>
      <AcessosPageInner />
    </Suspense>
  )
}

