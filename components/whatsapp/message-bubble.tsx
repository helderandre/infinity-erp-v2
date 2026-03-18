'use client'

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { MessageStatus } from './message-status'
import { MessageQuoted } from './message-quoted'
import { MessageMediaRenderer } from './message-media-renderer'
import { MessageReactions } from './message-reactions'
import { MessageContextMenu } from './message-context-menu'
import { Badge } from '@/components/ui/badge'
import type { WppMessage, QuotedMessageMap } from '@/lib/types/whatsapp-web'

interface MessageBubbleProps {
  message: WppMessage
  quotedMessage?: QuotedMessageMap[string]
  onReply: () => void
  onReact: (emoji: string) => void
  onDelete: (forEveryone?: boolean) => void
  onForward: () => void
  showSenderName?: boolean
  isAdmin?: boolean
}

export function MessageBubble({
  message,
  quotedMessage,
  onReply,
  onReact,
  onDelete,
  onForward,
  showSenderName,
  isAdmin,
}: MessageBubbleProps) {
  const isMe = message.from_me
  const time = format(new Date(message.timestamp * 1000), 'HH:mm')

  return (
    <div className={cn('flex mb-1 group', isMe ? 'justify-end' : 'justify-start')}>
      <div className="relative max-w-[65%]">
        <div
          className={cn(
            'rounded-lg px-2.5 py-1.5 shadow-sm',
            isMe
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : 'bg-white dark:bg-zinc-800'
          )}
        >
          {/* Sender Name (groups) */}
          {showSenderName && !isMe && message.sender_name && (
            <div className="text-xs font-semibold text-primary mb-0.5">
              {message.sender_name}
            </div>
          )}

          {/* Forwarded indicator */}
          {message.is_forwarded && (
            <div className="text-[11px] text-muted-foreground italic mb-0.5">
              Reencaminhada
            </div>
          )}

          {/* Quoted message */}
          {quotedMessage && <MessageQuoted quoted={quotedMessage} />}

          {/* Deleted message */}
          {message.is_deleted && !isAdmin ? (
            <p className="text-sm italic text-muted-foreground">
              Esta mensagem foi apagada
            </p>
          ) : (
            <>
              {/* Admin: deleted badge */}
              {message.is_deleted && isAdmin && (
                <Badge variant="destructive" className="text-[10px] mb-1">
                  Apagada
                </Badge>
              )}

              {/* Media */}
              <div className={message.is_deleted && isAdmin ? 'opacity-50' : ''}>
                {message.message_type !== 'text' && (
                  <MessageMediaRenderer message={message} />
                )}

                {/* Text */}
                {message.text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.text}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Footer: time + status */}
          <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
            {message.is_edited && (
              <span className="text-[10px] text-muted-foreground">editada</span>
            )}
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {isMe && <MessageStatus status={message.status} />}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <MessageReactions reactions={message.reactions} onReact={onReact} />
        )}

        {/* Context menu trigger */}
        <MessageContextMenu
          message={message}
          onReply={onReply}
          onReact={onReact}
          onDelete={onDelete}
          onForward={onForward}
        />
      </div>
    </div>
  )
}
