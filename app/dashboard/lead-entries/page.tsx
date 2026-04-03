'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'
import {
  Zap, Plus, MoreHorizontal, X, Eye, ArrowRight,
  Phone, Mail, Link2, AlertTriangle, UserCheck, Megaphone, Upload,
} from 'lucide-react'
import { BulkImportDialog } from '@/components/leads/bulk-import-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { LeadEntry, LeadEntryStatus } from '@/types/lead-entry'

const SOURCE_LABELS: Record<string, { label: string; class: string }> = {
  meta_ads:     { label: 'Meta Ads',      class: 'bg-blue-500/10 text-blue-600' },
  google_ads:   { label: 'Google Ads',    class: 'bg-red-500/10 text-red-600' },
  website:      { label: 'Website',       class: 'bg-emerald-500/10 text-emerald-600' },
  landing_page: { label: 'Landing Page',  class: 'bg-indigo-500/10 text-indigo-600' },
  partner:      { label: 'Parceiro',      class: 'bg-amber-500/10 text-amber-600' },
  organic:      { label: 'Orgânico',      class: 'bg-green-500/10 text-green-600' },
  walk_in:      { label: 'Presencial',    class: 'bg-orange-500/10 text-orange-600' },
  phone_call:   { label: 'Chamada',       class: 'bg-cyan-500/10 text-cyan-600' },
  social_media: { label: 'Redes Sociais', class: 'bg-pink-500/10 text-pink-600' },
  other:        { label: 'Outro',         class: 'bg-gray-500/10 text-gray-600' },
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  new:        { label: 'Novo',        dot: 'bg-sky-500' },
  seen:       { label: 'Visto',       dot: 'bg-yellow-500' },
  processing: { label: 'Em Curso',    dot: 'bg-blue-500' },
  converted:  { label: 'Convertido',  dot: 'bg-emerald-500' },
  discarded:  { label: 'Descartado',  dot: 'bg-slate-400' },
}

function MatchTag({ entry }: { entry: LeadEntry }) {
  const consultantName = entry.contact?.agent?.commercial_name
  const isMatch = entry.match_type && entry.match_type !== 'none'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isMatch ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
            <Link2 className="h-2.5 w-2.5" />
            Ja no sistema · {entry.match_type === 'both' ? 'tel + email' : entry.match_type === 'phone' ? 'telefone' : 'email'}
          </span>
          {consultantName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 text-[10px] font-medium">
              <UserCheck className="h-2.5 w-2.5" />
              {consultantName}
            </span>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
          <Plus className="h-2.5 w-2.5" />
          Novo
        </span>
      )}
      {entry.match_details?.is_duplicate_conflict && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2 py-0.5 text-[10px] font-medium">
          <AlertTriangle className="h-2.5 w-2.5" />
          Conflito
        </span>
      )}
    </div>
  )
}

export default function LeadEntriesPage() {
  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('new')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  // Dialogs & Sheet
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [sheetEntryId, setSheetEntryId] = useState<string | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<LeadEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/lead-entries?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data || [])
        setTotal(data.total || 0)
      }
    } catch { /* */ } finally { setLoading(false) }
  }, [statusFilter, sourceFilter])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const updateStatus = async (id: string, status: LeadEntryStatus) => {
    try {
      const res = await fetch(`/api/lead-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Lead marcado como ${STATUS_CONFIG[status]?.label || status}`)
      fetchEntries()
    } catch {
      toast.error('Erro ao actualizar lead')
    }
  }

  const newCount = entries.filter((e) => e.status === 'new').length

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-blue-400" />
            <p className="text-blue-400 text-xs font-medium tracking-widest uppercase">Inbound</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Leads por Contactar</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            {total} lead{total !== 1 ? 's' : ''} · {newCount > 0 ? `${newCount} novo${newCount !== 1 ? 's' : ''}` : 'nenhum novo'}
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20 flex gap-2">
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setShowNewDialog(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/30 border border-border/30">
          {['new', 'all', 'seen', 'processing', 'converted', 'discarded'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all',
                statusFilter === s ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] h-8 rounded-full text-xs">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content — Table */}
      {loading ? (
        <div className="rounded-xl border">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Zap className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhum lead encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== 'all' ? 'Tente ajustar os filtros.' : 'Os leads aparecerão aqui quando chegarem.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[200px]">Nome</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Correspondência</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const name = entry.raw_name || entry.contact?.nome || '—'
                const srcInfo = SOURCE_LABELS[entry.source] || SOURCE_LABELS.other
                const statusInfo = STATUS_CONFIG[entry.status] || STATUS_CONFIG.new
                const isNew = entry.status === 'new'

                return (
                  <TableRow
                    key={entry.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition-colors',
                      isNew && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                    onClick={() => setSheetEntryId(entry.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isNew && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                        {name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {entry.raw_phone && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{entry.raw_phone}
                          </span>
                        )}
                        {entry.raw_email && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]">
                            <Mail className="h-3 w-3 shrink-0" />{entry.raw_email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium w-fit', srcInfo.class)}>
                          {srcInfo.label}
                        </span>
                        {entry.campaign?.name && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[140px]">
                            <Megaphone className="h-2.5 w-2.5 shrink-0" />
                            {entry.campaign.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <MatchTag entry={entry} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium">
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusInfo.dot)} />
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.assigned_consultant?.commercial_name || entry.contact?.agent?.commercial_name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 rounded-full hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status === 'new' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(entry.id, 'seen') }}>
                              <Eye className="mr-2 h-4 w-4" /> Marcar Visto
                            </DropdownMenuItem>
                          )}
                          {!['converted', 'discarded'].includes(entry.status) && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQualifyEntry(entry) }}>
                              <ArrowRight className="mr-2 h-4 w-4" /> Qualificar
                            </DropdownMenuItem>
                          )}
                          {!['converted', 'discarded'].includes(entry.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(entry.id, 'discarded') }} className="text-destructive">
                                <X className="mr-2 h-4 w-4" /> Descartar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══ Lead Detail Sheet ═══ */}
      <LeadEntrySheet
        entryId={sheetEntryId}
        open={!!sheetEntryId}
        onOpenChange={(open) => { if (!open) setSheetEntryId(null) }}
        onQualify={(entry) => setQualifyEntry(entry)}
        onStatusChange={fetchEntries}
      />

      {/* ═══ Qualify Dialog ═══ */}
      <QualifyEntryDialog
        open={!!qualifyEntry}
        onOpenChange={(open) => { if (!open) setQualifyEntry(null) }}
        entry={qualifyEntry}
        onQualified={() => {
          setQualifyEntry(null)
          setSheetEntryId(null)
          fetchEntries()
        }}
      />

      {/* ═══ New Lead Dialog ═══ */}
      <LeadEntryDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onComplete={fetchEntries}
        realEstateOnly
      />

      {/* ═══ Bulk Import Dialog ═══ */}
      <BulkImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onComplete={() => fetchEntries()}
      />
    </div>
  )
}
