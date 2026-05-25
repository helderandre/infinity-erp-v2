'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Leads', href: '/dashboard/analise-meta/leads' },
  { label: 'Formulários', href: '/dashboard/analise-meta/formularios' },
  { label: 'Campanhas', href: '/dashboard/analise-meta/campanhas' },
  { label: 'Anúncios', href: '/dashboard/analise-meta/ads' },
]

export function MetaTabsNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-muted/40 inline-flex rounded-full border p-1">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href
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
