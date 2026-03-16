'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Kanban,
  Users,
  CalendarDays,
  Bell,
  BarChart3,
  FileText,
  ClipboardList,
} from 'lucide-react'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/recrutamento', icon: LayoutDashboard, exact: true },
  { label: 'Pipeline', href: '/dashboard/recrutamento/pipeline', icon: Kanban },
  { label: 'Candidatos', href: '/dashboard/recrutamento/candidatos', icon: Users },
  { label: 'Calendario', href: '/dashboard/recrutamento/calendario', icon: CalendarDays },
  { label: 'Alertas', href: '/dashboard/recrutamento/alertas', icon: Bell },
  { label: 'Relatorios', href: '/dashboard/recrutamento/relatorios', icon: BarChart3 },
  { label: 'Templates', href: '/dashboard/recrutamento/templates', icon: FileText },
  { label: 'Formulario', href: '/dashboard/recrutamento/formulario', icon: ClipboardList },
]

export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <PermissionGuard module="recruitment">
      <div className="flex flex-col gap-0">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <nav className="flex items-center gap-1 overflow-x-auto px-6 py-2">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2 shrink-0"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </div>
        {children}
      </div>
    </PermissionGuard>
  )
}
