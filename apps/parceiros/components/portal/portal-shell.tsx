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
  Trash2,
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
  { href: '/pedidos-eliminacao', label: 'Eliminações', icon: Trash2 },
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
      {/* ===== Desktop side bar (mirrors the main app layout) ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 p-3 md:block">
        <div className="flex h-full flex-col rounded-3xl border border-black/5 bg-white/70 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
          {/* Brand */}
          <Link href="/leads" className="flex items-center gap-2.5 px-4 pb-3 pt-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <Image src="/logo.png" alt="Infinity" width={26} height={26} className="rounded-md" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight text-neutral-900">Infinity</span>
              <span className="text-[10px] font-medium tracking-wide text-neutral-500">Parceiros</span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-900/5 hover:text-neutral-900',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer actions */}
          <div className="flex items-center gap-1 border-t border-black/5 px-3 py-3">
            <NotificationsButton openUp />
            <PartnerQuickActions />
            <div className="ml-auto">
              <ProfileMenu openUp user={user} onSignedOut={() => router.replace('/login')} />
            </div>
          </div>
        </div>
      </aside>

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
      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <CrmProviders>{children}</CrmProviders>
        </main>
      </div>

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
