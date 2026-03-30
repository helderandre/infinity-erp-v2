'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Users, FileText, LayoutDashboard, Settings, Clock,
  UserCircle, Euro, Megaphone, FileStack, CalendarDays,
  LogOut, ChevronDown, Sun, Moon, Monitor, ChevronRight,
  Zap, Mail, FileCode2, Workflow, Braces, Bot,
  MessageCircle, MessageSquareText, Instagram, BarChart3,
  Plug, Store, ClipboardList, Blocks, UserPlus, Target,
  Landmark, GraduationCap, Briefcase, TrendingUp,
  Wallet, Handshake, UserCheck, ContactRound, Kanban, Package, Boxes, Truck, Shield,
  CheckSquare, Cpu, Infinity, KeyRound,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useTheme } from 'next-themes'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
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
  { title: 'WhatsApp', icon: MessageCircle, href: '/dashboard/whatsapp', permission: 'dashboard' },
  { title: 'Email', icon: Mail, href: '/dashboard/email', permission: 'dashboard' },
  { title: 'Fluxos', icon: Workflow, href: '/dashboard/automacao/fluxos', permission: 'dashboard' },
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
  { title: 'Pipeline', icon: Kanban, href: '/dashboard/crm', permission: 'leads' },
  { title: 'Leads', icon: Zap, href: '/dashboard/lead-entries', permission: 'leads' },
  { title: 'Contactos', icon: Users, href: '/dashboard/leads', permission: 'leads' },
  { title: 'Acompanhamentos', icon: UserCheck, href: '/dashboard/acompanhamentos', permission: 'leads' },
]

export const gestaoLeadsItems = [
  { title: 'Gestora de Leads', icon: Shield, href: '/dashboard/crm/gestora', permission: 'pipeline' },
  { title: 'Analytics', icon: BarChart3, href: '/dashboard/crm/analytics', permission: 'pipeline' },
  { title: 'Campanhas', icon: Megaphone, href: '/dashboard/crm/campanhas', permission: 'pipeline' },
  { title: 'Regras de Atribuição', icon: Target, href: '/dashboard/crm/regras', permission: 'pipeline' },
  { title: 'Config. SLA', icon: Clock, href: '/dashboard/crm/sla', permission: 'pipeline' },
]

export const negocioItems = [
  { title: 'Processos', icon: FileStack, href: '/dashboard/processos', permission: 'processes' },
  { title: 'Imóveis', icon: Building2, href: '/dashboard/imoveis', permission: 'properties' },
]

export const infinityItems = [
  { title: 'Consultores', icon: Users, href: '/dashboard/consultores', permission: 'consultants' },
  { title: 'Parceiros', icon: Handshake, href: '/dashboard/parceiros', permission: 'consultants' },
  { title: 'Formações', icon: GraduationCap, href: '/dashboard/formacoes', permission: 'training' },
  { title: 'Acessos', icon: KeyRound, href: '/dashboard/acessos', permission: 'dashboard' },
]

export const financeiroItems = [
  { title: 'Dashboard', icon: TrendingUp, href: '/dashboard/comissoes/dashboard', permission: 'commissions' },
  { title: 'Conta Corrente', icon: Wallet, href: '/dashboard/comissoes/conta-corrente', permission: 'commissions' },
  { title: 'Comissões', icon: Euro, href: '/dashboard/comissoes', permission: 'commissions' },
  { title: 'Despesas Empresa', icon: Landmark, href: '/dashboard/comissoes/gestao-empresa', permission: 'commissions' },
  { title: 'Mapa de Gestão', icon: BarChart3, href: '/dashboard/comissoes/mapa-gestao', permission: 'commissions' },
  { title: 'Relatórios', icon: Briefcase, href: '/dashboard/comissoes/relatorios', permission: 'commissions' },
  { title: 'IMPIC', icon: ClipboardList, href: '/dashboard/comissoes/compliance', permission: 'commissions' },
]

export const recrutamentoItems = [
  { title: 'Candidatos', icon: Users, href: '/dashboard/recrutamento' },
  { title: 'Integração', icon: FileText, href: '/dashboard/recrutamento/formulario' },
]

export const lojaItems = [
  { title: 'Infinity Store', icon: Store, href: '/dashboard/marketing/loja' },
  { title: 'Catálogo', icon: Boxes, href: '/dashboard/encomendas/catalogo' },
  { title: 'Encomendas', icon: Package, href: '/dashboard/encomendas' },
  { title: 'Fornecedores', icon: Truck, href: '/dashboard/parceiros?tab=fornecedores' },
]

export const digitalItems = [
  { title: 'Redes Sociais', icon: UserPlus, href: '/dashboard/marketing/redes-sociais' },
  { title: 'Meta Ads', icon: BarChart3, href: '/dashboard/meta-ads' },
  { title: 'Instagram', icon: Instagram, href: '/dashboard/instagram' },
]

export const automationItems = [
  { title: 'Dashboard', icon: Zap, href: '/dashboard/automacao' },
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

export const techItems = [
  { title: 'Pipeline', icon: Cpu, href: '/dashboard/tech' },
]

export const menuItems = [
  ...meuEspacoItems, ...comunicacaoItems, ...negocioItems, ...infinityItems,
  ...financeiroItems, ...creditoItems, ...lojaItems,
  ...digitalItems, ...bottomItems,
]

// ─── Collapsible Group ───────────────────────────────────

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
    <SidebarGroup className="py-1">
      <Collapsible defaultOpen={isDefaultOpen} className="group/collapsible">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 hover:text-muted-foreground transition-colors">
            <Icon className="size-3.5 opacity-60" />
            {label}
            <ChevronRight className="ml-auto size-3.5 opacity-40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="mt-0.5">
            <SidebarMenu className="gap-0.5 px-1">
              {visibleItems.map((item) => {
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
                      className={cn(
                        'rounded-xl transition-all duration-150',
                        isActive
                          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                          : 'hover:bg-muted/60 hover:backdrop-blur-sm'
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
                <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Infinity className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-sm">Infinity</span>
                  <span className="text-[10px] text-muted-foreground/60 font-medium">
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
          pathPrefixes={['/dashboard/whatsapp', '/dashboard/email', '/dashboard/automacao/fluxos']}
        />

        {/* 3. CRM */}
        <CollapsibleGroup
          label="CRM"
          icon={ContactRound}
          items={crmItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/crm', '/dashboard/leads', '/dashboard/lead-entries', '/dashboard/acompanhamentos']}
        />

        {/* 4. Negócio */}
        <CollapsibleGroup
          label="Negócio"
          icon={Briefcase}
          items={negocioItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/imoveis', '/dashboard/processos', '/dashboard/objetivos']}
        />

        {/* 5. Infinity */}
        <CollapsibleGroup
          label="Infinity"
          icon={Infinity}
          items={infinityItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/consultores', '/dashboard/parceiros', '/dashboard/formacoes', '/dashboard/acessos']}
        />

        {/* 6. Financeiro */}
        <CollapsibleGroup
          label="Financeiro"
          icon={Euro}
          items={financeiroItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/comissoes']}
        />

        {/* 7. Infinity Store */}
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

        {/* 8. Automações */}
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

        {/* 9. Builder */}
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

        {/* 11. Gestão de Leads */}
        <CollapsibleGroup
          label="Gestão de Leads"
          icon={Shield}
          items={gestaoLeadsItems}
          pathname={pathname}
          hasPermission={hasPermission}
          pathPrefixes={['/dashboard/crm/gestora', '/dashboard/crm/analytics', '/dashboard/crm/campanhas', '/dashboard/crm/regras', '/dashboard/crm/sla']}
        />

        {/* 12. Digital */}
        {hasPermission('marketing' as any) && (
          <CollapsibleGroup
            label="Digital"
            icon={Megaphone}
            items={digitalItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/meta-ads', '/dashboard/instagram', '/dashboard/marketing/redes-sociais']}
          />
        )}

        {/* 13. Tech */}
        {hasPermission('settings' as any) && (
          <CollapsibleGroup
            label="Tech"
            icon={Cpu}
            items={techItems}
            pathname={pathname}
            hasPermission={() => true}
            pathPrefixes={['/dashboard/tech']}
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
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-1">
              {bottomItems.filter((item) => hasPermission(item.permission as any)).map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        'rounded-xl transition-all duration-150',
                        isActive
                          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                          : 'hover:bg-muted/60 hover:backdrop-blur-sm'
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
                              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
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
