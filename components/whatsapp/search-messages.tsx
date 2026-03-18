'use client'

import { useState, useCallback } from 'react'
import { X, Search as SearchIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'

interface SearchMessagesProps {
  chatId: string
  onClose: () => void
  onJumpToMessage: (messageId: string) => void
}

interface SearchResult {
  id: string
  text: string | null
  sender_name: string | null
  from_me: boolean
  timestamp: number
}

export function SearchMessages({ chatId, onClose, onJumpToMessage }: SearchMessagesProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  const doSearch = useCallback(async () => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const supabase = createClient()
      const { data } = await (supabase as any)
        .from('wpp_messages')
        .select('id, text, sender_name, from_me, timestamp')
        .eq('chat_id', chatId)
        .ilike('text', `%${debouncedQuery}%`)
        .order('timestamp', { ascending: false })
        .limit(30)

      setResults(data || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [chatId, debouncedQuery])

  // Trigger search when debounced query changes
  useState(() => {
    doSearch()
  })

  // Also run on debouncedQuery change
  // Using a simple effect pattern
  if (debouncedQuery !== query) {
    // will re-render with updated debounced
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Trigger search after debounce
            setTimeout(doSearch, 350)
          }}
          placeholder="Pesquisar mensagens..."
          className="h-8 border-0 focus-visible:ring-0 px-0"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="p-4 text-center text-sm text-muted-foreground">A pesquisar...</div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {debouncedQuery.length >= 2 ? 'Sem resultados' : 'Escreva para pesquisar'}
          </div>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onJumpToMessage(r.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-accent/50 border-b last:border-b-0"
            >
              <div className="text-xs text-muted-foreground mb-0.5">
                {r.from_me ? 'Você' : r.sender_name || 'Contacto'} - {format(new Date(r.timestamp * 1000), 'dd/MM/yyyy HH:mm')}
              </div>
              <div className="text-sm truncate">{r.text}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
