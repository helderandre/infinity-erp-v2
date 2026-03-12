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

export const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permission: 'dashboard',
  },
  {
    title: 'Imóveis',
    icon: Building2,
    href: '/dashboard/imoveis',
    permission: 'properties',
  },
  {
    title: 'Leads',
    icon: Zap,
    href: '/dashboard/leads',
    permission: 'leads',
  },
  {
    title: 'Processos',
    icon: FileStack,
    href: '/dashboard/processos',
    permission: 'processes',
  },
  {
    title: 'Documentos',
    icon: FileText,
    href: '/dashboard/documentos',
    permission: 'documents',
  },
  {
    title: 'Proprietários',
    icon: UserCircle,
    href: '/dashboard/proprietarios',
    permission: 'owners',
  },
  {
    title: 'Consultores',
    icon: Users,
    href: '/dashboard/consultores',
    permission: 'consultants',
  },
  {
    title: 'Equipas',
    icon: UsersRound,
    href: '/dashboard/equipas',
    permission: 'teams',
  },
  {
    title: 'Comissões',
    icon: Euro,
    href: '/dashboard/comissoes',
    permission: 'commissions',
  },
  {
    title: 'Definições',
    icon: Settings,
    href: '/dashboard/definicoes',
    permission: 'settings',
  },
]

export const builderItems = [
  {
    title: 'Template de Email',
    icon: Mail,
    href: '/dashboard/templates-email',
  },
  {
    title: 'Template de Processos',
    icon: Workflow,
    href: '/dashboard/processos/templates',
  },
  {
    title: 'Template de Documentos',
    icon: FileCode2,
    href: '/dashboard/templates-documentos',
  },
  {
    title: 'Variáveis de Template',
    icon: Braces,
    href: '/dashboard/templates-variaveis',
  },
]

export const marketingItems = [
  {
    title: 'Loja',
    icon: Store,
    href: '/dashboard/marketing/loja',
  },
  {
    title: 'Gestão',
    icon: ClipboardList,
    href: '/dashboard/marketing/gestao',
  },
  {
    title: 'Redes Sociais',
    icon: UserCog,
    href: '/dashboard/marketing/redes-sociais',
  },
]

export const metaItems = [
  {
    title: 'Meta Ads',
    icon: BarChart3,
    href: '/dashboard/meta-ads',
  },
  {
    title: 'Instagram',
    icon: Instagram,
    href: '/dashboard/instagram',
  },
  {
    title: 'Integrações Meta',
    icon: Plug,
    href: '/dashboard/definicoes/integracoes/meta',
  },
]

export const recrutamentoItems = [
  {
    title: 'Candidatos',
    icon: Users,
    href: '/dashboard/recrutamento',
  },
  {
    title: 'Formulário',
    icon: FileText,
    href: '/dashboard/recrutamento/formulario',
  },
]

export const automationItems = [
  {
    title: 'Dashboard',
    icon: Zap,
    href: '/dashboard/automacao',
  },
  {
    title: 'Fluxos',
    icon: Workflow,
    href: '/dashboard/automacao/fluxos',
  },
  {
    title: 'Execuções',
    icon: Braces,
    href: '/dashboard/automacao/execucoes',
  },
  {
    title: 'Instâncias WhatsApp',
    icon: MessageCircle,
    href: '/dashboard/automacao/instancias',
  },
  {
    title: 'Templates WhatsApp',
    icon: MessageSquareText,
    href: '/dashboard/automacao/templates-wpp',
  },
]

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

  const visibleMenuItems = menuItems.filter((item) =>
    hasPermission(item.permission as any)
  )

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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

        {hasPermission('recruitment' as any) && (
          <SidebarGroup>
            <Collapsible
              defaultOpen={
                pathname?.startsWith('/dashboard/recrutamento')
              }
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <UserPlus className="mr-1.5 size-3.5" />
                  Recrutamento
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recrutamentoItems.map((item) => {
                      const isActive = item.href === '/dashboard/recrutamento'
                        ? pathname === item.href || (pathname?.startsWith('/dashboard/recrutamento/') && !pathname?.startsWith('/dashboard/recrutamento/formulario'))
                        : pathname === item.href || pathname?.startsWith(`${item.href}/`)

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
        )}

        {hasPermission('marketing' as any) && (
          <SidebarGroup>
            <Collapsible
              defaultOpen={
                pathname?.startsWith('/dashboard/marketing')
              }
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <Megaphone className="mr-1.5 size-3.5" />
                  Marketing
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {marketingItems.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
        )}

        {hasPermission('marketing' as any) && (
          <SidebarGroup>
            <Collapsible
              defaultOpen={
                pathname?.startsWith('/dashboard/meta-ads') ||
                pathname?.startsWith('/dashboard/instagram') ||
                pathname?.startsWith('/dashboard/definicoes/integracoes/meta')
              }
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <Instagram className="mr-1.5 size-3.5" />
                  Meta & Instagram
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {metaItems.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
        )}

        {hasPermission('settings' as any) && (
          <SidebarGroup>
            <Collapsible
              defaultOpen={
                pathname?.startsWith('/dashboard/automacao')
              }
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <Bot className="mr-1.5 size-3.5" />
                  Automações
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {automationItems.map((item) => {
                      const isActive = item.href === '/dashboard/automacao'
                        ? pathname === item.href
                        : pathname === item.href || pathname?.startsWith(`${item.href}/`)

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
        )}

        {hasPermission('settings' as any) && (
          <SidebarGroup>
            <Collapsible
              defaultOpen={
                pathname?.startsWith('/dashboard/templates-email') ||
                pathname?.startsWith('/dashboard/processos/templates') ||
                pathname?.startsWith('/dashboard/templates-documentos')
              }
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <Blocks className="mr-1.5 size-3.5" />
                  Builder
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {builderItems.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
        )}
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
