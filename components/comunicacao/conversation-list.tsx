'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { User, Search, Paperclip } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ConversationListItem } from './conversation-list-item'
import { ProcessChannelList } from './process-channel-list'
import { getDmChannelId, INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'
import type { ChatLastMessage } from '@/hooks/use-chat-unread'
import type { ProcessChannelPreview } from '@/types/internal-chat'

/** Formato à WhatsApp: hoje → HH:mm; ontem → "Ontem"; resto → DD/MM/YY. */
function formatActivityLabel(iso: string | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return 'Ontem'
    return format(d, 'dd/MM/yy', { locale: pt })
  } catch {
    return ''
  }
}

function lastMessagePreview(
  msg: ChatLastMessage | undefined,
  selfId: string,
): { text: string; isAttachment: boolean; prefix: string | null } {
  if (!msg) return { text: '', isAttachment: false, prefix: null }
  const prefix = msg.sender_id === selfId ? 'Tu:' : null
  const trimmed = msg.content.trim()
  if (trimmed) {
    // Remove menção markup `@[Nome](uuid)` para o preview ficar limpo.
    const cleaned = trimmed.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    return { text: cleaned, isAttachment: false, prefix }
  }
  if (msg.has_attachments) return { text: 'Anexo', isAttachment: true, prefix }
  return { text: '', isAttachment: false, prefix }
}

export type ConversationType =
  | { type: 'internal' }
  | { type: 'dm'; userId: string; userName: string; avatarUrl?: string; roles?: string[] }
  | { type: 'process'; processId: string }

interface DevUserContact {
  id: string
  commercial_name: string
  dev_consultant_profiles: { profile_photo_url: string | null } | null
  user_roles: Array<{ role: { name: string } | null }> | null
}

interface ConversationListProps {
  currentUserId: string
  activeConversation: ConversationType | null
  onSelect: (conversation: ConversationType) => void
  processChannels: ProcessChannelPreview[]
  isLoadingChannels: boolean
  onSearchChannels: (query: string) => void
  unreadCounts?: Record<string, number>
  /** Mapa channelId → ISO timestamp da última actividade. Usado para
   *  ordenar a lista de DMs pela mais recente, à WhatsApp. */
  lastActivity?: Record<string, string>
  /** Mapa channelId → última mensagem (preview + sender + timestamp). */
  lastMessage?: Record<string, ChatLastMessage>
  /** True quando o fetch inicial de unread/lastActivity já voltou —
   * usado para evitar render do contact list em ordem alfabética
   * (fallback) e re-ordenar visivelmente quando os dados de
   * actividade chegam. Mostramos skeleton até ambos estarem prontos. */
  activityHasLoaded?: boolean
}

export function ConversationList({
  currentUserId,
  activeConversation,
  onSelect,
  processChannels,
  isLoadingChannels,
  onSearchChannels,
  unreadCounts = {},
  lastActivity = {},
  lastMessage = {},
  activityHasLoaded = false,
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

  // Filtered + sorted contacts.
  // Ordem (estilo WhatsApp/uazapi):
  //   1) Conversas com unread first, ordenadas pela última actividade desc.
  //   2) Restantes conversas com actividade conhecida, mais recentes primeiro.
  //   3) Contactos sem qualquer DM ainda — ordem alfabética como fallback.
  const filteredContacts = useMemo(() => {
    const lower = debouncedSearch.trim().toLowerCase()
    const base = lower
      ? contacts.filter((c) => {
          const nameMatch = c.commercial_name.toLowerCase().includes(lower)
          const roleMatch = c.user_roles?.some(
            (ur) => ur.role?.name?.toLowerCase().includes(lower),
          )
          return nameMatch || roleMatch
        })
      : contacts.slice()

    return base.sort((a, b) => {
      const chA = getDmChannelId(currentUserId, a.id)
      const chB = getDmChannelId(currentUserId, b.id)
      const unreadA = unreadCounts[chA] || 0
      const unreadB = unreadCounts[chB] || 0
      // Bucket 1: unread descending
      if (unreadA !== unreadB && (unreadA > 0 || unreadB > 0)) {
        if (unreadA > 0 && unreadB === 0) return -1
        if (unreadB > 0 && unreadA === 0) return 1
        // Ambos com unread → desempata por actividade mais recente
      }
      const actA = lastActivity[chA]
      const actB = lastActivity[chB]
      if (actA && actB) {
        return new Date(actB).getTime() - new Date(actA).getTime()
      }
      if (actA && !actB) return -1
      if (!actA && actB) return 1
      // Sem histórico → alfabético
      return a.commercial_name.localeCompare(b.commercial_name, 'pt')
    })
  }, [contacts, debouncedSearch, unreadCounts, lastActivity, currentUserId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold">Conversas</h2>
      </div>

      {/* Grupo Geral — pinned. Layout idêntico aos DMs (avatar, nome, hora,
          preview) mas com a logo Infinity Group como avatar. */}
      <div className="px-1 shrink-0">
        {(() => {
          const geralUnread = unreadCounts[INTERNAL_CHAT_CHANNEL_ID] || 0
          const geralLastMsg = lastMessage[INTERNAL_CHAT_CHANNEL_ID]
          const geralActivity = lastActivity[INTERNAL_CHAT_CHANNEL_ID]
          const geralTime = formatActivityLabel(geralActivity)
          const geralPreview = lastMessagePreview(geralLastMsg, currentUserId)
          return (
            <button
              type="button"
              onClick={() => onSelect({ type: 'internal' })}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                'hover:bg-muted/60',
                isInternalActive && 'bg-muted',
              )}
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                <img
                  src="/icon-512.png"
                  alt="Infinity Group"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'text-sm truncate',
                      geralUnread > 0 && 'font-semibold',
                    )}
                  >
                    Grupo Geral
                  </span>
                  {geralTime && (
                    <span
                      className={cn(
                        'text-[10px] shrink-0',
                        geralUnread > 0 ? 'text-primary font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {geralTime}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  {geralPreview.text || geralPreview.isAttachment ? (
                    <span
                      className={cn(
                        'text-[11px] truncate min-w-0',
                        geralUnread > 0
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {geralPreview.prefix && (
                        <span className="text-muted-foreground/80 mr-1">
                          {geralPreview.prefix}
                        </span>
                      )}
                      {geralPreview.isAttachment && (
                        <Paperclip className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                      )}
                      {geralPreview.text}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/70 truncate">
                      Canal interno da equipa
                    </span>
                  )}
                  {geralUnread > 0 && (
                    <Badge className="ml-auto h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-primary text-primary-foreground shrink-0">
                      {geralUnread}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          )
        })()}
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
              {/* Esperamos por contactos AND last-activity antes de
                  render — sem isto a lista mostrava ordem alfabética
                  por meio segundo e re-ordenava por actividade quando
                  o fetch /unread chegava (visualmente "salta"). */}
              {isLoadingContacts || !activityHasLoaded ? (
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
                  const lastMsg = lastMessage[dmChId]
                  const activityTs = lastActivity[dmChId]
                  const timeLabel = formatActivityLabel(activityTs)
                  const preview = lastMessagePreview(lastMsg, currentUserId)

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
                          roles,
                        })
                      }
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                        'hover:bg-muted/60',
                        isDmActive && 'bg-muted',
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
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
                      {/* Layout WhatsApp: nome + hora no topo, role + preview no fundo. */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              'text-sm truncate',
                              dmUnread > 0 && 'font-semibold',
                            )}
                          >
                            {contact.commercial_name}
                          </span>
                          {timeLabel && (
                            <span
                              className={cn(
                                'text-[10px] shrink-0',
                                dmUnread > 0 ? 'text-primary font-medium' : 'text-muted-foreground',
                              )}
                            >
                              {timeLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                          {preview.text || preview.isAttachment ? (
                            <span
                              className={cn(
                                'text-[11px] truncate min-w-0',
                                dmUnread > 0
                                  ? 'text-foreground font-medium'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {preview.prefix && (
                                <span className="text-muted-foreground/80 mr-1">{preview.prefix}</span>
                              )}
                              {preview.isAttachment && (
                                <Paperclip className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                              )}
                              {preview.text}
                            </span>
                          ) : null}
                          {dmUnread > 0 && (
                            <Badge className="ml-auto h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-primary text-primary-foreground shrink-0">
                              {dmUnread}
                            </Badge>
                          )}
                        </div>
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
