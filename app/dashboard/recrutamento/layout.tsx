'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Kanban,
  Users,
  CalendarDays,
  Settings,
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
  { label: 'Calendário', href: '/dashboard/recrutamento/calendario', icon: CalendarDays },
  { label: 'Configuração', href: '/dashboard/recrutamento/configuracao', icon: Settings },
]

export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <PermissionGuard module="recruitment">
      <div className="flex flex-col gap-0">
        <div className="border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <nav className="flex items-center gap-1.5 overflow-x-auto px-6 py-2.5">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) && !item.exact

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`gap-2 shrink-0 rounded-full ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
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
