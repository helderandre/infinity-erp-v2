'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Building2, Link2, Globe, Sparkles, Copy, Check,
  ExternalLink, Phone, MapPin, Plus, Trash2, Search,
  MessageCircle, BarChart3, FileText,
  Home, Users, Laptop, Loader2, UserCircle,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

const COMPANY_INFO = {
  faturacao: {
    nome: 'LECOQIMMO - MEDIAÇÃO IMOBILIÁRIA, UNIPESSOAL LDA',
    sede: 'Avenida da Liberdade, Nº 129 B 1250-140 Lisboa',
    nipc: '514828528',
  },
  agencia: {
    nome: 'RE/MAX COLLECTION CONVICTUS',
    morada: 'Avenida Ressano Garcia, 37 A 1070-234 Lisboa',
    telefone: '218 036 779',
    sede: {
      nome: 'RE/MAX CONVICTUS',
      morada: 'Av. das Forças Armadas 22 C 1600-082 Lisboa',
      telefone: '217978189',
      ami: '4719',
    },
  },
}

const ATALHOS = {
  remax: [
    { title: 'MaxWork', icon: Laptop, url: 'https://app.maxwork.pt/home' },
    { title: 'Contactos', icon: Users, url: 'https://app.maxwork.pt/contact/list' },
    { title: 'Imóveis RE/MAX', icon: Building2, url: 'https://remax.pt/pt' },
    { title: 'Imóveis Convictus', icon: Home, url: 'https://remax.pt/pt/comprar/imoveis/h/r/r/r/t?s=%7B%22of%22%3A%2212149%22%2C%22nm%22%3A%22RE%2FMAX%20ConviCtus%22%2C%22os%22%3A%22false%22%7D&p=1&o=-PublishDate' },
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
  outros: {
    label: 'Outros',
    links: [
      { title: 'ChatGPT', url: 'https://chat.openai.com' },
      { title: 'Canva', url: 'https://www.canva.com' },
      { title: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
      { title: 'Monday.com', url: 'https://monday.com' },
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
    <div className="flex gap-1 p-0.5 rounded-full bg-muted/50 border border-border/30 w-fit">
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
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
        isCopied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
          : 'border-border/50 bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground'
      )}
    >
      {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {isCopied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function InfoRow({ label, value, copyKey, copiedKey, onCopy, actions }: {
  label: string; value: string; copyKey: string; copiedKey: string | null
  onCopy: (text: string, key: string) => void; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <CopyButton text={value} copyKey={copyKey} copiedKey={copiedKey} onCopy={onCopy} />
        {actions}
      </div>
    </div>
  )
}

function IconButton({ href, icon: Icon, label }: { href: string; icon: typeof Phone; label?: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center justify-center size-8 rounded-full border border-border/50 bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
      title={label}
    >
      <Icon className="size-3.5" />
    </a>
  )
}

function LinkCard({ title, url, icon: Icon = ExternalLink }: { title: string; url: string; icon?: typeof ExternalLink }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/20 hover:scale-[1.01]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
        <Icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground/60 truncate">{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
      </div>
      <ExternalLink className="size-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
    </a>
  )
}

// ─── Skeleton ───────────────────────────────────────────

function AcessosSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Tab: Estrutura ─────────────────────────────────────

function EstruturaContent() {
  const { copiedKey, copy } = useCopy()
  const [subTab, setSubTab] = useState<'faturacao' | 'convictus'>('faturacao')

  return (
    <div className="space-y-5">
      <PillTabs tabs={SUB_TABS_ESTRUTURA} active={subTab} onChange={setSubTab} />

      {subTab === 'faturacao' && (
        <div className="rounded-2xl border bg-card divide-y">
          <div className="px-5 py-4">
            <InfoRow label="Nome da Empresa" value={COMPANY_INFO.faturacao.nome} copyKey="fat-nome" copiedKey={copiedKey} onCopy={copy} />
          </div>
          <div className="px-5 py-4">
            <InfoRow label="Sede" value={COMPANY_INFO.faturacao.sede} copyKey="fat-sede" copiedKey={copiedKey} onCopy={copy} />
          </div>
          <div className="px-5 py-4">
            <InfoRow label="NIPC" value={COMPANY_INFO.faturacao.nipc} copyKey="fat-nipc" copiedKey={copiedKey} onCopy={copy} />
          </div>
        </div>
      )}

      {subTab === 'convictus' && (
        <div className="space-y-4">
          {/* Sede */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Sede</p>
            </div>
            <div className="divide-y">
              <div className="px-5 py-4">
                <InfoRow
                  label={COMPANY_INFO.agencia.sede.nome}
                  value={COMPANY_INFO.agencia.sede.morada}
                  copyKey="sede-morada" copiedKey={copiedKey} onCopy={copy}
                  actions={<IconButton href={`https://maps.google.com/?q=${encodeURIComponent(COMPANY_INFO.agencia.sede.morada)}`} icon={MapPin} label="Ver no mapa" />}
                />
              </div>
              <div className="px-5 py-4">
                <InfoRow
                  label="Telefone" value={COMPANY_INFO.agencia.sede.telefone}
                  copyKey="sede-tel" copiedKey={copiedKey} onCopy={copy}
                  actions={<IconButton href={`tel:${COMPANY_INFO.agencia.sede.telefone}`} icon={Phone} label="Ligar" />}
                />
              </div>
              <div className="px-5 py-4">
                <InfoRow label="AMI" value={COMPANY_INFO.agencia.sede.ami} copyKey="sede-ami" copiedKey={copiedKey} onCopy={copy} />
              </div>
            </div>
          </div>

          {/* Agência */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">A Nossa Agência</p>
            </div>
            <div className="divide-y">
              <div className="px-5 py-4">
                <InfoRow
                  label={COMPANY_INFO.agencia.nome}
                  value={COMPANY_INFO.agencia.morada}
                  copyKey="ag-morada" copiedKey={copiedKey} onCopy={copy}
                  actions={<IconButton href={`https://maps.google.com/?q=${encodeURIComponent(COMPANY_INFO.agencia.morada)}`} icon={MapPin} label="Ver no mapa" />}
                />
              </div>
              <div className="px-5 py-4">
                <InfoRow
                  label="Telefone Loja" value={COMPANY_INFO.agencia.telefone}
                  copyKey="ag-tel" copiedKey={copiedKey} onCopy={copy}
                  actions={<IconButton href={`tel:${COMPANY_INFO.agencia.telefone}`} icon={Phone} label="Ligar" />}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Atalhos ───────────────────────────────────────

function AtalhosContent() {
  return (
    <div className="space-y-8">
      {/* RE/MAX */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">RE/MAX</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ATALHOS.remax.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center gap-3 rounded-2xl bg-card p-6 shadow-sm border border-border/40 transition-all hover:shadow-lg hover:border-primary/30 hover:scale-[1.03] hover:-translate-y-0.5"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 shadow-inner group-hover:from-primary/10 group-hover:to-primary/5 transition-all">
                <item.icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-semibold">{item.title}</span>
              <ExternalLink className="absolute top-3 right-3 size-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Motores de Pesquisa */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Motores de Pesquisa</p>
        <div className="space-y-2">
          {ATALHOS.motores.map((motor) => (
            <div key={motor.portal} className="flex items-center rounded-2xl border bg-card overflow-hidden">
              <a
                href={motor.site}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-semibold">{motor.portal}</span>
              </a>
              <div className="flex divide-x border-l">
                <a
                  href={motor.pesquisas}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                >
                  <Search className="size-4" />
                  <span className="hidden sm:inline">Pesquisas</span>
                </a>
                {motor.imoveis && (
                  <a
                    href={motor.imoveis}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                  >
                    <Home className="size-4" />
                    <span className="hidden sm:inline">Imóveis</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notícias */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Notícias</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {ATALHOS.noticias.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-5 py-3.5 shadow-sm transition-all hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] shrink-0"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                <FileText className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">{item.title}</span>
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

  const section = WEBSITES[subTab]

  return (
    <div className="space-y-5">
      <PillTabs tabs={SUB_TABS_WEBSITES} active={subTab} onChange={setSubTab} />

      <div className="space-y-4">
        {/* Credentials */}
        {'login' in section && (
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Credenciais de Acesso</p>
            </div>
            <div className="divide-y">
              <div className="px-5 py-4">
                <InfoRow
                  label="Login"
                  value={(section as typeof WEBSITES.microsir).login}
                  copyKey={`${subTab}-login`} copiedKey={copiedKey} onCopy={copy}
                />
              </div>
              <div className="px-5 py-4">
                <InfoRow
                  label="Password"
                  value={(section as typeof WEBSITES.microsir).password}
                  copyKey={`${subTab}-pass`} copiedKey={copiedKey} onCopy={copy}
                />
              </div>
            </div>
          </div>
        )}

        {/* Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {section.links.map((link) => (
            <LinkCard key={link.title} title={link.title} url={link.url} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Links ─────────────────────────────────────────

function LinksContent() {
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 rounded-full">
              <Plus className="size-4" />
              Adicionar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Link</DialogTitle>
              <DialogDescription>Adiciona um link rápido ao teu espaço pessoal</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="link-title">Título</Label>
                <Input
                  id="link-title"
                  placeholder="Ex: Notion, Trello, ..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !newTitle.trim() || !newUrl.trim()} className="rounded-xl">
                {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                className="absolute top-3 right-3 flex items-center justify-center size-7 rounded-full bg-background border border-border/50 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:border-destructive/30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar link</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este link? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export default function AcessosPage() {
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
      {/* Pill tabs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all',
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
        {/* Active tab name pill — visible only on mobile when labels are hidden */}
        <span className="sm:hidden text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/30 rounded-full px-3 py-1.5">
          {TABS.find((t) => t.key === activeTab)?.label}
        </span>
      </div>

      {/* Content */}
      {activeTab === 'estrutura' && <EstruturaContent />}
      {activeTab === 'atalhos' && <AtalhosContent />}
      {activeTab === 'websites' && <WebsitesContent />}
      {activeTab === 'links' && <LinksContent />}
    </div>
  )
}
