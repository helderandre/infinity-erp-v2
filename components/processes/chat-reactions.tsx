'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { ChatReaction } from '@/types/process'

interface ChatReactionsProps {
  reactions: ChatReaction[]
  currentUserId: string
  onToggle: (emoji: string) => void
  inline?: boolean
}

interface ReactorEntry {
  user_id: string
  user_name: string
}

/**
 * Renders existing reactions next to the sender/time row. Clicking a chip
 * opens a Popover listing the reactors (com "Tu" no próprio utilizador) e
 * permite remover a reacção quando feita pelo utilizador actual — não
 * mais toggle silencioso ao clique. Add-new-reaction controls live em
 * baixo da bubble (Smile popover + chevron-menu).
 */
export function ChatReactions({ reactions, currentUserId, onToggle, inline }: ChatReactionsProps) {
  // Group reactions by emoji
  const grouped = new Map<string, { count: number; reactors: ReactorEntry[]; hasCurrentUser: boolean }>()
  for (const r of reactions) {
    const userName = r.user?.commercial_name || 'Utilizador'
    const existing = grouped.get(r.emoji)
    if (existing) {
      existing.count++
      existing.reactors.push({ user_id: r.user_id, user_name: userName })
      if (r.user_id === currentUserId) existing.hasCurrentUser = true
    } else {
      grouped.set(r.emoji, {
        count: 1,
        reactors: [{ user_id: r.user_id, user_name: userName }],
        hasCurrentUser: r.user_id === currentUserId,
      })
    }
  }

  if (grouped.size === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${inline ? '' : 'mt-1'}`}>
      {Array.from(grouped.entries()).map(([emoji, { count, hasCurrentUser, reactors }]) => (
        <Popover key={emoji}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted ${
                hasCurrentUser ? 'bg-primary/10 border-primary/30' : ''
              }`}
              title="Ver quem reagiu"
            >
              {emoji} {count}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className="w-56 p-2"
          >
            <div className="flex items-center gap-2 px-1 pb-1.5 border-b mb-1.5">
              <span className="text-base leading-none">{emoji}</span>
              <span className="text-[11px] text-muted-foreground">
                {count} {count === 1 ? 'reacção' : 'reacções'}
              </span>
            </div>
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {reactors.map((r) => (
                <li
                  key={r.user_id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60"
                >
                  <span className="truncate">{r.user_name}</span>
                  {r.user_id === currentUserId && (
                    <span className="text-[10px] text-muted-foreground shrink-0">Tu</span>
                  )}
                </li>
              ))}
            </ul>
            {hasCurrentUser && (
              <>
                <div className="border-t my-1.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 justify-start text-[11px] text-muted-foreground hover:text-destructive"
                  onClick={() => onToggle(emoji)}
                >
                  <X className="h-3 w-3 mr-1.5" />
                  Remover a minha reacção
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
}
