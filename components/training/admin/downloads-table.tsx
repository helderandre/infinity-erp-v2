// @ts-nocheck
'use client'

import { useState } from 'react'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { useTrainingAdminDownloads } from '@/hooks/use-training-admin-downloads'
import { formatDate, formatDateTime } from '@/lib/constants'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

const VIEW_TABS = [
  { key: 'stats', label: 'Por Material' },
  { key: 'events', label: 'Eventos' },
] as const

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface DownloadsTableProps {
  courseId?: string
}

export function DownloadsTable({ courseId }: DownloadsTableProps) {
  const [viewMode, setViewMode] = useState<'stats' | 'events'>('stats')
  const [page, setPage] = useState(1)

  const { data, total, isLoading } = useTrainingAdminDownloads({
    courseId,
    view: viewMode,
    page,
    limit: PAGE_SIZE,
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setViewMode(tab.key as any); setPage(1) }}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
              viewMode === tab.key
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Nenhum download registado"
          description="Ainda não foram registados downloads de materiais."
        />
      ) : viewMode === 'stats' ? (
        /* Stats view */
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Material</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Downloads Totais</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Utilizadores Únicos</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Último Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item: any) => (
                <TableRow key={item.material_id}>
                  <TableCell className="font-medium max-w-[250px] truncate">{item.material_name}</TableCell>
                  <TableCell className="text-center">{item.total_downloads}</TableCell>
                  <TableCell className="text-center">{item.unique_users}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(item.last_download)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Events view */
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Material</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Utilizador</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tamanho</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{item.material_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.user?.commercial_name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(item.file_size_bytes)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.downloaded_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted-foreground">
            {total} registo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
