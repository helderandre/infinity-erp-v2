'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleDollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

// Top-level navigation for the Vista Empresa do Financeiro.
// Each tab is its own URL — keeps deep-links stable and lets each page
// be a server/client component as it needs.
//
// Substitui o antigo <MapaGestaoTabs> (que só tinha 2 entradas).

const TABS = [
  { key: 'resumo', label: 'Resumo', href: '/dashboard/financeiro/dashboard' },
  { key: 'mapa', label: 'Mapa de Gestão', href: '/dashboard/financeiro/mapa-gestao' },
] as const

export type EmpresaTabKey = (typeof TABS)[number]['key']

interface EmpresaTabsNavProps {
  /** Optional: override active key. By default it derives from pathname. */
  active?: EmpresaTabKey
  /** Hide the hero band when embedding in a page that already has one. */
  showHero?: boolean
}

export function EmpresaTabsNav({ active, showHero = false }: EmpresaTabsNavProps) {
  const pathname = usePathname() ?? ''
  const derived = TABS.find((t) =>
    pathname === t.href || pathname.startsWith(`${t.href}/`)
  )?.key
  const current = active ?? derived ?? 'resumo'

  return (
    <div className="space-y-4">
      {showHero && (
        <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
          <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign className="h-5 w-5 text-neutral-400" />
              <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
                Visão da empresa · Financeiro
              </p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Financeiro</h2>
            <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
              Comissões, conta corrente, despesas e desempenho por consultor.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                'inline-flex items-center justify-center h-8 px-4 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap',
                current === t.key
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
