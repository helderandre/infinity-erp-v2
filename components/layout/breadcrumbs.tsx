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

const pathTranslations: Record<string, string> = {
  dashboard: 'Dashboard',
  imoveis: 'Imóveis',
  novo: 'Novo',
  editar: 'Editar',
  leads: 'Leads',
  processos: 'Processos',
  angariacao: 'Angariação',
  templates: 'Templates',
  documentos: 'Documentos',
  proprietarios: 'Proprietários',
  consultores: 'Consultores',
  equipas: 'Equipas',
  comissoes: 'Comissões',
  marketing: 'Marketing',
  definicoes: 'Definições',
  notificacoes: 'Notificações',
}

export function Breadcrumbs() {
  const pathname = usePathname()

  if (!pathname || pathname === '/') {
    return null
  }

  const segments = pathname
    .split('/')
    .filter(Boolean)
    // Remover segmentos UUID (IDs) — não têm página própria
    .filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))

  // Não mostrar breadcrumbs para rotas de autenticação
  if (segments[0] === 'login') {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const isLast = index === segments.length - 1
          const displayLabel = pathTranslations[segment] || segment

          return (
            <Fragment key={href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayLabel}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{displayLabel}</Link>
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
