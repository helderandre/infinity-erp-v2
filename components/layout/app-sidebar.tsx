'use client'

import {
  Building2,
  Home,
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
  Zap,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const menuItems = [
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
    title: 'Marketing',
    icon: Megaphone,
    href: '/dashboard/marketing',
    permission: 'marketing',
  },
  {
    title: 'Definições',
    icon: Settings,
    href: '/dashboard/definicoes',
    permission: 'settings',
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { hasPermission } = usePermissions()

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
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.role?.name} alt={user?.commercial_name} />
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
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut />
                  Terminar Sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
