import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function MetaPaginationNav({
  basePath,
  searchParams,
  page,
  pageSize,
  total,
}: {
  basePath: string
  searchParams: Record<string, string | undefined>
  page: number
  pageSize: number
  total: number
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  function buildHref(targetPage: number) {
    const next = new URLSearchParams()
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) next.set(k, v)
    })
    next.set('page', String(targetPage))
    return `${basePath}?${next.toString()}`
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-xs tabular-nums">
        Página {page} de {totalPages} · {total} registo{total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          asChild={hasPrev}
        >
          {hasPrev ? (
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          asChild={hasNext}
        >
          {hasNext ? (
            <Link href={buildHref(page + 1)}>
              Seguinte
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <span>
              Seguinte
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
