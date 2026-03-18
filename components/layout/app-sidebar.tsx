'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  Users,
  FileText,
  LayoutDashboard,
  Settings,
  UserCircle,
  UsersRound,
  Euro,
  Megaphone,
  FileStack,
  CalendarDays,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Zap,
  Mail,
  FileCode2,
  Workflow,
  Braces,
  Bot,
  MessageCircle,
  MessageSquareText,
  Instagram,
  BarChart3,
  Plug,
  Store,
  ClipboardList,
  Blocks,
  UserCog,
  UserPlus,
  Target,
  Landmark,
  Package,
  GraduationCap,
  Briefcase,
  Boxes,
  TrendingUp,
  Wallet,
  MapPin,
  Handshake,
  UserCheck,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useTheme } from 'next-themes'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// ─── Solo items (always visible) ─────────────────────────

// ─── O Meu Espaço (always visible, no collapsible) ───────

export const meuEspacoItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'dashboard' },
  { title: 'WhatsApp', icon: MessageCircle, href: '/dashboard/whatsapp', permission: 'dashboard' },
  { title: 'Email', icon: Mail, href: '/dashboard/email', permission: 'dashboard' },
  { title: 'Calendário', icon: CalendarDays, href: '/dashboard/calendario', permission: 'calendar' },
  { title: 'Objetivos', icon: Target, href: '/dashboard/objetivos', permission: 'goals' },
  { title: 'Formações', icon: GraduationCap, href: '/dashboard/formacoes', permission: 'training' },
]

export const soloItems: { title: string; icon: any; href: string; permission: string }[] = []

export const creditoItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/credito' },
  { title: 'Processos', icon: FileStack, href: '/dashboard/credito/pedidos' },
  { title: 'Simulador', icon: TrendingUp, href: '/dashboard/credito/simulador' },
  { title: 'Bancos', icon: Building2, href: '/dashboard/credito/bancos' },
]

export const bottomItems = [
  {
    title: 'Definições',
    icon: Settings,
    href: '/dashboard/definicoes',
    permission: 'settings',
  },
]

// ─── Collapsible groups ──────────────────────────────────

export const negocioItems = [
  { title: 'Leads', icon: Zap, href: '/dashboard/leads', permission: 'leads' },
  { title: 'Acompanhamentos', icon: UserCheck, href: '/dashboard/acompanhamentos', permission: 'leads' },
  { title: 'Processos', icon: FileStack, href: '/dashboard/processos', permission: 'processes' },
  { title: 'Imóveis', icon: Building2, href: '/dashboard/imoveis', permission: 'properties' },
  { title: 'Proprietários', icon: UserCircle, href: '/dashboard/proprietarios', permission: 'owners' },
  { title: 'Documentos', icon: FileText, href: '/dashboard/documentos', permission: 'documents' },
]

export const pessoasItems = [
  { title: 'Consultores', icon: Users, href: '/dashboard/consultores', permission: 'consultants' },
  { title: 'Parceiros', icon: Handshake, href: '/dashboard/parceiros', permission: 'consultants' },
]

export const financeiroItems = [
  { title: 'Comissões', icon: Euro, href: '/dashboard/comissoes', permission: 'commissions' },
  { title: 'Conta Corrente', icon: Wallet, href: '/dashboard/comissoes/conta-corrente', permission: 'commissions' },
  { title: 'IMPIC', icon: ClipboardList, href: '/dashboard/comissoes/compliance', permission: 'commissions' },
  { title: 'Relatórios', icon: BarChart3, href: '/dashboard/comissoes/relatorios', permission: 'commissions' },
]

export const recrutamentoItems = [
  { title: 'Candidatos', icon: Users, href: '/dashboard/recrutamento' },
  { title: 'Formulário', icon: FileText, href: '/dashboard/recrutamento/formulario' },
]

export const lojaItems = [
  { title: 'Infinity Store', icon: Store, href: '/dashboard/marketing/loja' },
]

export const digitalItems = [
  { title: 'Redes Sociais', icon: UserCog, href: '/dashboard/marketing/redes-sociais' },
  { title: 'Meta Ads', icon: BarChart3, href: '/dashboard/meta-ads' },
  { title: 'Instagram', icon: Instagram, href: '/dashboard/instagram' },
  { title: 'Integrações', icon: Plug, href: '/dashboard/definicoes/integracoes/meta' },
]

export const automationItems = [
  { title: 'Dashboard', icon: Zap, href: '/dashboard/automacao' },
  { title: 'Fluxos', icon: Workflow, href: '/dashboard/automacao/fluxos' },
  { title: 'Execuções', icon: Braces, href: '/dashboard/automacao/execucoes' },
  { title: 'Instâncias WhatsApp', icon: MessageCircle, href: '/dashboard/automacao/instancias' },
  { title: 'Templates WhatsApp', icon: MessageSquareText, href: '/dashboard/automacao/templates-wpp' },
]

export const builderItems = [
  { title: 'Template de Email', icon: Mail, href: '/dashboard/templates-email' },
  { title: 'Template de Processos', icon: Workflow, href: '/dashboard/processos/templates' },
  { title: 'Template de Documentos', icon: FileCode2, href: '/dashboard/templates-documentos' },
  { title: 'Variáveis de Template', icon: Braces, href: '/dashboard/templates-variaveis' },
]

// ─── Backward compat: menuItems includes all items for other code that imports it
export const menuItems = [
  ...meuEspacoItems,
  ...negocioItems,
  ...pessoasItems,
  ...financeiroItems,
  ...creditoItems,
  ...lojaItems,
  ...digitalItems,
  ...bottomItems,
]

// ─── Helper to render a collapsible group ────────────────

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
  items: Array<{ title: string; icon: any; href: string; permission?: string }>
  pathname: string | null
  hasPermission: (p: any) => boolean
  pathPrefixes: string[]
  defaultOpenOverride?: boolean
}) {
  const visibleItems = items.filter(
    (item) => !item.permission || hasPermission(item.permission as any)
  )
  if (visibleItems.length === 0) return null

  const isDefaultOpen = defaultOpenOverride || pathPrefixes.some((p) => pathname?.startsWith(p))

  return (
    <SidebarGroup>
      <Collapsible defaultOpen={isDefaultOpen} className="group/collapsible">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center">
            <Icon className="mr-1.5 size-3.5" />
            {label}
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                // Exact match for index routes (e.g. /dashboard/credito)
                // to avoid them staying active on sub-routes
                const hasSubItems = visibleItems.some(
                  (other) => other.href !== item.href && other.href.startsWith(`${item.href}/`)
                )
                const isActive = hasSubItems
                  ? pathname === item.href
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={!isActive ? 'rounded-lg border border-transparent hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:shadow-sm transition-all' : 'rounded-lg shadow-sm'}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
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
  const { hasPermission } = usePermissions()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">ERP Infinity</span>
                  <span className="text-xs text-muted-foreground">
                    Imobiliária
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* O Meu Espaço */}
        <CollapsibleGroup
          label="O Meu Espaço"
          icon={LayoutDashboard}
          items={meuEspacoItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/whatsapp', '/dashboard/email', '/dashboard/calendario', '/dashboard/objetivos', '/dashboard/formacoes']}
          defaultOpenOverride={pathname === '/dashboard'}
        />

        {/* Negócio */}
        <CollapsibleGroup
          label="Negócio"
          icon={Briefcase}
          items={negocioItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/imoveis', '/dashboard/leads', '/dashboard/processos', '/dashboard/documentos', '/dashboard/proprietarios', '/dashboard/objetivos']}
        />

        {/* Pessoas */}
        <CollapsibleGroup
          label="Pessoas"
          icon={Users}
          items={pessoasItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/consultores', '/dashboard/equipas', '/dashboard/formacoes']}
        />

        {/* Financeiro */}
        <CollapsibleGroup
          label="Financeiro"
          icon={Euro}
          items={financeiroItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/comissoes']}
        />

        {/* Crédito */}
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

        {/* Recrutamento */}
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

        {/* Infinity Store */}
        {hasPermission('marketing' as any) && (
          <CollapsibleGroup
            label="Infinity Store"
            icon={Store}
            items={lojaItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/marketing', '/dashboard/encomendas']}
          />
        )}

        {/* Digital */}
        {hasPermission('marketing' as any) && (
          <CollapsibleGroup
            label="Digital"
            icon={Megaphone}
            items={digitalItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/meta-ads', '/dashboard/instagram', '/dashboard/marketing/redes-sociais', '/dashboard/definicoes/integracoes/meta']}
          />
        )}

        {/* Automações */}
        {hasPermission('settings' as any) && (
          <CollapsibleGroup
            label="Automações"
            icon={Bot}
            items={automationItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/automacao']}
          />
        )}

        {/* Builder */}
        {hasPermission('settings' as any) && (
          <CollapsibleGroup
            label="Builder"
            icon={Blocks}
            items={builderItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/templates-email', '/dashboard/processos/templates', '/dashboard/templates-documentos', '/dashboard/templates-variaveis']}
          />
        )}

        {/* Definições (solo) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.filter((item) => hasPermission(item.permission as any)).map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={!isActive ? 'rounded-lg border border-transparent hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:shadow-sm transition-all' : 'rounded-lg shadow-sm'}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.commercial_name || 'Utilizador'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.professional_email || ''}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.commercial_name || 'Utilizador'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.professional_email || ''}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Tema</span>
                    <div className="mt-1 flex gap-1">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${theme === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                      >
                        <Sun className="h-3.5 w-3.5" />
                        Claro
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                      >
                        <Moon className="h-3.5 w-3.5" />
                        Escuro
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${theme === 'system' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Auto
                      </button>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut />
                    Terminar Sessão
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Utilizador</span>
                  <span className="truncate text-xs text-muted-foreground">&nbsp;</span>
                </div>
                <ChevronDown className="ml-auto size-4" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
