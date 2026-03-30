'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContactRound, Search, ChevronLeft, ChevronRight, Plus, Phone, Mail, X, Upload } from 'lucide-react'
import { BulkImportDialog } from '@/components/leads/bulk-import-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { LeadsContactWithRelations, LeadsContactStage } from '@/types/leads-crm'

const PAGE_SIZE = 25

export default function ContactosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ContactosPageContent />
    </Suspense>
  )
}

function ContactosPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<LeadsContactWithRelations[]>([])
  const [stages, setStages] = useState<LeadsContactStage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [stageFilter, setStageFilter] = useState(searchParams.get('lifecycle_stage_id') || '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const debouncedSearch = useDebounce(search, 300)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (stageFilter) params.set('lifecycle_stage_id', stageFilter)
      params.set('page', String(page))
      params.set('per_page', String(PAGE_SIZE))

      const res = await fetch(`/api/crm/contacts?${params}`)
      const json = await res.json()
      setContacts(json.data || [])
      setTotal(json.total || 0)
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, stageFilter, page])

  useEffect(() => {
    fetch('/api/crm/contact-stages')
      .then((r) => r.json())
      .then((d) => setStages(d.data || []))
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { setPage(1) }, [debouncedSearch, stageFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contactos</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            {total} contacto{total !== 1 ? 's' : ''} no sistema
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => router.push('/dashboard/crm/contactos/novo')}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo Contacto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Lifecycle stage pills */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
          <button
            onClick={() => setStageFilter('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              !stageFilter
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Todos
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setStageFilter(s.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                stageFilter === s.id
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <ContactRound className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhum contacto encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {debouncedSearch || stageFilter ? 'Tente ajustar os filtros.' : 'Comece por adicionar um contacto.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((c, idx) => {
              const name = c.full_name || c.nome || 'Sem nome'
              const phone = c.telemovel ?? c.phone
              const consultant = c.consultant?.commercial_name ?? (c as any).dev_users?.commercial_name
              const stage = c.lifecycle_stage ?? (c as any).leads_contact_stages
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/dashboard/crm/contactos/${c.id}`)}
                  className="group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-neutral-100 dark:bg-neutral-800">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {consultant || 'Sem consultor'}
                      </p>
                    </div>
                    {stage && (
                      stage.name === 'Cliente Premium' ? (
                        <span className="badge-premium inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-600 dark:via-neutral-500 dark:to-neutral-600 text-neutral-700 dark:text-neutral-200 shadow-sm ring-1 ring-neutral-300/50 dark:ring-neutral-500/50">
                          <span className="h-1 w-1 rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500" />
                          {stage.name}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full text-[9px] px-2"
                          style={{ borderColor: stage.color, color: stage.color }}
                        >
                          {stage.name}
                        </Badge>
                      )
                    )}
                  </div>

                  {/* Contact info pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {phone && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                        <Phone className="h-2.5 w-2.5" />{phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                        <Mail className="h-2.5 w-2.5 shrink-0" />{c.email}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {c.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {c.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] rounded-full px-2">{tag}</Badge>
                      ))}
                      {c.tags.length > 3 && (
                        <Badge variant="secondary" className="text-[9px] rounded-full px-2">+{c.tags.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: pt })}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Pagina {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={() => fetchContacts()}
      />
    </div>
  )
}
