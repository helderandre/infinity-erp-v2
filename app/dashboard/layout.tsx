'use client'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { SearchCommand } from '@/components/layout/search-command'
import { QuickActions } from '@/components/layout/quick-actions'
import { NotificationPopover } from '@/components/notifications/notification-popover'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Rotas que usam layout full-bleed (sem padding no main) */
const FULL_BLEED_ROUTES = [
  '/dashboard/automacao/fluxos/editor',
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname?.startsWith(r))

  return (
    <SidebarProvider className="!min-h-svh !max-h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex py-2 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <SearchCommand />
            <QuickActions />
            <NotificationPopover />
          </div>
        </header>
        <main
          className={cn(
            "flex flex-1 flex-col overflow-hidden min-h-0",
            isFullBleed ? "" : "gap-4 p-4 md:gap-6 md:p-6"
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
