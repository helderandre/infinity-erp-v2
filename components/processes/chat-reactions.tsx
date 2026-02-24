'use client'

import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CHAT_EMOJI_QUICK } from '@/lib/constants'
import type { ChatReaction } from '@/types/process'

interface ChatReactionsProps {
  reactions: ChatReaction[]
  currentUserId: string
  onToggle: (emoji: string) => void
}

export function ChatReactions({ reactions, currentUserId, onToggle }: ChatReactionsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Group reactions by emoji
  const grouped = new Map<string, { count: number; userIds: string[]; hasCurrentUser: boolean }>()
  for (const r of reactions) {
    const existing = grouped.get(r.emoji)
    if (existing) {
      existing.count++
      existing.userIds.push(r.user_id)
      if (r.user_id === currentUserId) existing.hasCurrentUser = true
    } else {
      grouped.set(r.emoji, {
        count: 1,
        userIds: [r.user_id],
        hasCurrentUser: r.user_id === currentUserId,
      })
    }
  }

  if (grouped.size === 0 && !popoverOpen) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Array.from(grouped.entries()).map(([emoji, { count, hasCurrentUser }]) => (
        <button
          key={emoji}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted ${
            hasCurrentUser ? 'bg-primary/10 border-primary/30' : ''
          }`}
          onClick={() => onToggle(emoji)}
        >
          {emoji} {count}
        </button>
      ))}

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" side="top">
          <div className="flex gap-1">
            {CHAT_EMOJI_QUICK.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-base"
                onClick={() => {
                  onToggle(emoji)
                  setPopoverOpen(false)
                }}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
