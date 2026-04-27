'use client'

import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Building2, ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { PropertyListItemData } from './property-list-item'

const fmtPrice = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

type SortDir = 'asc' | 'desc'

interface PropertiesTableProps {
  properties: PropertyListItemData[]
  sortBy: string
  sortDir: SortDir
  onSort: (column: string, dir: SortDir) => void
  onResetSort: () => void
  onRowClick: (property: PropertyListItemData) => void
  rowActions?: (property: PropertyListItemData) => ReactNode
}

interface ColumnDef {
  key: string
  label: string
  /** Server-side sort identifier — when omitted the column isn't sortable. */
  sortKey?: string
  align?: 'left' | 'right' | 'center'
  /** Tailwind responsive visibility class to keep the table readable on
   *  small screens (e.g., 'hidden md:table-cell'). */
  hideAt?: string
  width?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'cover', label: '', width: 'w-[64px]' },
  { key: 'external_ref', label: 'Ref.', sortKey: 'external_ref', width: 'w-[110px]', hideAt: 'hidden sm:table-cell' },
  { key: 'title', label: 'Título', sortKey: 'title' },
  { key: 'type', label: 'Tipo', hideAt: 'hidden lg:table-cell', width: 'w-[140px]' },
  { key: 'city', label: 'Cidade', sortKey: 'city', hideAt: 'hidden md:table-cell', width: 'w-[140px]' },
  { key: 'listing_price', label: 'Preço', sortKey: 'listing_price', align: 'right', width: 'w-[120px]' },
  { key: 'status', label: 'Estado', sortKey: 'status', hideAt: 'hidden md:table-cell', width: 'w-[120px]' },
  { key: 'consultant', label: 'Consultor', hideAt: 'hidden xl:table-cell', width: 'w-[160px]' },
  { key: 'created_at', label: 'Data', sortKey: 'created_at', hideAt: 'hidden lg:table-cell', width: 'w-[110px]' },
  { key: 'actions', label: '', width: 'w-[48px]' },
]

function SortHeader({
  label,
  column,
  isActive,
  dir,
  onSort,
  onReset,
}: {
  label: string
  column: string
  isActive: boolean
  dir: SortDir
  onSort: (column: string, dir: SortDir) => void
  onReset: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            '-ml-2 h-7 px-2 text-[11px] font-semibold uppercase tracking-wider gap-1.5',
            isActive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span>{label}</span>
          {isActive && dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : isActive && dir === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl">
        <DropdownMenuItem onClick={() => onSort(column, 'asc')}>
          <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          Crescente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSort(column, 'desc')}>
          <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          Decrescente
        </DropdownMenuItem>
        {isActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset}>
              <RotateCcw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              Repor predefinido
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PropertiesTable({
  properties,
  sortBy,
  sortDir,
  onSort,
  onResetSort,
  onRowClick,
  rowActions,
}: PropertiesTableProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideAt,
                    col.width,
                  )}
                >
                  {col.sortKey ? (
                    <div className={cn(col.align === 'right' && 'flex justify-end')}>
                      <SortHeader
                        label={col.label}
                        column={col.sortKey}
                        isActive={sortBy === col.sortKey}
                        dir={sortDir}
                        onSort={onSort}
                        onReset={onResetSort}
                      />
                    </div>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => {
              const cover = p.dev_property_media?.find((m) => m.is_cover) || p.dev_property_media?.[0]
              const typeLabel =
                PROPERTY_TYPES[p.property_type as keyof typeof PROPERTY_TYPES] || p.property_type || '—'
              const businessLabel = p.business_type
                ? BUSINESS_TYPES[p.business_type as keyof typeof BUSINESS_TYPES] || p.business_type
                : null
              const statusMeta = p.status
                ? PROPERTY_STATUS[p.status as keyof typeof PROPERTY_STATUS]
                : null
              let dateLabel = '—'
              try {
                if (p.created_at) dateLabel = format(parseISO(p.created_at), 'd MMM yy', { locale: pt })
              } catch {}

              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onRowClick(p)}
                >
                  <TableCell className="w-[64px] p-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-muted shrink-0">
                      {cover?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.url} alt={p.title ?? ''} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell w-[110px] text-xs font-medium text-muted-foreground tabular-nums">
                    {p.external_ref ?? '—'}
                  </TableCell>

                  <TableCell className="min-w-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate">{p.title || '—'}</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
                        {p.external_ref && (
                          <span className="tabular-nums">{p.external_ref}</span>
                        )}
                        {p.city && <span>· {p.city}</span>}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell w-[140px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium">{typeLabel}</span>
                      {businessLabel && (
                        <span className="text-[10px] text-muted-foreground">{businessLabel}</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell w-[140px] text-xs text-muted-foreground truncate">
                    {p.city || '—'}
                  </TableCell>

                  <TableCell className="w-[120px] text-right text-sm font-semibold tabular-nums">
                    {p.listing_price != null ? fmtPrice.format(p.listing_price) : '—'}
                  </TableCell>

                  <TableCell className="hidden md:table-cell w-[120px]">
                    {statusMeta ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          statusMeta.bg,
                          statusMeta.text,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
                        {statusMeta.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="hidden xl:table-cell w-[160px] text-xs text-muted-foreground truncate">
                    {p.consultant?.commercial_name || '—'}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell w-[110px] text-[11px] text-muted-foreground tabular-nums">
                    {dateLabel}
                  </TableCell>

                  <TableCell className="w-[48px] text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions?.(p)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
