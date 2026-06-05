'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
} from 'lucide-react'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/recrutamento', icon: LayoutDashboard, exact: true },
  { label: 'Candidatos', href: '/dashboard/recrutamento/candidatos', icon: Users },
  { label: 'Calendário', href: '/dashboard/recrutamento/calendario', icon: CalendarDays },
]

export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Hide nav tabs on candidato detail pages and formulário (standalone)
  const hideNav =
    /^\/dashboard\/recrutamento\/[0-9a-f-]+$/.test(pathname) ||
    pathname.startsWith('/dashboard/recrutamento/formulario')

  return (
    <PermissionGuard module="recruitment">
      <div className="flex flex-col gap-0">
        {!hideNav && (
          <div className="px-4 sm:px-6 pt-4 pb-2 overflow-x-auto scrollbar-hide">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm w-fit">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                      isActive
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        {children}
      </div>
    </PermissionGuard>
  )
}
