'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

// Funnel-centric nav: requests come first (the pipeline that precedes a live
// campaign), then campaigns (ads + forms live inside a campaign) and the leads
// inbox. Ad/form detail pages stay routable (linked from the funnel) but are
// no longer separate top-level tabs.
const TABS = [
  { label: 'Pedidos', href: '/dashboard/analise-meta/pedidos' },
  { label: 'Campanhas', href: '/dashboard/analise-meta/campanhas' },
  { label: 'Leads', href: '/dashboard/analise-meta/leads' },
]

export function MetaTabsNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-background/50 supports-[backdrop-filter]:bg-background/40 inline-flex rounded-full border border-border/40 p-1 backdrop-blur-xl">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
