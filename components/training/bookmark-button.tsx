'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Bookmark, BookmarkCheck } from 'lucide-react'

interface BookmarkButtonProps {
  isBookmarked: boolean
  onToggle: () => void
  className?: string
}

export function BookmarkButton({ isBookmarked, onToggle, className }: BookmarkButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'transition-colors',
        isBookmarked && 'text-amber-500 hover:text-amber-600',
        className
      )}
      aria-label={isBookmarked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-5 w-5 fill-current" />
      ) : (
        <Bookmark className="h-5 w-5" />
      )}
    </Button>
  )
}
