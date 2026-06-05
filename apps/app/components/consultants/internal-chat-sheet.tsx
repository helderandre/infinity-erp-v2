'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { getDmChannelId } from '@/lib/constants'
import { InternalChatPanel } from '@/components/comunicacao/internal-chat-panel'

interface InternalChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientId: string
  recipientName: string
}

export function InternalChatSheet({ open, onOpenChange, recipientId, recipientName }: InternalChatSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()

  const currentUser = useMemo(
    () => ({
      id: user?.id || '',
      name: user?.commercial_name || '',
      avatarUrl: user?.profile_photo_url || undefined,
    }),
    [user],
  )

  const dmChannelId = useMemo(
    () => (user?.id && recipientId ? getDmChannelId(user.id, recipientId) : undefined),
    [user?.id, recipientId],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}
        <SheetTitle className="sr-only">Chat interno com {recipientName}</SheetTitle>
        <SheetDescription className="sr-only">Conversa direta com {recipientName}.</SheetDescription>
        {!user || !dmChannelId ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className={cn('flex-1 min-h-0 flex flex-col', isMobile && 'pt-6')}>
            <InternalChatPanel
              currentUser={currentUser}
              channelId={dmChannelId}
              dmRecipientId={recipientId}
              header={
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{recipientName}</p>
                    <p className="text-[11px] text-muted-foreground">Chat interno</p>
                  </div>
                </div>
              }
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
