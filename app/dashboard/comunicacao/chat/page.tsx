'use client'

import { useState, useMemo } from 'react'
import { MessageSquare, ArrowLeft, User } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { useProcessChannels } from '@/hooks/use-process-channels'
import { useInternalChatPresence } from '@/hooks/use-internal-chat-presence'
import { ConversationList, type ConversationType } from '@/components/comunicacao/conversation-list'
import { InternalChatPanel } from '@/components/comunicacao/internal-chat-panel'
import { InternalChatHeader } from '@/components/comunicacao/internal-chat-header'
import { ProcessChatHeader } from '@/components/comunicacao/process-chat-header'
import { ProcessChat } from '@/components/processes/process-chat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getDmChannelId } from '@/lib/constants'

export default function ChatPage() {
  const { user, loading: userLoading } = useUser()
  const { channels, isLoading: channelsLoading, searchChannels } = useProcessChannels()
  const [activeConversation, setActiveConversation] = useState<ConversationType | null>({
    type: 'internal',
  })

  const currentUser = useMemo(
    () => ({
      id: user?.id || '',
      name: user?.commercial_name || '',
      avatarUrl: user?.profile_photo_url || undefined,
    }),
    [user]
  )

  const { onlineUsers } = useInternalChatPresence(currentUser)

  // Get active process details for header
  const activeProcessChannel = useMemo(() => {
    if (activeConversation?.type !== 'process') return null
    return channels.find((ch) => ch.proc_instance_id === activeConversation.processId) || null
  }, [activeConversation, channels])

  // Get DM channel ID
  const dmChannelId = useMemo(() => {
    if (activeConversation?.type !== 'dm') return undefined
    return getDmChannelId(currentUser.id, activeConversation.userId)
  }, [activeConversation, currentUser.id])

  if (userLoading) {
    return (
      <div className="flex h-full bg-background overflow-hidden">
        <div className="w-80 border-r p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left sidebar — conversation list */}
      <div
        className={cn(
          'w-full md:w-80 md:border-r shrink-0 flex flex-col',
          activeConversation ? 'hidden md:flex' : 'flex'
        )}
      >
        <ConversationList
          currentUserId={currentUser.id}
          activeConversation={activeConversation}
          onSelect={setActiveConversation}
          processChannels={channels}
          isLoadingChannels={channelsLoading}
          onSearchChannels={searchChannels}
        />
      </div>

      {/* Right panel — chat */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !activeConversation ? 'hidden md:flex' : 'flex'
        )}
      >
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Seleccione uma conversa</p>
          </div>
        ) : activeConversation.type === 'internal' ? (
          <InternalChatPanel
            currentUser={currentUser}
            header={
              <InternalChatHeader
                onlineUsers={onlineUsers}
                currentUserId={currentUser.id}
              />
            }
          />
        ) : activeConversation.type === 'dm' ? (
          <InternalChatPanel
            key={dmChannelId}
            currentUser={currentUser}
            channelId={dmChannelId}
            header={
              <DmChatHeader
                userName={activeConversation.userName}
                avatarUrl={activeConversation.avatarUrl}
                onBack={() => setActiveConversation(null)}
              />
            }
          />
        ) : (
          <div className="flex flex-col h-full">
            <ProcessChatHeader
              processId={activeConversation.processId}
              externalRef={activeProcessChannel?.external_ref || ''}
              propertyTitle={activeProcessChannel?.property_title}
              onBack={() => setActiveConversation(null)}
            />
            <div className="flex-1 min-h-0">
              <ProcessChat
                processId={activeConversation.processId}
                currentUser={currentUser}
                hideHeader
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DmChatHeader({
  userName,
  avatarUrl,
  onBack,
}: {
  userName: string
  avatarUrl?: string
  onBack: () => void
}) {
  return (
    <div className="border-b px-4 py-2.5 flex items-center gap-3 shrink-0">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Avatar className="h-9 w-9">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
        <AvatarFallback className="text-xs bg-primary/10">
          {userName?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      <div>
        <h3 className="text-sm font-semibold">{userName}</h3>
        <p className="text-[11px] text-muted-foreground">Mensagem directa</p>
      </div>
    </div>
  )
}
