'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'
import { useBreadcrumbOverrides } from '@/hooks/use-breadcrumb-overrides'
import {
  meuEspacoItems,
  negocioItems,
  pessoasItems,
  financeiroItems,
  creditoItems,
  recrutamentoItems,
  lojaItems,
  digitalItems,
  automationItems,
  builderItems,
  bottomItems,
} from '@/components/layout/app-sidebar'

// Build a map from href → sidebar title for all nav items.
// This is the source of truth for what each page is called.
const navMap = new Map<string, string>()
;[
  ...meuEspacoItems,
  ...negocioItems,
  ...pessoasItems,
  ...financeiroItems,
  ...creditoItems,
  ...recrutamentoItems,
  ...lojaItems,
  ...digitalItems,
  ...automationItems,
  ...builderItems,
  ...bottomItems,
].forEach((item) => {
  navMap.set(item.href, item.title)
})

// Fallback translations for segments that are NOT nav items
// (sub-pages like /novo, /editar, action pages, etc.)
const segmentTranslations: Record<string, string> = {
  novo: 'Novo',
  editar: 'Editar',
  negocios: 'Negócios',
  angariacao: 'Angariação',
  templates: 'Templates',
  editor: 'Editor',
  formulario: 'Formulário',
  pedidos: 'Pedidos',
  simulador: 'Simulador',
  bancos: 'Bancos',
  cursos: 'Cursos',
  licoes: 'Lições',
  gestao: 'Gestão',
  categorias: 'Categorias',
  certificados: 'Certificados',
  estatisticas: 'Estatísticas',
  percursos: 'Percursos',
  'meus-cursos': 'Meus Cursos',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const overrides = useBreadcrumbOverrides()

  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return null
  }

  // Don't show for auth routes
  if (pathname.startsWith('/login')) {
    return null
  }

  // Remove /dashboard prefix and UUIDs
  const rawSegments = pathname
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter(Boolean)
    .filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))

  if (rawSegments.length === 0) {
    return null
  }

  // Find the longest prefix that matches a nav item — that's the "primary page".
  // Everything after it are sub-pages.
  let matchLength = 0
  let matchTitle = ''

  for (let i = rawSegments.length; i >= 1; i--) {
    const candidateHref = '/dashboard/' + rawSegments.slice(0, i).join('/')
    const title = navMap.get(candidateHref)
    if (title) {
      matchLength = i
      matchTitle = title
      break
    }
  }

  // Build breadcrumb items
  const items: { label: string; href: string }[] = []

  if (matchLength > 0) {
    // The primary page from the nav
    items.push({
      label: matchTitle,
      href: '/dashboard/' + rawSegments.slice(0, matchLength).join('/'),
    })

    // Any sub-pages after the matched nav item
    for (let i = matchLength; i < rawSegments.length; i++) {
      const seg = rawSegments[i]
      items.push({
        label: overrides[seg] || segmentTranslations[seg] || seg,
        href: '/dashboard/' + rawSegments.slice(0, i + 1).join('/'),
      })
    }
  } else {
    // No nav match — fall back to showing each segment
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i]
      items.push({
        label: overrides[seg] || segmentTranslations[seg] || seg,
        href: '/dashboard/' + rawSegments.slice(0, i + 1).join('/'),
      })
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={item.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
