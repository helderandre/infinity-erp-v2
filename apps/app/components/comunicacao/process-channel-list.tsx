'use client'

import { useEffect, useRef, useState } from 'react'
import { FileStack, Search, Inbox } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConversationListItem } from './conversation-list-item'
import type { ProcessChannelPreview } from '@/types/internal-chat'

interface ProcessChannelListProps {
  channels: ProcessChannelPreview[]
  isLoading: boolean
  activeProcessId: string | null
  onSelect: (processId: string) => void
  onSearch: (query: string) => void
}

export function ProcessChannelList({
  channels,
  isLoading,
  activeProcessId,
  onSelect,
  onSearch,
}: ProcessChannelListProps) {
  const [searchValue, setSearchValue] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearch(value)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-1">
      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Pesquisar processo..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2 px-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Inbox className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-xs">Nenhum processo encontrado</p>
        </div>
      ) : (
        channels.map((ch) => (
          <ConversationListItem
            key={ch.proc_instance_id}
            icon={<FileStack className="h-4 w-4 text-muted-foreground" />}
            title={ch.external_ref}
            subtitle={ch.property_title || undefined}
            preview={
              ch.last_message
                ? `${ch.last_message.sender_name}: ${ch.last_message.content}`
                : undefined
            }
            timestamp={ch.last_message?.created_at}
            unreadCount={ch.unread_count}
            isActive={activeProcessId === ch.proc_instance_id}
            onClick={() => onSelect(ch.proc_instance_id)}
          />
        ))
      )}
    </div>
  )
}
