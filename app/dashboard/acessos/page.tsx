'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Building2, Link2, Globe, Sparkles, Copy, Check,
  ExternalLink, Phone, MapPin, Plus, Trash2, Search,
  MonitorSmartphone, MessageCircle, BarChart3, FileText,
  Home, Users, Laptop, Loader2,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
    { title: 'MaxWork', icon: Laptop, url: 'https://maxwork.remax.pt' },
    { title: 'Contactos', icon: Users, url: 'https://maxwork.remax.pt/contacts' },
    { title: 'Imóveis RE/MAX', icon: Building2, url: 'https://www.remax.pt' },
    { title: 'Imóveis Convictus', icon: Home, url: 'https://www.remax.pt/convictus' },
  ],
  motores: [
    { portal: 'Idealista', pesquisas: 'https://www.idealista.pt', imoveis: 'https://www.idealista.pt/venda-casas/' },
    { portal: 'CasaYes', pesquisas: 'https://www.casayes.pt', imoveis: 'https://www.casayes.pt/comprar' },
    { portal: 'ImoVirtual', pesquisas: 'https://www.imovirtual.com', imoveis: 'https://www.imovirtual.com/comprar/' },
  ],
  noticias: [
    { title: 'CI', url: 'https://www.confidencialimobiliario.com' },
    { title: 'Idealista', url: 'https://www.idealista.pt/news/' },
    { title: 'Eco Sapo', url: 'https://eco.sapo.pt/imobiliario/' },
  ],
}

const WEBSITES = {
  microsir: {
    label: 'MicroSIR',
    login: 'assistente.filipe.pereira@remax.pt',
    password: '77@Assistente.lb',
    links: [
      { title: 'SIR', url: 'https://sir.remax.pt' },
    ],
  },
  casafari: {
    label: 'Casafari',
    links: [
      { title: 'Casafari', url: 'https://app.casafari.com' },
    ],
  },
  outros: {
    label: 'Outros',
    links: [
      { title: 'ChatGPT', url: 'https://chat.openai.com', icon: MonitorSmartphone },
      { title: 'Canva', url: 'https://www.canva.com', icon: MonitorSmartphone },
      { title: 'WhatsApp Web', url: 'https://web.whatsapp.com', icon: MessageCircle },
      { title: 'Monday.com', url: 'https://monday.com', icon: BarChart3 },
    ],
  },
}

// ─── Sub-components ─────────────────────────────────────

function CopyButton({ text, copyKey, copiedKey, onCopy }: {
  text: string; copyKey: string; copiedKey: string | null; onCopy: (text: string, key: string) => void
}) {
  const isCopied = copiedKey === copyKey
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5 rounded-lg"
      onClick={() => onCopy(text, copyKey)}
    >
      {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      <span className="text-xs">{isCopied ? 'Copiado' : 'Copiar'}</span>
    </Button>
  )
}

function InfoRow({ label, value, copyKey, copiedKey, onCopy, actions }: {
  label: string; value: string; copyKey: string; copiedKey: string | null
  onCopy: (text: string, key: string) => void; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <CopyButton text={value} copyKey={copyKey} copiedKey={copiedKey} onCopy={onCopy} />
        {actions}
      </div>
    </div>
  )
}

// ─── Tab: Estrutura ─────────────────────────────────────

function EstruturaTab() {
  const { copiedKey, copy } = useCopy()
  const [subTab, setSubTab] = useState('faturacao')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Estrutura da Empresa</h3>
        <p className="text-sm text-muted-foreground">
          Informações da empresa para utilizar no dia-a-dia
        </p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="faturacao">Faturação</TabsTrigger>
          <TabsTrigger value="convictus">Convictus</TabsTrigger>
        </TabsList>

        <TabsContent value="faturacao" className="mt-4">
          <Card>
            <CardContent className="divide-y pt-6">
              <InfoRow
                label="Nome da Empresa"
                value={COMPANY_INFO.faturacao.nome}
                copyKey="fat-nome"
                copiedKey={copiedKey}
                onCopy={copy}
              />
              <InfoRow
                label="Sede"
                value={COMPANY_INFO.faturacao.sede}
                copyKey="fat-sede"
                copiedKey={copiedKey}
                onCopy={copy}
              />
              <InfoRow
                label="NIPC"
                value={COMPANY_INFO.faturacao.nipc}
                copyKey="fat-nipc"
                copiedKey={copiedKey}
                onCopy={copy}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convictus" className="mt-4 space-y-6">
          {/* Sede */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Sede
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow
                label={COMPANY_INFO.agencia.sede.nome}
                value={COMPANY_INFO.agencia.sede.morada}
                copyKey="sede-morada"
                copiedKey={copiedKey}
                onCopy={copy}
                actions={
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" asChild>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(COMPANY_INFO.agencia.sede.morada)}`} target="_blank" rel="noopener noreferrer">
                      <MapPin className="size-3.5" />
                    </a>
                  </Button>
                }
              />
              <InfoRow
                label="Telefone"
                value={COMPANY_INFO.agencia.sede.telefone}
                copyKey="sede-tel"
                copiedKey={copiedKey}
                onCopy={copy}
                actions={
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" asChild>
                    <a href={`tel:${COMPANY_INFO.agencia.sede.telefone}`}>
                      <Phone className="size-3.5" />
                    </a>
                  </Button>
                }
              />
              <InfoRow
                label="AMI"
                value={COMPANY_INFO.agencia.sede.ami}
                copyKey="sede-ami"
                copiedKey={copiedKey}
                onCopy={copy}
              />
            </CardContent>
          </Card>

          {/* Agência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                A Nossa Agência
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow
                label={COMPANY_INFO.agencia.nome}
                value={COMPANY_INFO.agencia.morada}
                copyKey="ag-morada"
                copiedKey={copiedKey}
                onCopy={copy}
                actions={
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" asChild>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(COMPANY_INFO.agencia.morada)}`} target="_blank" rel="noopener noreferrer">
                      <MapPin className="size-3.5" />
                    </a>
                  </Button>
                }
              />
              <InfoRow
                label="Telefone Loja"
                value={COMPANY_INFO.agencia.telefone}
                copyKey="ag-tel"
                copiedKey={copiedKey}
                onCopy={copy}
                actions={
                  <Button variant="outline" size="icon" className="size-8 rounded-lg" asChild>
                    <a href={`tel:${COMPANY_INFO.agencia.telefone}`}>
                      <Phone className="size-3.5" />
                    </a>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Tab: Atalhos ───────────────────────────────────────

function AtalhosTab() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">Atalhos Rápidos</h3>
        <p className="text-sm text-muted-foreground">
          Acesso directo às plataformas mais utilizadas
        </p>
      </div>

      {/* RE/MAX */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">RE/MAX</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ATALHOS.remax.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2.5 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20 hover:scale-[1.02]"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <item.icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium">{item.title}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Motores de Pesquisa */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Motores de Pesquisa
        </h4>
        <div className="space-y-2">
          {ATALHOS.motores.map((motor) => (
            <Card key={motor.portal} className="overflow-hidden">
              <div className="flex items-center divide-x">
                <div className="flex-1 px-4 py-3">
                  <span className="text-sm font-semibold">{motor.portal}</span>
                </div>
                <a
                  href={motor.pesquisas}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                >
                  <Search className="size-4" />
                  Pesquisas
                </a>
                <a
                  href={motor.imoveis}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                >
                  <Home className="size-4" />
                  Imóveis à Venda
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Notícias */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notícias</h4>
        <div className="grid grid-cols-3 gap-3">
          {ATALHOS.noticias.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2.5 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20 hover:scale-[1.02]"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <FileText className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium">{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Websites ──────────────────────────────────────

function WebsitesTab() {
  const { copiedKey, copy } = useCopy()
  const [subTab, setSubTab] = useState('microsir')

  const renderWebsiteSection = (key: string) => {
    const section = WEBSITES[key as keyof typeof WEBSITES]
    return (
      <div className="space-y-4">
        {/* Credentials (if they exist) */}
        {'login' in section && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Credenciais de Acesso</CardTitle>
              <CardDescription>Dados partilhados da equipa</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow
                label="Login"
                value={(section as typeof WEBSITES.microsir).login}
                copyKey={`${key}-login`}
                copiedKey={copiedKey}
                onCopy={copy}
              />
              <InfoRow
                label="Password"
                value={(section as typeof WEBSITES.microsir).password}
                copyKey={`${key}-pass`}
                copiedKey={copiedKey}
                onCopy={copy}
              />
            </CardContent>
          </Card>
        )}

        {/* Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {section.links.map((link) => (
            <a
              key={link.title}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2.5 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20 hover:scale-[1.02]"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <ExternalLink className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium">{link.title}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Websites & Plataformas</h3>
        <p className="text-sm text-muted-foreground">
          Acessos a plataformas externas com credenciais partilhadas
        </p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="microsir">MicroSIR</TabsTrigger>
          <TabsTrigger value="casafari">Casafari</TabsTrigger>
          <TabsTrigger value="outros">Outros</TabsTrigger>
        </TabsList>

        {Object.keys(WEBSITES).map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            {renderWebsiteSection(key)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// ─── Tab: Links ─────────────────────────────────────────

function LinksTab() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Os Meus Links</h3>
          <p className="text-sm text-muted-foreground">
            Adiciona links para ferramentas que uses no teu dia-a-dia
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 rounded-lg">
              <Plus className="size-4" />
              Adicionar
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !newTitle.trim() || !newUrl.trim()}>
                {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-4">
              <Link2 className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">Sem links guardados</p>
            <p className="text-xs text-muted-foreground mb-4">
              Adiciona links para aceder rapidamente às tuas ferramentas
            </p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Adicionar Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="group relative flex flex-col items-center gap-2.5 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteId(link.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2.5 w-full"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                  <ExternalLink className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm font-medium">{link.title}</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-full">
                  {link.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </a>
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
  const [activeTab, setActiveTab] = useState('estrutura')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Acessos</h1>
            <p className="text-sm text-muted-foreground">
              Informações da empresa, atalhos e plataformas
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="estrutura" className="gap-1.5">
            <Building2 className="size-4" />
            <span className="hidden sm:inline">Estrutura</span>
          </TabsTrigger>
          <TabsTrigger value="atalhos" className="gap-1.5">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">Atalhos</span>
          </TabsTrigger>
          <TabsTrigger value="websites" className="gap-1.5">
            <Globe className="size-4" />
            <span className="hidden sm:inline">Websites</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <Link2 className="size-4" />
            <span className="hidden sm:inline">Os Meus Links</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estrutura" className="mt-6">
          <EstruturaTab />
        </TabsContent>
        <TabsContent value="atalhos" className="mt-6">
          <AtalhosTab />
        </TabsContent>
        <TabsContent value="websites" className="mt-6">
          <WebsitesTab />
        </TabsContent>
        <TabsContent value="links" className="mt-6">
          <LinksTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
