'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  Users,
  Briefcase,
  Megaphone,
  Wallet,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@infinity/ui/cn'
import { ProfileMenu } from './profile-menu'
import { NotificationsButton } from './notifications-button'
import { PartnerQuickActions } from './partner-quick-actions'
import { CrmProviders } from './crm-providers'

export type NavItem = { href: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/oportunidades', label: 'Oportunidades', icon: Briefcase },
  { href: '/meta', label: 'Meta', icon: Megaphone },
  { href: '/pagamentos', label: 'Pagamentos', icon: Wallet },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function PortalShell({
  user,
  children,
}: {
  user: { email: string | null; name: string | null; avatarUrl: string | null }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f4f4f5]">
      {/* ===== Desktop top bar ===== */}
      <header className="sticky top-0 z-40 hidden md:block">
        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          {/* Left: logo */}
          <Link href="/leads" className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur-xl">
              <Image src="/logo.png" alt="Infinity" width={28} height={28} className="rounded-md" />
            </span>
          </Link>

          {/* Center: glass pill navbar — absolutely centered on the page,
              independent of the differing logo / actions widths. */}
          <nav className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-neutral-900/70 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-neutral-900/60">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  className={cn(
                    'inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200',
                    active
                      ? 'gap-2 bg-white px-4 py-2 text-neutral-900 shadow-sm'
                      : 'h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px]', active && 'h-4 w-4')} />
                  {active && <span>{label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Right: glass actions pill */}
          <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white/70 p-1.5 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
            <NotificationsButton />
            <PartnerQuickActions />
            <ProfileMenu user={user} onSignedOut={() => router.replace('/login')} />
          </div>
        </div>
      </header>

      {/* ===== Mobile top bar ===== */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/5 bg-white/70 px-4 backdrop-blur-xl md:hidden">
        <Link href="/leads" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Infinity" width={30} height={30} className="rounded-lg" />
          <span className="text-sm font-semibold text-neutral-900">Parceiros</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationsButton />
          <PartnerQuickActions />
          <ProfileMenu user={user} onSignedOut={() => router.replace('/login')} />
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-6 md:pb-10">
        <CrmProviders>{children}</CrmProviders>
      </main>

      {/* ===== Mobile bottom nav — glass pill (mirrors main app) ===== */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <nav className="pointer-events-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-neutral-900/75 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-white px-4 text-neutral-900 shadow-sm'
                    : 'w-11 text-white/75 hover:text-white active:bg-white/10',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn(active ? 'inline' : 'hidden')}>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
