// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  ChevronLeft, ChevronRight, Search, X, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { UserCompletionStats, UserCourseDetail } from '@/types/training'

const PAGE_SIZE = 20

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrito',
  in_progress: 'Em Progresso',
  completed: 'Concluído',
  failed: 'Reprovado',
  expired: 'Expirado',
}

const ENROLLMENT_STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-sky-500/15 text-sky-600',
  in_progress: 'bg-blue-500/15 text-blue-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-red-500/15 text-red-600',
  expired: 'bg-slate-500/15 text-slate-500',
}

export function UserProgressTable() {
  const [users, setUsers] = useState<UserCompletionStats[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<{ user: any; courses: UserCourseDetail[] } | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  const debouncedSearch = useDebounce(search, 300)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams()
      if (debouncedSearch) sp.set('search', debouncedSearch)
      sp.set('page', String(page))
      sp.set('limit', String(PAGE_SIZE))
      const res = await fetch(`/api/training/admin/users?${sp}`)
      const json = await res.json()
      setUsers(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const fetchUserDetail = useCallback(async (userId: string) => {
    setIsLoadingDetail(true)
    try {
      const res = await fetch(`/api/training/admin/users/${userId}`)
      const json = await res.json()
      setUserDetail(json)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId)
    setExpandedCourses(new Set())
    fetchUserDetail(userId)
  }

  const toggleCourse = (enrollmentId: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId)
      return next
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatTimeSpent = (seconds: number) => {
    if (!seconds) return '—'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar utilizadores..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button type="button" title="Limpar" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum utilizador inscrito"
          description="Ainda não existem utilizadores inscritos em formações."
        />
      ) : (
        <>
          <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Utilizador</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Inscritos</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Concluídos</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Progresso Médio</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Última Actividade</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id} className="transition-colors duration-200 hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {user.profile_photo_url && <AvatarImage src={user.profile_photo_url} />}
                          <AvatarFallback className="text-xs">
                            {(user.commercial_name || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{user.commercial_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{user.courses_enrolled}</TableCell>
                    <TableCell className="text-center">{user.courses_completed}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={user.avg_progress || 0} className="h-2 flex-1 max-w-[100px]" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{user.avg_progress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.last_activity)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleSelectUser(user.user_id)}>
                        Ver detalhe
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground">
                {total} utilizador{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}
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
        </>
      )}

      {/* User Detail Sheet */}
      <Sheet open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{userDetail?.user?.commercial_name || 'Detalhe do Utilizador'}</SheetTitle>
            {userDetail?.user?.professional_email && (
              <p className="text-sm text-muted-foreground">{userDetail.user.professional_email}</p>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {isLoadingDetail ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : !userDetail?.courses?.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum curso encontrado.</p>
            ) : (
              userDetail.courses.map((course: UserCourseDetail) => {
                const isExpanded = expandedCourses.has(course.enrollment_id)
                const totalTime = course.lessons.reduce((sum, l) => sum + (l.time_spent_seconds || 0), 0)

                return (
                  <div key={course.enrollment_id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{course.course_title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn('rounded-full text-[10px] px-2 py-0.5', ENROLLMENT_STATUS_COLORS[course.status])}>
                            {ENROLLMENT_STATUS_LABELS[course.status] || course.status}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            Inscrito {formatDate(course.enrolled_at)}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{course.progress_percent}%</span>
                    </div>

                    <Progress value={course.progress_percent} className="h-2" />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tempo total: {formatTimeSpent(totalTime)}</span>
                      {course.completed_at && <span>Concluído {formatDate(course.completed_at)}</span>}
                    </div>

                    {course.lessons.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs w-full justify-start text-muted-foreground"
                          onClick={() => toggleCourse(course.enrollment_id)}
                        >
                          {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                          {course.lessons.length} lição{course.lessons.length !== 1 ? 'ões' : ''}
                        </Button>

                        {isExpanded && (
                          <div className="space-y-1 ml-2">
                            {course.lessons.map((lesson) => (
                              <div key={lesson.lesson_id} className="flex items-center justify-between text-xs py-1.5 border-b border-muted/50 last:border-0">
                                <span className={cn(
                                  'truncate max-w-[200px]',
                                  lesson.status === 'completed' && 'text-emerald-600'
                                )}>
                                  {lesson.title || 'Sem título'}
                                </span>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <span>{formatTimeSpent(lesson.time_spent_seconds)}</span>
                                  <Badge variant="outline" className={cn(
                                    'rounded-full text-[9px] px-1.5 py-0',
                                    lesson.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600' :
                                    lesson.status === 'in_progress' ? 'bg-blue-500/15 text-blue-600' :
                                    'bg-slate-500/15 text-slate-500'
                                  )}>
                                    {lesson.status === 'completed' ? 'Concluída' : lesson.status === 'in_progress' ? 'Em progresso' : 'Pendente'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
