'use client'

import dynamic from 'next/dynamic'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Separator } from '@/components/ui/separator'
import { Mic } from 'lucide-react'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { BreadcrumbOverrideProvider } from '@/hooks/use-breadcrumb-overrides'
import { EmailComposerProvider } from '@/hooks/use-email-composer'

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
const PushBanner = dynamic(
  () => import('@/components/notifications/push-banner').then((m) => m.PushBanner),
  { ssr: false }
)
const MobileBottomNav = dynamic(
  () => import('@/components/layout/mobile-bottom-nav').then((m) => m.MobileBottomNav),
  { ssr: false }
)
const AiAgentChat = dynamic(
  () => import('@/components/shared/ai-agent-chat').then((m) => m.AiAgentChat),
  { ssr: false }
)
const AiVoiceAssistant = dynamic(
  () => import('@/components/shared/ai-voice-assistant').then((m) => m.AiVoiceAssistant),
  { ssr: false }
)
const AiBatchNotification = dynamic(
  () => import('@/components/shared/ai-batch-notification').then((m) => m.AiBatchNotification),
  { ssr: false }
)
const EmailComposerPopup = dynamic(
  () => import('@/components/email/composer/composer-popup').then((m) => m.EmailComposerPopup),
  { ssr: false }
)

/** Rotas que usam layout full-bleed (altura fixa 100vh, sem padding no main) */
const FULL_BLEED_ROUTES = [
  '/dashboard/automacao/fluxos/editor',
  '/dashboard/automacao/templates-wpp/editor',
  '/dashboard/templates-email/',
  '/dashboard/templates-documentos/',
  '/dashboard/processos/templates/',  // novo + [id]/editar
  '/dashboard/comunicacao/chat',
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
  const mainRef = useRef<HTMLElement>(null)

  // Scroll main container to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  // Lock body scroll/bounce on app-like routes (email, whatsapp, chat)
  const isAppLike =
    pathname?.startsWith('/dashboard/email') ||
    pathname?.startsWith('/dashboard/whatsapp') ||
    pathname?.startsWith('/dashboard/comunicacao/chat')

  useEffect(() => {
    if (!isAppLike) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
      document.documentElement.style.overscrollBehavior = ''
    }
  }, [isAppLike])

  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname?.startsWith(r))
    || /^\/dashboard\/formacoes\/cursos\/[^/]+\/licoes\/[^/]+$/.test(pathname ?? '')
  const isSidebarPage = SIDEBAR_PAGE_ROUTES.some((r) => pathname === r || pathname?.startsWith(r + '/'))
    && !SIDEBAR_PAGE_EXCEPTIONS.some((r) => pathname === r || pathname?.startsWith(r + '/'))
  const isCompactPadding = COMPACT_PADDING_ROUTES.some((r) => pathname === r || pathname?.startsWith(r + '/'))
  // Routes where breadcrumbs should be hidden on mobile (still visible on lg+)
  const hideBreadcrumbsOnMobile = /^\/dashboard\/imoveis\/[^/]+$/.test(pathname ?? '')

  return (
    <BreadcrumbOverrideProvider>
      <EmailComposerProvider>
      <SidebarProvider className={cn(isFullBleed && "!min-h-svh !max-h-svh overflow-hidden")}>
        <AppSidebar />
        <SidebarInset className={cn("min-w-0", isFullBleed && "overflow-hidden")}>
          <header className="sticky top-0 z-40 flex py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className={cn('mr-2 h-6', hideBreadcrumbsOnMobile && 'hidden lg:block')}
            />
            <div className={cn(hideBreadcrumbsOnMobile && 'hidden lg:contents')}>
              <Breadcrumbs />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block">
                <SearchCommand />
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-voice-assistant'))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 hover:bg-zinc-900/85 text-white backdrop-blur-md border border-white/10 transition-colors"
                title="Assistente de voz"
              >
                <Mic className="size-4" />
                <span className="sr-only">Assistente de voz</span>
              </button>
              <AiAgentChat />
              <QuickActions />
              <NotificationPopover />
            </div>
          </header>
          <main
            ref={mainRef}
            className={cn(
              "flex flex-1 flex-col overflow-x-hidden min-h-0",
              isFullBleed
                ? "overflow-hidden overscroll-none"
                : isSidebarPage
                  ? "overflow-y-auto"
                  : isCompactPadding
                    ? "p-2 overflow-y-auto"
                    : "gap-4 p-4 md:gap-6 md:p-6 overflow-y-auto"
            )}
          >
            <PushBanner />
            {children}
            {/* Spacer for mobile bottom nav */}
            <div className="h-16 sm:hidden shrink-0" />
          </main>
        </SidebarInset>
        <GoalDailyPopup />
        <MobileBottomNav />
        <AiBatchNotification />
        <AiVoiceAssistant />
      </SidebarProvider>
      <EmailComposerPopup />
      </EmailComposerProvider>
    </BreadcrumbOverrideProvider>
  )
}
