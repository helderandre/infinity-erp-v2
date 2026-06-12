'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Building2, Users, FileText, LayoutDashboard, Settings,
  UserCircle, Euro, Megaphone, FileStack, CalendarDays,
  LogOut, ChevronDown, Sun, Moon, Monitor, ChevronRight,
  Zap, Mail, FileCode2, Workflow, Braces, Bot,
  MessageCircle, MessageSquareText, Instagram, BarChart3,
  Plug, Store, UserPlus, Target,
  Landmark, GraduationCap, Briefcase, TrendingUp,
  Wallet, Handshake, ContactRound, Kanban, Package, Boxes, MessagesSquare,
  CheckSquare, Cpu, Infinity, KeyRound, Library, Bell, FolderOpen,
  Send, Palette,
} from 'lucide-react'
import Link from 'next/link'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { usePathname } from 'next/navigation'

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { useTheme } from 'next-themes'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Menu Data ───────────────────────────────────────────

export const meuEspacoItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'dashboard' },
  { title: 'Tarefas', icon: CheckSquare, href: '/dashboard/tarefas', permission: 'dashboard' },
  { title: 'Calendário', icon: CalendarDays, href: '/dashboard/calendario', permission: 'calendar' },
  { title: 'Objetivos', icon: Target, href: '/dashboard/objetivos', permission: 'goals' },
]

export const comunicacaoItems = [
  { title: 'Chat Interno', icon: MessagesSquare, href: '/dashboard/comunicacao/chat', permission: 'dashboard' },
  { title: 'WhatsApp', icon: WhatsAppIcon, href: '/dashboard/whatsapp', permission: 'dashboard' },
  { title: 'Email', icon: Mail, href: '/dashboard/email', permission: 'dashboard' },
]

export const soloItems: { title: string; icon: any; href: string; permission: string }[] = []

export const creditoItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/credito' },
  { title: 'Processos', icon: FileStack, href: '/dashboard/credito/pedidos' },
  { title: 'Simulador', icon: TrendingUp, href: '/dashboard/credito/simulador' },
  { title: 'Bancos', icon: Building2, href: '/dashboard/credito/bancos' },
]

export const bottomItems = [
  { title: 'Definições', icon: Settings, href: '/dashboard/definicoes', permission: 'settings' },
]

export const crmItems = [
  { title: 'Leads', icon: Target, href: '/dashboard/crm/leads', permission: 'leads' },
  { title: 'Oportunidades', icon: Kanban, href: '/dashboard/crm', permission: 'leads' },
  { title: 'Base de Dados', icon: Users, href: '/dashboard/leads', permission: 'leads' },
  { title: 'Análise', icon: BarChart3, href: '/dashboard/crm/analise', permission: 'leads' },
  // Gestão de Leads deixou de ter página própria — vive agora num Sheet
  // aberto pelo botão de definições no topo da página Leads (gated por
  // `leads_management`). Ver components/crm/gestao-leads-sheet.tsx.
  // Automatismos: configuração de eventos custom + cascatas de templates;
  // operacional para gestão, ruído para o consultor (que ainda assim consome
  // os automatismos via leads próprias).
  { title: 'Automatismos', icon: Bell, href: '/dashboard/crm/automatismos-contactos', permission: 'leads', managementOnly: true },
]

export const negocioItems: Array<{
  title: string
  icon: any
  href: string
  permission?: string
  managementOnly?: boolean
}> = [
  // Processos: visível a todos com `processes`. A API filtra para mostrar só
  // os processos do próprio consultor (requested_by = self OR property dele
  // OR negocio dele); gestão (admin/Broker/CEO/Gestor Processual/Office
  // Manager/Team Leader) vê todos.
  { title: 'Processos', icon: FileStack, href: '/dashboard/processos', permission: 'processes' },
  // Template de Processos is hidden from the sidebar for now — route stays live.
  // { title: 'Template de Processos', icon: Workflow, href: '/dashboard/processos/templates', permission: 'processes' },
  { title: 'Imóveis', icon: Building2, href: '/dashboard/imoveis', permission: 'properties' },
  { title: 'Negócios', icon: Briefcase, href: '/dashboard/negocios', permission: 'leads' },
]

export const infinityItems = [
  // Equipa + Parceiros are visible to all authenticated users; mutation
  // controls inside the pages are gated by the `consultants` permission.
  { title: 'Equipa', icon: Users, href: '/dashboard/consultores' },
  { title: 'Parceiros', icon: Handshake, href: '/dashboard/parceiros' },
  { title: 'Acessos', icon: KeyRound, href: '/dashboard/acessos', permission: 'dashboard' },
  { title: 'Formações', icon: GraduationCap, href: '/dashboard/formacoes', permission: 'training' },
]

// Financeiro: single entry for consultor (collapses to one link), group for
// gestão (visão geral + relatórios + definições, gated by `users`).
// The "Visão geral" entry is the role-aware page that adapts itself.
export const financeiroItems = [
  { title: 'Visão geral', icon: TrendingUp, href: '/dashboard/financeiro', permission: 'commissions' },
  { title: 'Conta corrente', icon: Wallet, href: '/dashboard/financeiro/conta-corrente', permission: 'commissions' },
  { title: 'Parceiros', icon: Handshake, href: '/dashboard/financeiro/parceiros', permission: 'users' },
  { title: 'Relatórios', icon: Briefcase, href: '/dashboard/financeiro/relatorios', permission: 'users' },
  { title: 'Definições', icon: Settings, href: '/dashboard/financeiro/definicoes', permission: 'users' },
]

export const recrutamentoItems = [
  { title: 'Candidatos', icon: Users, href: '/dashboard/recrutamento' },
  { title: 'Integração', icon: FileText, href: '/dashboard/recrutamento/formulario' },
]

/**
 * "Marketing" agrupa documentos, loja institucional, catálogo e encomendas —
 * tudo o que é material/produto institucional consumido pela equipa.
 * O conteúdo criativo/promoção (Analytics, Campanhas, Redes Sociais, Ads,
 * Recursos) vive em "Estúdio" (`estudioItems`).
 */
export const marketingItems = [
  // Docs e Marketing: gated by 'dashboard' (todos) — preserva o acesso
  // anterior do utilizador, agora dentro do grupo Marketing em vez do
  // "Meu Espaço". A página unifica documentos da empresa + designs.
  { title: 'Docs e Marketing', icon: Library, href: '/dashboard/documentos', permission: 'dashboard' },
  // Loja + Encomendas: gated por 'marketing' — preserva o gate prévio do
  // grupo "Infinity Store".
  { title: 'Infinity Store', icon: Store, href: '/dashboard/marketing/loja', permission: 'marketing' },
  // Catálogo: gestão do catálogo de produtos — só visível a gestão.
  { title: 'Catálogo', icon: Boxes, href: '/dashboard/encomendas/catalogo', permission: 'marketing', managementOnly: true },
  { title: 'Encomendas', icon: Package, href: '/dashboard/encomendas', permission: 'marketing' },
]
// Backwards-compat alias — alguns chamadores importam `lojaItems`.
export const lojaItems = marketingItems

/**
 * "Estúdio" — produção criativa e promoção: analytics, campanhas, redes
 * sociais, ads e recursos visuais. Era o antigo grupo "Marketing".
 * O alias `digitalItems` mantém compatibilidade com `breadcrumbs.tsx` e
 * outros chamadores que ainda referenciam o nome antigo.
 */
export const estudioItems = [
  { title: 'Redes Sociais', icon: UserPlus, href: '/dashboard/marketing/redes-sociais' },
  { title: 'Meta Ads', icon: Target, href: '/dashboard/meta-ads' },
  { title: 'Instagram', icon: Instagram, href: '/dashboard/instagram' },
  { title: 'Recursos', icon: FolderOpen, href: '/dashboard/marketing/recursos', permission: 'marketing' },
]
export const digitalItems = estudioItems

export const automationItems = [
  { title: 'Automatismos', icon: Zap, href: '/dashboard/automacao' },
  { title: 'Instâncias WhatsApp', icon: MessageCircle, href: '/dashboard/automacao/instancias' },
  { title: 'Templates', icon: Settings, href: '/dashboard/automacao/definicoes' },
]

export const builderItems = [
  { title: 'Template de Email', icon: Mail, href: '/dashboard/templates-email' },
  { title: 'Template de Documentos', icon: FileCode2, href: '/dashboard/templates-documentos' },
  { title: 'Variáveis de Template', icon: Braces, href: '/dashboard/templates-variaveis' },
]

export const techItems = [
  { title: 'Pipeline', icon: Cpu, href: '/dashboard/tech' },
]

export const menuItems = [
  ...meuEspacoItems, ...comunicacaoItems, ...negocioItems, ...infinityItems,
  ...financeiroItems, ...creditoItems, ...marketingItems,
  ...estudioItems, ...bottomItems,
]

// ─── Active item resolution ──────────────────────────────
// Longest-prefix-match: if multiple items match the current pathname,
// the one with the longest href wins. Avoids cases where a "parent" item
// like /dashboard/financeiro stays active when navigating to a sibling
// item like /dashboard/financeiro/conta-corrente.
function getActiveHref(
  pathname: string | null,
  items: Array<{ href: string }>,
): string | null {
  if (!pathname) return null
  const candidates = items
    .filter((item) => {
      if (item.href === '/dashboard') return pathname === '/dashboard'
      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    })
    .map((item) => item.href)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (b.length > a.length ? b : a))
}

// ─── Hover Group Dropdown (collapsed sidebar) ─────────────

function HoverGroupDropdown({
  label,
  icon: Icon,
  isSectionActive,
  items,
  pathname,
}: {
  label: string
  icon: any
  isSectionActive: boolean
  items: Array<{ title: string; icon: any; href: string; permission?: string }>
  pathname: string | null
}) {
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => cancelClose(), [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          onMouseEnter={() => {
            cancelClose()
            setOpen(true)
          }}
          onMouseLeave={scheduleClose}
          className={cn(
            'rounded-xl transition-colors',
            isSectionActive
              ? 'bg-muted/70 text-foreground shadow-sm border border-border/60 hover:bg-muted/70'
              : 'text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground'
          )}
        >
          <Icon
            className={cn(
              'size-3.5',
              isSectionActive ? 'opacity-80' : 'opacity-60'
            )}
          />
          <span>{label}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="min-w-52 rounded-xl border-border/40 bg-card/90 backdrop-blur-xl shadow-lg"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/30" />
        {(() => {
          const activeHref = getActiveHref(pathname, items)
          return items.map((item) => {
            const isActive = activeHref === item.href
            return (
              <DropdownMenuItem
                key={item.href}
                asChild
              className={cn(
                'rounded-lg mx-1 gap-2 text-[13px]',
                isActive
                  ? 'nav-pill-active focus:text-[color:var(--sidebar-brand-fg)]'
                  : 'hover:bg-muted/60'
              )}
            >
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            )
          })
        })()}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Solo Sidebar Item ───────────────────────────────────
// A top-level nav entry that is NOT a collapsible group — just a single
// link, styled like the SECTION HEADERS so it sits at the same visual level
// as the other group labels (e.g. "Negócio", "Financeiro").

function SoloSidebarItem({
  label,
  icon: Icon,
  href,
  permission,
  pathname,
  hasPermission,
}: {
  label: string
  icon: any
  href: string
  permission?: string
  pathname: string | null
  hasPermission: (p: any) => boolean
}) {
  const { state, isMobile } = useSidebar()
  const isIconMode = state === 'collapsed' && !isMobile

  if (permission && !hasPermission(permission as any)) return null

  const isActive = pathname === href || pathname?.startsWith(`${href}/`)

  if (isIconMode) {
    return (
      <SidebarGroup className="py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!isActive}
                tooltip={label}
                className={cn(
                  'rounded-md transition-all duration-150 hover:scale-[0.97]',
                  isActive
                    ? 'nav-pill-active'
                    : 'hover:bg-muted/60'
                )}
              >
                <Link href={href}>
                  <Icon className="size-4" />
                  <span className="text-[13px]">{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="p-0 border-b border-sidebar-border/60 last:border-b-0">
      <Link
        href={href}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold transition-all hover:scale-[0.97]',
          isActive
            ? 'text-foreground bg-muted/30'
            : 'text-foreground/80 hover:bg-muted/40'
        )}
      >
        <Icon className="size-3.5 opacity-60" />
        <span className="flex-1 text-left">{label}</span>
      </Link>
    </SidebarGroup>
  )
}

// ─── Smart Group ─────────────────────────────────────────
// Renders as a single link when only one item is visible to the user
// (e.g. consultor sees only "Visão geral" inside Financeiro), or as a
// CollapsibleGroup when 2+ items are visible (e.g. gestão sees Visão geral
// + Relatórios + Definições). Avoids the awkward "1-child collapsible"
// UI for users with limited permissions.
function SmartGroup({
  label,
  icon: Icon,
  items,
  pathname,
  hasPermission,
  pathPrefixes,
}: {
  label: string
  icon: any
  items: Array<{ title: string; icon: any; href: string; permission?: string }>
  pathname: string | null
  hasPermission: (p: any) => boolean
  pathPrefixes: string[]
}) {
  const visibleItems = items.filter(
    (item) => !item.permission || hasPermission(item.permission as any)
  )
  if (visibleItems.length === 0) return null

  if (visibleItems.length === 1) {
    const only = visibleItems[0]
    return (
      <SoloSidebarItem
        label={label}
        icon={Icon}
        href={only.href}
        pathname={pathname}
        hasPermission={() => true}
      />
    )
  }

  return (
    <CollapsibleGroup
      label={label}
      icon={Icon}
      items={items}
      pathname={pathname}
      hasPermission={hasPermission}
      pathPrefixes={pathPrefixes}
    />
  )
}

// ─── Collapsible Group ───────────────────────────────────

type SidebarGroupItem = {
  title: string
  icon: any
  href: string
  permission?: string
  alternates?: Array<{ title: string; icon: any; href: string }>
}

function CollapsibleGroup({
  label,
  icon: Icon,
  items,
  pathname,
  hasPermission,
  pathPrefixes,
  defaultOpenOverride,
}: {
  label: string
  icon: any
  items: SidebarGroupItem[]
  pathname: string | null
  hasPermission: (p: any) => boolean
  pathPrefixes: string[]
  defaultOpenOverride?: boolean
}) {
  const { state, isMobile } = useSidebar()
  const isIconMode = state === 'collapsed' && !isMobile

  const visibleItems = items.filter(
    (item) => !item.permission || hasPermission(item.permission as any)
  )
  if (visibleItems.length === 0) return null

  const isDefaultOpen = defaultOpenOverride || pathPrefixes.some((p) => pathname?.startsWith(p))
  const isSectionActive = visibleItems.some((item) => {
    if (item.href === '/dashboard') return pathname === '/dashboard'
    return pathname === item.href || pathname?.startsWith(`${item.href}/`)
  })

  if (isIconMode) {
    return (
      <SidebarGroup className="py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <HoverGroupDropdown
                label={label}
                icon={Icon}
                isSectionActive={!!isSectionActive}
                items={visibleItems}
                pathname={pathname}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="p-0">
      <Collapsible
        defaultOpen={isDefaultOpen}
        className={cn(
          'group/collapsible transition-all duration-200',
          // Closed: flush section, divided from the next group.
          'data-[state=closed]:border-b data-[state=closed]:border-sidebar-border/60',
          // Open: detaches into its own elevated card (the "3 cards" effect).
          'data-[state=open]:my-2 data-[state=open]:mx-1.5 data-[state=open]:overflow-hidden data-[state=open]:rounded-xl data-[state=open]:bg-card data-[state=open]:shadow-lg data-[state=open]:ring-1 data-[state=open]:ring-border/60'
        )}
      >
        <CollapsibleTrigger className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold transition-all hover:scale-[0.97]',
          isSectionActive
            ? 'text-foreground bg-muted/30'
            : 'text-foreground/80 hover:bg-muted/40'
        )}>
          <Icon className="size-3.5 opacity-60" />
          <span className="flex-1 text-left">{label}</span>
          <ChevronRight className="size-3.5 opacity-40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent className="px-1.5 pb-2">
            <SidebarMenu className="gap-0.5">
              {(() => {
                const activeHref = getActiveHref(pathname, visibleItems)
                return visibleItems.map((item) => {
                  const isActive = activeHref === item.href
                  const hasAlternates = !!item.alternates && item.alternates.length > 0

                  return (
                    <SidebarMenuItem key={item.href} className="relative">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          'rounded-md transition-all duration-150 hover:scale-[0.97]',
                          isActive
                            ? 'nav-pill-active'
                            : 'hover:bg-muted/60',
                          hasAlternates && 'pr-8',
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span className="text-[13px]">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {hasAlternates && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Mais opções para ${item.title}`}
                              className={cn(
                                'absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md inline-flex items-center justify-center transition-colors',
                                isActive
                                  ? 'text-white/70 hover:text-white hover:bg-white/10 dark:text-neutral-900/70 dark:hover:text-neutral-900 dark:hover:bg-neutral-900/10'
                                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
                              )}
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="right"
                            align="start"
                            sideOffset={6}
                            className="w-48 p-1"
                          >
                            {item.alternates!.map((alt) => {
                              const AltIcon = alt.icon
                              const altActive = pathname === alt.href || pathname?.startsWith(`${alt.href}/`)
                              return (
                                <Link
                                  key={alt.href}
                                  href={alt.href}
                                  className={cn(
                                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors',
                                    altActive
                                      ? 'bg-muted text-foreground'
                                      : 'text-foreground/80 hover:bg-muted/60',
                                  )}
                                >
                                  <AltIcon className="size-4" />
                                  <span>{alt.title}</span>
                                </Link>
                              )
                            })}
                          </PopoverContent>
                        </Popover>
                      )}
                    </SidebarMenuItem>
                  )
                })
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

// ─── Component ───────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { hasPermission, isBroker } = usePermissions()
  const { theme, setTheme } = useTheme()
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar()
  const sidebarIconMode = sidebarState === 'collapsed' && !sidebarIsMobile
  const [mounted, setMounted] = useState(false)

  // Esconde do sidebar items marcados com `managementOnly` quando o
  // utilizador não pertence aos papéis de gestão (ver MANAGEMENT_ROLES).
  // A permissão da rota (e.g. `processes`) não chega — Consultor TEM
  // `processes` para tarefas próprias mas não deve ver o índice global.
  const isManagement = isManagementRole(user?.role_names ?? [])
  const filterMgmt = <T extends { managementOnly?: boolean }>(items: T[]) =>
    isManagement ? items : items.filter((i) => !i.managementOnly)

  useEffect(() => { setMounted(true) }, [])

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Sessão terminada com sucesso')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Erro ao terminar sessão:', error)
      toast.error('Erro ao terminar sessão')
    }
  }

  const userInitials = user?.commercial_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* ─── Header ─── */}
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="rounded-xl">
              <Link href="/dashboard">
                <div
                  className="flex aspect-square size-8 items-center justify-center rounded-xl text-[color:var(--sidebar-brand-fg)] shadow-[0_4px_12px_-4px_color-mix(in_oklch,var(--sidebar-brand)_70%,transparent)] ring-1 ring-white/15"
                  style={{ background: 'linear-gradient(140deg, var(--sidebar-brand), var(--sidebar-brand-strong))' }}
                >
                  <Infinity className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-sm tracking-tight">Infinity</span>
                  <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                    ERP Imobiliária
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ─── Content ─── */}
      <SidebarContent className="gap-0">
        {/* All nav groups live inside ONE unified card, separated by dividers.
            In icon mode the card styling is dropped (groups render as icons). */}
        <div className={cn('my-1', !sidebarIconMode && 'glass-card rounded-2xl mx-2')}>
        {/* 1. O Meu Espaço */}
        <CollapsibleGroup
          label="O Meu Espaço"
          icon={LayoutDashboard}
          items={meuEspacoItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/calendario', '/dashboard/objetivos']}
          defaultOpenOverride={pathname === '/dashboard'}
        />

        {/* 2. Comunicação */}
        <CollapsibleGroup
          label="Comunicação"
          icon={MessageCircle}
          items={comunicacaoItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/whatsapp', '/dashboard/email']}
        />

        {/* 4. CRM */}
        <CollapsibleGroup
          label="CRM"
          icon={ContactRound}
          items={filterMgmt(crmItems)}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/crm', '/dashboard/leads', '/dashboard/acompanhamentos']}
        />

        {/* 5. Negócio */}
        <CollapsibleGroup
          label="Negócio"
          icon={Briefcase}
          items={filterMgmt(negocioItems)}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/imoveis', '/dashboard/processos', '/dashboard/objetivos', '/dashboard/negocios']}
        />

        {/* 6. Financeiro — single entry for consultor (collapses to one link),
              group with admin sub-items for gestão. */}
        <SmartGroup
          label="Financeiro"
          icon={Euro}
          items={financeiroItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/financeiro']}
        />

        {/* Infinity — moved below Financeiro */}
        <CollapsibleGroup
          label="Infinity"
          icon={Infinity}
          items={infinityItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/consultores', '/dashboard/parceiros', '/dashboard/formacoes', '/dashboard/acessos']}
        />

        {/* 7. Marketing — antigo "Infinity Store", agora agrupa Documentos +
              Store + Catálogo + Encomendas. O grupo aparece sempre que pelo
              menos um item for visível (CollapsibleGroup esconde-se quando
              `visibleItems.length === 0`); cada item gere o seu próprio gate.
              O conteúdo criativo (analytics, redes sociais, ads, recursos)
              vive em "Estúdio". */}
        <CollapsibleGroup
          label="Marketing"
          icon={Megaphone}
          items={filterMgmt(marketingItems)}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/marketing/loja', '/dashboard/encomendas', '/dashboard/documentos']}
        />

        {/* 10. Recrutamento */}
        {hasPermission('recruitment' as any) && (
          <CollapsibleGroup
            label="Recrutamento"
            icon={UserPlus}
            items={recrutamentoItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/recrutamento']}
          />
        )}

        {/* 12. Estúdio — produção criativa e promoção (antigo grupo "Marketing"):
              Analytics + Campanhas + Redes Sociais + Ads + Recursos.
              Escondido para o consultor — gate isManagement combinado com
              `marketing` perm. */}
        {isManagement && hasPermission('marketing' as any) && (
          <CollapsibleGroup
            label="Estúdio"
            icon={Palette}
            items={estudioItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/meta-ads', '/dashboard/instagram', '/dashboard/marketing/redes-sociais', '/dashboard/marketing/recursos']}
          />
        )}

        {/* 13. Tech */}
        {hasPermission('settings' as any) && (
          <CollapsibleGroup
            label="Tech"
            icon={Cpu}
            items={[...techItems, ...automationItems]}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/tech', '/dashboard/automacao']}
          />
        )}

        {/* 14. Crédito */}
        {hasPermission('credit' as any) && (
          <CollapsibleGroup
            label="Crédito"
            icon={Landmark}
            items={creditoItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/credito']}
          />
        )}

        {/* Definições */}
        <SidebarGroup className="p-0 border-b border-sidebar-border/60 last:border-b-0 group-data-[collapsible=icon]:border-b-0">
          <SidebarGroupContent className="p-1.5">
            <SidebarMenu className="gap-0.5">
              {bottomItems.filter((item) => hasPermission(item.permission as any)).map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        'rounded-md transition-all duration-150 hover:scale-[0.97]',
                        isActive
                          ? 'nav-pill-active'
                          : 'hover:bg-muted/60'
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span className="text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </div>
      </SidebarContent>

      {/* ─── Footer ─── */}
      <SidebarFooter className="pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="rounded-xl data-[state=open]:bg-muted/60"
                  >
                    <Avatar className="h-8 w-8 rounded-xl">
                      {user?.profile_photo_url && <AvatarImage src={user.profile_photo_url} alt={user?.commercial_name || ''} />}
                      <AvatarFallback className="rounded-xl bg-neutral-900 text-white text-xs font-bold dark:bg-white dark:text-neutral-900">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-[13px]">
                        {user?.commercial_name || 'Utilizador'}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground/60">
                        {user?.professional_email || ''}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto size-4 opacity-40" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl border-border/40 bg-card/80 backdrop-blur-xl shadow-lg"
                  side="top"
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-3 py-3 text-left text-sm">
                      <Avatar className="h-9 w-9 rounded-xl">
                        {user?.profile_photo_url && <AvatarImage src={user.profile_photo_url} alt={user?.commercial_name || ''} />}
                        <AvatarFallback className="rounded-xl bg-neutral-900 text-white text-xs font-bold dark:bg-white dark:text-neutral-900">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.commercial_name || 'Utilizador'}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground/60">
                          {user?.professional_email || ''}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <div className="px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Tema</span>
                    <div className="mt-1.5 flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/20">
                      {[
                        { value: 'light', icon: Sun, label: 'Claro' },
                        { value: 'dark', icon: Moon, label: 'Escuro' },
                        { value: 'system', icon: Monitor, label: 'Auto' },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTheme(t.value)}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-medium transition-all',
                            theme === t.value
                              ? 'nav-pill-active'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <t.icon className="h-3 w-3" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <DropdownMenuItem asChild className="rounded-xl mx-1">
                    <Link href="/dashboard/perfil">
                      <UserCircle className="size-4" />
                      Meu Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="rounded-xl mx-1 mb-1 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                  >
                    <LogOut className="size-4" />
                    Terminar Sessão
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" className="rounded-xl">
                <Avatar className="h-8 w-8 rounded-xl">
                  <AvatarFallback className="rounded-xl bg-muted">U</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-[13px]">Utilizador</span>
                  <span className="truncate text-[10px] text-muted-foreground/60">&nbsp;</span>
                </div>
                <ChevronDown className="ml-auto size-4 opacity-40" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
