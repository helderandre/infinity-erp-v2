interface TypingIndicatorProps {
  name?: string
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 shadow-sm">
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {name ? `${name} está a escrever...` : 'A escrever...'}
      </span>
    </div>
  )
}
