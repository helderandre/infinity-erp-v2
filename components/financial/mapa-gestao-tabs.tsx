'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'mapa', label: 'Mapa de Gestão', href: '/dashboard/comissoes/mapa-gestao' },
  { key: 'comissoes', label: 'Comissões', href: '/dashboard/comissoes' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface MapaGestaoTabsProps {
  active: TabKey
}

export function MapaGestaoTabs({ active }: MapaGestaoTabsProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background border border-border/60 shadow-sm w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'inline-flex items-center justify-center h-8 px-4 rounded-full text-sm font-medium transition-all duration-200',
            active === tab.key
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
