'use client'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { NotificationPopover } from '@/components/notifications/notification-popover'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex py-2 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationPopover />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 overflow-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
