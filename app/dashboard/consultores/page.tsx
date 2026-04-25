'use client'

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ConsultantCard } from '@/components/consultants/consultant-card'
import { ConsultantDetailSheet } from '@/components/consultants/consultant-detail-sheet'
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
  Briefcase,
  Download,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { classifyMember } from '@/lib/auth/roles'
import type { ConsultantWithProfile } from '@/types/consultant'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const TABS = [
  { key: 'equipa' as const, label: 'Equipa', icon: Users },
  { key: 'consultores' as const, label: 'Consultores', icon: UserCircle },
  { key: 'staff' as const, label: 'Staff', icon: Briefcase },
]

type TabKey = (typeof TABS)[number]['key']

const DEFAULT_ROLE_BY_TAB: Record<TabKey, string | undefined> = {
  equipa: undefined,
  consultores: 'Consultor',
  staff: 'Staff',
}

export default function ConsultoresPage() {
  return (
    <Suspense fallback={<ConsultoresPageSkeleton />}>
      <ConsultoresPageContent />
    </Suspense>
  )
}

function ConsultoresPageSkeleton() {
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function ConsultoresPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabKey>('equipa')
  const [detailConsultantId, setDetailConsultantId] = useState<string | null>(null)

  const [consultants, setConsultants] = useState<ConsultantWithProfile[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [createOpen, setCreateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Equipa + Staff derived state (single fetch of all members)
  const [allMembers, setAllMembers] = useState<ConsultantWithProfile[]>([])
  const [isLoadingAll, setIsLoadingAll] = useState(true)

  const consultantMembers = useMemo(
    () =>
      allMembers.filter((m) =>
        m.user_roles?.some((ur) => classifyMember(ur.roles?.name) === 'consultor')
      ),
    [allMembers]
  )

  const staffMembers = useMemo(
    () =>
      allMembers.filter((m) =>
        m.user_roles?.some((ur) => classifyMember(ur.roles?.name) === 'staff')
      ),
    [allMembers]
  )

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const hasActiveFilters = debouncedSearch !== '' || (status !== 'all' && status !== 'active') || role !== 'all'

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
          (data || []).map((r: { id: string; name: string }) => ({
            id: r.id,
            name: r.name,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  const loadAllMembers = useCallback(async () => {
    setIsLoadingAll(true)
    try {
      const res = await fetch('/api/consultants?consultant_only=false&status=active&per_page=100')
      if (!res.ok) throw new Error('Erro ao carregar equipa')
      const data = await res.json()
      setAllMembers((data.data || []) as ConsultantWithProfile[])
    } catch {
      setAllMembers([])
    } finally {
      setIsLoadingAll(false)
    }
  }, [])

  useEffect(() => { loadConsultants() }, [loadConsultants])
  useEffect(() => { loadRoles() }, [loadRoles])
  useEffect(() => { loadAllMembers() }, [loadAllMembers])
  useEffect(() => { setPage(0) }, [debouncedSearch, status, role])

  // Sync ?consultant=<id> with the detail sheet so deep links open directly.
  const consultantParam = searchParams.get('consultant')
  useEffect(() => {
    if (consultantParam && consultantParam !== detailConsultantId) {
      setDetailConsultantId(consultantParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultantParam])

  const openConsultantSheet = (id: string) => {
    setDetailConsultantId(id)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('consultant', id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleConsultantSheetOpenChange = (open: boolean) => {
    if (open) return
    setDetailConsultantId(null)
    if (consultantParam) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.delete('consultant')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('active')
    setRole('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      {/* ─── Pill Toggle + Actions ─── */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 flex-nowrap">
        <div className="inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 h-7 sm:h-9 rounded-full text-[13px] sm:text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4 hidden sm:block" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* View toggle — visible for equipa + consultores */}
          {(activeTab === 'equipa' || activeTab === 'consultores') && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full bg-muted/30 backdrop-blur-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-colors duration-300',
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
                  'h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-colors duration-300',
                  viewMode === 'table'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Action buttons (icon-only on mobile, icon+label on desktop) */}
          <button
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-7 w-7 sm:h-9 sm:w-auto sm:px-4 rounded-full bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors"
            aria-label="Exportar"
            title="Exportar"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-7 w-7 sm:h-9 sm:w-auto sm:px-4 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-medium transition-colors hover:opacity-90"
            aria-label="Novo Membro"
            title="Novo Membro"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Novo Membro</span>
          </button>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="mt-3 sm:mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300">

          {/* ═══════ EQUIPA TAB ═══════ */}
          {activeTab === 'equipa' && (
            <div className="space-y-3 sm:space-y-5">
              {isLoadingAll ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
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
              ) : allMembers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum membro encontrado"
                  description="Comece por adicionar o primeiro membro à equipa"
                  action={{ label: 'Novo Membro', onClick: () => setCreateOpen(true) }}
                />
              ) : (() => {
                const sortedMembers = [...allMembers].sort((a, b) =>
                  a.commercial_name.localeCompare(b.commercial_name)
                )
                const renderMemberCard = (member: ConsultantWithProfile) => {
                  const roleName = member.user_roles?.[0]?.roles?.name
                  return (
                    <div key={member.id} className="relative h-full">
                      <ConsultantCard
                        consultant={member}
                        onClick={() => openConsultantSheet(member.id)}
                      />
                      {roleName && (
                        <Badge variant="secondary" className="absolute top-3 right-3 rounded-full text-[10px] px-2.5 py-1 bg-black/50 backdrop-blur-md text-white border-0 shadow-lg">
                          {roleName}
                        </Badge>
                      )}
                    </div>
                  )
                }

                if (viewMode === 'grid') {
                  return (
                    <>
                      {/* Mobile: horizontal swipe carousel */}
                      <div className="sm:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 scrollbar-hide">
                        {sortedMembers.map((member) => (
                          <div key={`eq-m-${member.id}`} className="snap-center shrink-0 w-[calc(100vw-3rem)]">
                            {renderMemberCard(member)}
                          </div>
                        ))}
                      </div>
                      {/* Desktop: grid */}
                      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {sortedMembers.map(renderMemberCard)}
                      </div>
                    </>
                  )
                }

                return (
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
                        {sortedMembers.map((member) => {
                          const profile = member.dev_consultant_profiles
                          const roleName = member.user_roles?.[0]?.roles?.name
                          return (
                            <TableRow
                              key={member.id}
                              className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                              onClick={() => openConsultantSheet(member.id)}
                            >
                              <TableCell>
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={profile?.profile_photo_url || undefined} />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-600 dark:to-neutral-700">
                                    {getInitials(member.commercial_name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell className="text-sm font-medium">{member.commercial_name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {member.professional_email || '—'}
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
                                {member.is_active ? (
                                  <Badge className="rounded-full text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    Ativo
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                                    Inativo
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ═══════ CONSULTORES TAB ═══════ */}
          {activeTab === 'consultores' && (
            <div className="space-y-3 sm:space-y-5">
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
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
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
                      ? { label: 'Novo Membro', onClick: () => setCreateOpen(true) }
                      : undefined
                  }
                />
              ) : viewMode === 'grid' ? (
                <>
                  {/* Mobile: horizontal swipe carousel (one card at a time) */}
                  <div className="sm:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 scrollbar-hide">
                    {consultants.map((consultant) => (
                      <div key={consultant.id} className="snap-center shrink-0 w-[calc(100vw-3rem)]">
                        <ConsultantCard
                          consultant={consultant}
                          onClick={() => openConsultantSheet(consultant.id)}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Desktop: grid */}
                  <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {consultants.map((consultant) => (
                      <ConsultantCard
                        key={consultant.id}
                        consultant={consultant}
                        onClick={() => openConsultantSheet(consultant.id)}
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
                              onClick={() => openConsultantSheet(consultant.id)}
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
                                    Ativo
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                                    Inativo
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

          {/* ═══════ STAFF TAB ═══════ */}
          {activeTab === 'staff' && (
            <div className="space-y-5">
              {isLoadingAll ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                  ))}
                </div>
              ) : staffMembers.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Nenhum membro de staff encontrado"
                  description="Ainda não existem membros de staff registados."
                />
              ) : (() => {
                const sortedStaff = [...staffMembers].sort((a, b) => {
                  const aRole = a.user_roles?.[0]?.roles?.name || ''
                  const bRole = b.user_roles?.[0]?.roles?.name || ''
                  if (aRole === 'Broker/CEO') return -1
                  if (bRole === 'Broker/CEO') return 1
                  return a.commercial_name.localeCompare(b.commercial_name)
                })
                const renderStaffCard = (member: typeof sortedStaff[number]) => {
                  const roleName = member.user_roles?.[0]?.roles?.name
                  return (
                    <div key={member.id} className="relative h-full">
                      <ConsultantCard
                        consultant={member}
                        onClick={() => openConsultantSheet(member.id)}
                      />
                      {roleName && (
                        <Badge variant="secondary" className="absolute top-3 right-3 rounded-full text-[10px] px-2.5 py-1 bg-black/50 backdrop-blur-md text-white border-0 shadow-lg">
                          {roleName}
                        </Badge>
                      )}
                    </div>
                  )
                }
                return (
                  <>
                    {/* Mobile: horizontal swipe carousel */}
                    <div className="sm:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 scrollbar-hide">
                      {sortedStaff.map((member) => (
                        <div key={`m-${member.id}`} className="snap-center shrink-0 w-[calc(100vw-3rem)]">
                          {renderStaffCard(member)}
                        </div>
                      ))}
                    </div>
                    {/* Desktop: grid */}
                    <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {sortedStaff.map(renderStaffCard)}
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Create Consultant Dialog */}
      <CreateConsultantDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            loadConsultants()
            loadAllMembers()
          }
        }}
        roles={roles}
        defaultRoleName={DEFAULT_ROLE_BY_TAB[activeTab]}
      />
      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/consultants"
        title="Consultores"
        showConsultantFilter={false}
      />

      <ConsultantDetailSheet
        consultantId={detailConsultantId}
        open={!!detailConsultantId}
        onOpenChange={handleConsultantSheetOpenChange}
      />
    </div>
  )
}
