'use client'

import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useState } from 'react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

const COMMON_EMOJIS = [
  '😀', '😂', '🤣', '😍', '🥰', '😘', '😊', '😉',
  '🤔', '😅', '😢', '😭', '😱', '😡', '🤮', '🤢',
  '👍', '👎', '👏', '🙏', '🤝', '💪', '✌️', '🤞',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🎉', '🎊', '🔥', '⭐', '💯', '✅', '❌', '⚡',
]

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (emoji: string) => {
    onSelect(emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
          <Smile className="h-4.5 w-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[280px] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-8 gap-0.5">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
