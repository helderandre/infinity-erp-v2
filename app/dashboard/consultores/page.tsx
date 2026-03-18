'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ConsultantCard } from '@/components/consultants/consultant-card'
import { ConsultantFilters } from '@/components/consultants/consultant-filters'
import { CreateConsultantDialog } from '@/components/consultants/create-consultant-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  UserCircle,
  Plus,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Users,
  UsersRound,
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { CONSULTANT_ROLES } from '@/lib/auth/roles'
import type { ConsultantWithProfile } from '@/types/consultant'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const TABS = [
  { key: 'consultores' as const, label: 'Consultores', icon: Users },
  { key: 'equipas' as const, label: 'Equipas', icon: UsersRound },
]

type TabKey = (typeof TABS)[number]['key']

export default function ConsultoresPage() {
  return (
    <Suspense fallback={<ConsultoresPageSkeleton />}>
      <ConsultoresPageContent />
    </Suspense>
  )
}

function ConsultoresPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function ConsultoresPageContent() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('consultores')

  const [consultants, setConsultants] = useState<ConsultantWithProfile[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [createOpen, setCreateOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters = debouncedSearch !== '' || status !== 'all' || role !== 'all'

  const loadConsultants = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status !== 'all') params.set('status', status)
      if (role !== 'all') params.set('role', role)
      params.set('per_page', String(PAGE_SIZE))
      params.set('page', String(page + 1))

      const res = await fetch(`/api/consultants?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar consultores')

      const data = await res.json()
      setConsultants(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar consultores:', error)
      setConsultants([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, role, page])

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/libraries/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(
          (data || [])
            .filter((r: { name: string }) => (CONSULTANT_ROLES as readonly string[]).includes(r.name))
            .map((r: { id: string; name: string }) => ({
              id: r.id,
              name: r.name,
            }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => { loadConsultants() }, [loadConsultants])
  useEffect(() => { loadRoles() }, [loadRoles])
  useEffect(() => { setPage(0) }, [debouncedSearch, status, role])

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setRole('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  // Group consultants by role for equipas tab
  const teamGroups = consultants.reduce<Record<string, ConsultantWithProfile[]>>((acc, c) => {
    const roleName = c.user_roles?.[0]?.roles?.name || 'Sem Função'
    if (!acc[roleName]) acc[roleName] = []
    acc[roleName].push(c)
    return acc
  }, {})

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Equipa
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Consultores
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Gestão de consultores, perfis e equipas da imobiliária.
          </p>
        </div>
        {/* Add button */}
        <Button
          size="sm"
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo Consultor
        </Button>
      </div>

      {/* ─── Pill Toggle Navigation ─── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* View toggle — only for consultores tab */}
        {activeTab === 'consultores' && (
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-300',
                viewMode === 'grid'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-300',
                viewMode === 'table'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300">

          {/* ═══════ CONSULTORES TAB ═══════ */}
          {activeTab === 'consultores' && (
            <div className="space-y-5">
              {/* Filters */}
              <ConsultantFilters
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                role={role}
                onRoleChange={setRole}
                roles={roles}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />

              {/* Loading */}
              {isLoading ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl" />
                    ))}
                  </div>
                )
              ) : consultants.length === 0 ? (
                <EmptyState
                  icon={UserCircle}
                  title="Nenhum consultor encontrado"
                  description={
                    hasActiveFilters
                      ? 'Tente ajustar os critérios de pesquisa'
                      : 'Comece por adicionar o primeiro consultor'
                  }
                  action={
                    !hasActiveFilters
                      ? { label: 'Novo Consultor', onClick: () => router.push('/dashboard/consultores/novo') }
                      : undefined
                  }
                />
              ) : viewMode === 'grid' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {consultants.map((consultant) => (
                      <ConsultantCard
                        key={consultant.id}
                        consultant={consultant}
                        onClick={() => router.push(`/dashboard/consultores/${consultant.id}`)}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[11px] text-muted-foreground">
                        {total} consultor{total !== 1 ? 'es' : ''}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[50px]" />
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Nome</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Email</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Telemóvel</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Função</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consultants.map((consultant) => {
                          const profile = consultant.dev_consultant_profiles
                          const roleName = consultant.user_roles?.[0]?.roles?.name
                          return (
                            <TableRow
                              key={consultant.id}
                              className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                              onClick={() => router.push(`/dashboard/consultores/${consultant.id}`)}
                            >
                              <TableCell>
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={profile?.profile_photo_url || undefined} />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-600 dark:to-neutral-700">
                                    {getInitials(consultant.commercial_name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell className="text-sm font-medium">{consultant.commercial_name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {consultant.professional_email || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {profile?.phone_commercial || '—'}
                              </TableCell>
                              <TableCell>
                                {roleName ? (
                                  <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 bg-muted/50">
                                    {roleName}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {consultant.is_active ? (
                                  <Badge className="rounded-full text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    Activo
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                                    Inactivo
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[11px] text-muted-foreground">
                        {total} consultor{total !== 1 ? 'es' : ''}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════ EQUIPAS TAB ═══════ */}
          {activeTab === 'equipas' && (
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-6 w-40" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {[1, 2, 3].map((j) => <Skeleton key={j} className="h-16 rounded-xl" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : Object.keys(teamGroups).length === 0 ? (
                <EmptyState
                  icon={UsersRound}
                  title="Nenhuma equipa encontrada"
                  description="Ainda não existem consultores registados."
                />
              ) : (
                Object.entries(teamGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([roleName, members]) => (
                    <div key={roleName} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{roleName}</h3>
                        <Badge variant="secondary" className="text-[10px] rounded-full bg-muted/50">
                          {members.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {members.map((member) => {
                          const profile = member.dev_consultant_profiles
                          return (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-2xl border bg-card/50 backdrop-blur-sm p-3 transition-all duration-300 hover:shadow-md hover:bg-card/80 cursor-pointer"
                              onClick={() => router.push(`/dashboard/consultores/${member.id}`)}
                            >
                              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm">
                                <AvatarImage src={profile?.profile_photo_url || undefined} />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-600 dark:to-neutral-700">
                                  {getInitials(member.commercial_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{member.commercial_name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {profile?.phone_commercial || member.professional_email || '—'}
                                </p>
                              </div>
                              {member.is_active ? (
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Activo" />
                              ) : (
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" title="Inactivo" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Consultant Dialog */}
      <CreateConsultantDialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) loadConsultants() }}
        roles={roles}
      />
    </div>
  )
}
