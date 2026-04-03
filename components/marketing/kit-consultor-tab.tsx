'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Search, Check, Users, Image, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentInQueue {
  id: string
  commercial_name: string
  professional_email: string
  role: string
  profile_photo_url: string | null
  created_at: string
  materials_count: number
  total_templates: number
  is_complete: boolean
}

export function KitConsultorTab() {
  const router = useRouter()
  const [agents, setAgents] = useState<AgentInQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('incomplete')

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/marketing/kit-queue?${params}`)
      const data = await res.json()
      setAgents(data.agents || [])
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar consultor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="incomplete">Kit Incompleto</SelectItem>
            <SelectItem value="complete">Kit Completo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {agents.length} consultor{agents.length !== 1 ? 'es' : ''}
          </span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={filter === 'incomplete' ? CheckCircle2 : Users}
          title={filter === 'incomplete' ? 'Todos os kits estão completos' : 'Nenhum consultor encontrado'}
          description={filter === 'incomplete' ? 'Não existem consultores com kit incompleto.' : 'Tente ajustar os filtros de pesquisa.'}
        />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {agents.map((agent, idx) => {
            const progressPct = agent.total_templates > 0
              ? Math.round((agent.materials_count / agent.total_templates) * 100)
              : 0
            const initials = agent.commercial_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

            return (
              <button
                key={agent.id}
                className={cn(
                  'w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                  idx !== 0 && 'border-t'
                )}
                onClick={() => router.push(`/dashboard/marketing/kit-consultor/${agent.id}`)}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={agent.profile_photo_url || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{agent.commercial_name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{agent.role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{agent.professional_email}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 w-36">
                    <Progress value={progressPct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {agent.materials_count}/{agent.total_templates}
                    </span>
                  </div>

                  {agent.is_complete ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                      <Check className="h-3 w-3 mr-1" />Completo
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                      Incompleto
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
