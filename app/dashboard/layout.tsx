'use client'

import dynamic from 'next/dynamic'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BreadcrumbOverrideProvider } from '@/hooks/use-breadcrumb-overrides'

const SearchCommand = dynamic(
  () => import('@/components/layout/search-command').then((m) => m.SearchCommand),
  { ssr: false }
)
const QuickActions = dynamic(
  () => import('@/components/layout/quick-actions').then((m) => m.QuickActions),
  { ssr: false }
)
const NotificationPopover = dynamic(
  () => import('@/components/notifications/notification-popover').then((m) => m.NotificationPopover),
  { ssr: false }
)
const GoalDailyPopup = dynamic(
  () => import('@/components/goals/goal-daily-popup').then((m) => m.GoalDailyPopup),
  { ssr: false }
)

/** Rotas que usam layout full-bleed (altura fixa 100vh, sem padding no main) */
const FULL_BLEED_ROUTES = [
  '/dashboard/automacao/fluxos/editor',
  '/dashboard/automacao/templates-wpp/editor',
  '/dashboard/templates-email/',
  '/dashboard/templates-documentos/',
  '/dashboard/processos/templates/',  // novo + [id]/editar
  '/dashboard/email',
  '/dashboard/whatsapp',
]

/** Rotas que usam sidebar interna (sem padding esquerdo, altura flex) */
const SIDEBAR_PAGE_ROUTES = [
  '/dashboard/processos',
] as const

/** Rotas que usam layout com padding reduzido (p-2) para conteúdo edge-to-edge */
const COMPACT_PADDING_ROUTES = [
  '/dashboard/marketing/loja',
  '/dashboard/marketing/gestao',
  '/dashboard/marketing/redes-sociais',
] as const

/** Rotas dentro de SIDEBAR_PAGE_ROUTES que devem usar o layout padrão (com padding) */
const SIDEBAR_PAGE_EXCEPTIONS = [
  '/dashboard/processos/templates',
] as const

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname?.startsWith(r))
    || /^\/dashboard\/formacoes\/cursos\/[^/]+\/licoes\/[^/]+$/.test(pathname ?? '')
  const isSidebarPage = SIDEBAR_PAGE_ROUTES.some((r) => pathname === r || pathname?.startsWith(r + '/'))
    && !SIDEBAR_PAGE_EXCEPTIONS.some((r) => pathname === r || pathname?.startsWith(r + '/'))
  const isCompactPadding = COMPACT_PADDING_ROUTES.some((r) => pathname === r || pathname?.startsWith(r + '/'))

  return (
    <BreadcrumbOverrideProvider>
      <SidebarProvider className={cn(isFullBleed && "!min-h-svh !max-h-svh overflow-hidden")}>
        <AppSidebar />
        <SidebarInset className={cn("min-w-0", isFullBleed && "overflow-hidden")}>
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
              "flex flex-1 flex-col overflow-hidden",
              isFullBleed
                ? "min-h-0"
                : isSidebarPage
                  ? "min-h-0"
                  : isCompactPadding
                    ? "p-2"
                    : "gap-4 p-4 md:gap-6 md:p-6"
            )}
          >
            {children}
          </main>
        </SidebarInset>
        <GoalDailyPopup />
      </SidebarProvider>
    </BreadcrumbOverrideProvider>
  )
}
