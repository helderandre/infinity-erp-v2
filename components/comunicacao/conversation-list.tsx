'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Users, User, Search } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ConversationListItem } from './conversation-list-item'
import { ProcessChannelList } from './process-channel-list'
import { getDmChannelId, INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'
import type { ProcessChannelPreview } from '@/types/internal-chat'

export type ConversationType =
  | { type: 'internal' }
  | { type: 'dm'; userId: string; userName: string; avatarUrl?: string }
  | { type: 'process'; processId: string }

interface DevUserContact {
  id: string
  commercial_name: string
  dev_consultant_profiles: { profile_photo_url: string | null } | null
  user_roles: Array<{ role: { name: string } | null }> | null
}

const ROLE_COLORS: Record<string, string> = {
  'Broker/CEO': 'bg-amber-100 text-amber-800',
  'Consultor': 'bg-blue-100 text-blue-800',
  'Consultora Executiva': 'bg-violet-100 text-violet-800',
  'Gestora Processual': 'bg-emerald-100 text-emerald-800',
  'Marketing': 'bg-pink-100 text-pink-800',
  'Office Manager': 'bg-teal-100 text-teal-800',
  'team_leader': 'bg-orange-100 text-orange-800',
  'recrutador': 'bg-indigo-100 text-indigo-800',
  'intermediario_credito': 'bg-cyan-100 text-cyan-800',
}

function getRoleColor(roleName: string): string {
  return ROLE_COLORS[roleName] || 'bg-muted text-muted-foreground'
}

interface ConversationListProps {
  currentUserId: string
  activeConversation: ConversationType | null
  onSelect: (conversation: ConversationType) => void
  processChannels: ProcessChannelPreview[]
  isLoadingChannels: boolean
  onSearchChannels: (query: string) => void
  unreadCounts?: Record<string, number>
}

export function ConversationList({
  currentUserId,
  activeConversation,
  onSelect,
  processChannels,
  isLoadingChannels,
  onSearchChannels,
  unreadCounts = {},
}: ConversationListProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'processos'>('chat')
  const [contacts, setContacts] = useState<DevUserContact[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [contactSearch, setContactSearch] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const isInternalActive = activeConversation?.type === 'internal'
  const activeProcessId =
    activeConversation?.type === 'process' ? activeConversation.processId : null

  // Fetch dev_users contacts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) return
        const data: DevUserContact[] = await res.json()
        setContacts(data.filter((c) => c.id !== currentUserId))
      } catch {
        // silent
      } finally {
        setIsLoadingContacts(false)
      }
    }
    loadContacts()
  }, [currentUserId])

  // Debounce search
  const handleContactSearch = (value: string) => {
    setContactSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!debouncedSearch.trim()) return contacts
    const lower = debouncedSearch.toLowerCase()
    return contacts.filter((c) => {
      const nameMatch = c.commercial_name.toLowerCase().includes(lower)
      const roleMatch = c.user_roles?.some(
        (ur) => ur.role?.name?.toLowerCase().includes(lower)
      )
      return nameMatch || roleMatch
    })
  }, [contacts, debouncedSearch])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold">Conversas</h2>
      </div>

      {/* Grupo Geral — pinned */}
      <div className="px-1 shrink-0">
        <ConversationListItem
          icon={<Users className="h-4 w-4 text-primary" />}
          title="Grupo Geral"
          unreadCount={unreadCounts[INTERNAL_CHAT_CHANNEL_ID] || 0}
          isActive={isInternalActive}
          onClick={() => onSelect({ type: 'internal' })}
        />
      </div>

      <Separator className="my-2" />

      {/* Tabs */}
      <div className="px-3 shrink-0 flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'chat'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('processos')}
          className={cn(
            'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'processos'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          Processos
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
          <div className="flex flex-col gap-1">
            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => handleContactSearch(e.target.value)}
                  placeholder="Pesquisar utilizador..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="px-1 space-y-0.5">
              {isLoadingContacts ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                  </div>
                ))
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">Nenhum contacto encontrado</p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isDmActive =
                    activeConversation?.type === 'dm' &&
                    activeConversation.userId === contact.id
                  const dmChId = getDmChannelId(currentUserId, contact.id)
                  const dmUnread = unreadCounts[dmChId] || 0
                  const roles = (contact.user_roles || [])
                    .map((ur) => ur.role?.name)
                    .filter((n): n is string => Boolean(n))

                  return (
                    <button
                      type="button"
                      key={contact.id}
                      onClick={() =>
                        onSelect({
                          type: 'dm',
                          userId: contact.id,
                          userName: contact.commercial_name,
                          avatarUrl: contact.dev_consultant_profiles?.profile_photo_url || undefined,
                        })
                      }
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                        'hover:bg-muted/60',
                        isDmActive && 'bg-muted'
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        {contact.dev_consultant_profiles?.profile_photo_url && (
                          <AvatarImage
                            src={contact.dev_consultant_profiles.profile_photo_url}
                            alt={contact.commercial_name}
                          />
                        )}
                        <AvatarFallback className="text-xs bg-primary/10">
                          {contact.commercial_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('text-sm truncate', dmUnread > 0 && 'font-semibold')}>{contact.commercial_name}</span>
                          {dmUnread > 0 && (
                            <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground shrink-0">
                              {dmUnread}
                            </Badge>
                          )}
                        </div>
                        {roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {roles.map((role) => (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={cn(
                                  'text-[9px] px-1.5 py-0 h-4 font-medium border-0',
                                  getRoleColor(role)
                                )}
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="px-1">
            <ProcessChannelList
              channels={processChannels}
              isLoading={isLoadingChannels}
              activeProcessId={activeProcessId}
              onSelect={(processId) => onSelect({ type: 'process', processId })}
              onSearch={onSearchChannels}
            />
          </div>
        )}
      </div>
    </div>
  )
}
