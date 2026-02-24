'use client'

import type { ChatMessage } from '@/types/process'

interface ChatReplyPreviewProps {
  parentMessage: ChatMessage['parent_message']
}

export function ChatReplyPreview({ parentMessage }: ChatReplyPreviewProps) {
  if (!parentMessage || Array.isArray(parentMessage) || !parentMessage.content) return null

  const excerpt =
    parentMessage.content.length > 100
      ? parentMessage.content.slice(0, 100) + '...'
      : parentMessage.content

  return (
    <div className="border-l-2 border-primary/30 pl-2 mb-1">
      <span className="text-xs font-medium">
        {parentMessage.sender?.commercial_name || 'Utilizador'}
      </span>{' '}
      <span className="text-xs text-muted-foreground truncate">{excerpt}</span>
    </div>
  )
}
