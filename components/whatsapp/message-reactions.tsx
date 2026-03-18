'use client'

import type { WppReaction } from '@/lib/types/whatsapp-web'
import { cn } from '@/lib/utils'

interface MessageReactionsProps {
  reactions: WppReaction[]
  onReact: (emoji: string) => void
}

interface GroupedReaction {
  emoji: string
  count: number
  hasMine: boolean
}

export function MessageReactions({ reactions, onReact }: MessageReactionsProps) {
  // Group reactions by emoji
  const grouped: GroupedReaction[] = []
  const map = new Map<string, GroupedReaction>()

  for (const r of reactions) {
    const existing = map.get(r.emoji)
    if (existing) {
      existing.count++
      if (r.from_me) existing.hasMine = true
    } else {
      const g = { emoji: r.emoji, count: 1, hasMine: r.from_me }
      map.set(r.emoji, g)
      grouped.push(g)
    }
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => onReact(g.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
            g.hasMine
              ? 'bg-primary/10 border-primary/30 hover:bg-primary/20'
              : 'bg-muted border-transparent hover:bg-muted/80'
          )}
        >
          <span>{g.emoji}</span>
          {g.count > 1 && <span className="text-[10px] text-muted-foreground">{g.count}</span>}
        </button>
      ))}
    </div>
  )
}
