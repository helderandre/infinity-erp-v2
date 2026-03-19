'use client'

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { MessageStatus } from './message-status'
import { MessageQuoted } from './message-quoted'
import { MessageMediaRenderer } from './message-media-renderer'
import { MessageReactions } from './message-reactions'
import { MessageContextMenu } from './message-context-menu'
import { Badge } from '@/components/ui/badge'
import { MessageText } from './message-text'
import type { WppMessage, QuotedMessageMap } from '@/lib/types/whatsapp-web'

// Consistent color palette for sender names in groups
const SENDER_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-purple-600 dark:text-purple-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-teal-600 dark:text-teal-400',
  'text-indigo-600 dark:text-indigo-400',
  'text-rose-600 dark:text-rose-400',
  'text-amber-600 dark:text-amber-400',
  'text-cyan-600 dark:text-cyan-400',
  'text-lime-600 dark:text-lime-400',
  'text-fuchsia-600 dark:text-fuchsia-400',
]

function getSenderColor(sender: string): string {
  let hash = 0
  for (let i = 0; i < sender.length; i++) {
    hash = ((hash << 5) - hash + sender.charCodeAt(i)) | 0
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length]
}

interface MessageBubbleProps {
  message: WppMessage
  quotedMessage?: QuotedMessageMap[string]
  onReply: () => void
  onReact: (emoji: string) => void
  onDelete: (forEveryone?: boolean) => void
  onForward: () => void
  onSelect?: () => void
  onSaveToErp?: () => void
  onSenderClick?: (sender: string, senderName: string) => void
  hasErpContact?: boolean
  showSenderName?: boolean
  isAdmin?: boolean
  instanceId?: string
  /** Map of lid → display name for resolving @mentions */
  mentionMap?: Record<string, string>
}

export function MessageBubble({
  message,
  quotedMessage,
  onReply,
  onReact,
  onDelete,
  onForward,
  onSelect,
  onSaveToErp,
  onSenderClick,
  hasErpContact,
  showSenderName,
  isAdmin,
  instanceId,
  mentionMap,
}: MessageBubbleProps) {
  const isMe = message.from_me
  const time = format(new Date(message.timestamp * 1000), 'HH:mm')
  const senderColor = message.sender ? getSenderColor(message.sender) : 'text-primary'
  const hasMedia = message.message_type !== 'text' && message.message_type !== 'location' && message.message_type !== 'contact'

  return (
    <div className={cn('flex mb-1 group', isMe ? 'justify-end' : 'justify-start')}>
      <div className={cn('relative max-w-[65%]', hasMedia && 'w-fit')}>
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
            <button
              type="button"
              onClick={() => onSenderClick?.(message.sender || '', message.sender_name || '')}
              className={cn('text-xs font-semibold mb-0.5 hover:underline cursor-pointer text-left', senderColor)}
            >
              {message.sender_name}
            </button>
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
                  <MessageMediaRenderer message={message} instanceId={instanceId} />
                )}

                {/* Text */}
                {message.text && <MessageText text={message.text} mentionMap={mentionMap} />}
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
          isMe={isMe}
          onReply={onReply}
          onReact={onReact}
          onDelete={onDelete}
          onForward={onForward}
          onSelect={onSelect}
          onSaveToErp={onSaveToErp}
          hasErpContact={hasErpContact}
        />
      </div>
    </div>
  )
}
