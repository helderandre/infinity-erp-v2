'use client'

/**
 * Navegação por tabs da secção Encomendas. Torna as páginas de gestão
 * (requisições, encomendas a fornecedor, fornecedores, stock, relatórios)
 * alcançáveis — antes só existiam por URL directo.
 *
 * Consultores vêem apenas "Minhas"; gestão vê o conjunto completo.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'

const TABS: { href: string; label: string; managementOnly?: boolean }[] = [
  { href: '/dashboard/encomendas/minhas', label: 'Minhas' },
  { href: '/dashboard/encomendas/gestao', label: 'Requisições', managementOnly: true },
  { href: '/dashboard/encomendas/encomendas-fornecedor', label: 'Encomendas a Fornecedor', managementOnly: true },
  { href: '/dashboard/encomendas/fornecedores', label: 'Fornecedores', managementOnly: true },
  { href: '/dashboard/encomendas/stock', label: 'Stock', managementOnly: true },
  { href: '/dashboard/encomendas/relatorios', label: 'Relatórios', managementOnly: true },
]

export function EncomendasTabsNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const isManagement = isManagementRole(user?.role_names ?? [])

  const tabs = TABS.filter((t) => isManagement || !t.managementOnly)

  // Consultor só com "Minhas" — nav redundante, esconde.
  if (tabs.length <= 1) return null

  return (
    <nav className="bg-background/50 supports-[backdrop-filter]:bg-background/40 mb-4 inline-flex max-w-full overflow-x-auto rounded-full border border-border/40 p-1 backdrop-blur-xl">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
