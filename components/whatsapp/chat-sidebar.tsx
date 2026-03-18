'use client'

import { useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { useWhatsAppChats } from '@/hooks/use-whatsapp-chats'
import { InstanceSelector } from './instance-selector'
import { ChatListItem } from './chat-list-item'

interface Instance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
}

interface ChatSidebarProps {
  instances: Instance[]
  selectedInstance: string
  onInstanceChange: (id: string) => void
  selectedChatId: string | null
  onChatSelect: (id: string) => void
}

export function ChatSidebar({
  instances,
  selectedInstance,
  onInstanceChange,
  selectedChatId,
  onChatSelect,
}: ChatSidebarProps) {
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all')
  const [isSyncing, setIsSyncing] = useState(false)
  const debouncedSearch = useDebounce(searchInput, 300)

  const { chats, isLoading, refetch } = useWhatsAppChats({
    instanceId: selectedInstance || null,
    search: debouncedSearch || undefined,
    archived: false,
  })

  async function handleSyncChats() {
    if (!selectedInstance || isSyncing) return

    setIsSyncing(true)
    const toastId = toast.loading('A sincronizar conversas...')
    try {
      const res = await fetch(`/api/whatsapp/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_chats', instance_id: selectedInstance }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao sincronizar')
      }

      const data = await res.json()
      toast.success(`Conversas sincronizadas (${data.synced ?? 0} actualizadas)`, { id: toastId })
      refetch()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar conversas'
      toast.error(message, { id: toastId })
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredChats = chats.filter((chat) => {
    if (filter === 'unread') return chat.unread_count > 0
    if (filter === 'groups') return chat.is_group
    return true
  })

  return (
    <div className="flex flex-col h-full">
      {/* Instance Selector + Sync */}
      <div className="border-b flex items-center">
        <div className="flex-1">
          <InstanceSelector
            instances={instances}
            value={selectedInstance}
            onChange={onInstanceChange}
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mr-2 flex-shrink-0"
              onClick={handleSyncChats}
              disabled={!selectedInstance || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Sincronizar conversas</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversas..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-2 pb-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="all" className="flex-1 text-xs">Todos</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 text-xs">Não lidos</TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 text-xs">Grupos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedChatId}
              onClick={() => onChatSelect(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
