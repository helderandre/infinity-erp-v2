'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverAnchor, PopoverContent,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from '@/components/ui/command'
import { useDebounce } from '@/hooks/use-debounce'

export type DivisionType = 'freguesia' | 'concelho' | 'distrito'

export interface DivisionPick {
  freguesia: string | null
  concelho: string | null
  distrito: string | null
}

interface Props {
  value: string
  type: DivisionType
  onChange: (value: string) => void
  /**
   * Disparado quando o utilizador escolhe uma sugestão. Inclui a hierarquia
   * resolvida — o pai/avô só preenche campos vazios (não destrói valores
   * que o utilizador já digitou). Cabe ao caller passar `getCurrent` para
   * decidir, ou simplesmente preencher tudo se preferir.
   */
  onPick: (pick: DivisionPick) => void
  placeholder?: string
  className?: string
}

interface SearchResult {
  id: string
  name: string
  type: DivisionType
  freguesia: string | null
  concelho: string | null
  distrito: string | null
}

/**
 * Input com autocomplete contra `admin_areas` (Continental). Quando o
 * utilizador escolhe uma sugestão, devolve a hierarquia já resolvida
 * para o caller poder auto-preencher campos vazios (concelho/distrito
 * a partir da freguesia, etc.).
 *
 * Visualmente igual ao `LocationAutocompleteInput` (Mapbox) para manter
 * consistência ao longo da app.
 */
export function AdminDivisionAutocomplete({
  value,
  type,
  onChange,
  onPick,
  placeholder,
  className,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debouncedQuery = useDebounce(value, 200)
  // Após uma escolha, guardamos o nome escolhido. O effect só dispara
  // pesquisa quando o `debouncedQuery` divergir desse nome — assim o
  // popover não reabre sozinho depois do pick. O ref limpa-se mal o
  // utilizador continue a digitar (alterando o valor do input).
  const pickedValueRef = useRef<string | null>(null)

  useEffect(() => {
    const q = (debouncedQuery || '').trim()
    if (q.length < 2) {
      setResults([])
      setPopoverOpen(false)
      return
    }
    if (pickedValueRef.current && q === pickedValueRef.current) {
      // Acabámos de aceitar uma sugestão e o utilizador não digitou nada
      // novo — não reabrir.
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetch(
      `/api/admin-divisions/search?q=${encodeURIComponent(q)}&type=${type}&limit=8`,
      { cache: 'no-store' }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchResult[] | { error?: string }) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setResults(list)
        if (list.length > 0) setPopoverOpen(true)
        else setPopoverOpen(false)
      })
      .catch(() => {
        if (!cancelled) {
          setResults([])
          setPopoverOpen(false)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, type])

  const handlePick = (r: SearchResult) => {
    pickedValueRef.current = r.name
    onChange(r.name)
    onPick({
      freguesia: r.freguesia,
      concelho: r.concelho,
      distrito: r.distrito,
    })
    setResults([])
    setPopoverOpen(false)
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            // Se o utilizador digitar algo diferente do último pick, limpa
            // o ref para reactivar a pesquisa.
            if (pickedValueRef.current && v !== pickedValueRef.current) {
              pickedValueRef.current = null
            }
            onChange(v)
          }}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>{isLoading ? 'A pesquisar…' : 'Sem resultados.'}</CommandEmpty>
            <CommandGroup>
              {results.map((r) => {
                const sub = [
                  r.type === 'freguesia' ? r.concelho : null,
                  r.type !== 'distrito' ? r.distrito : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <CommandItem
                    key={r.id}
                    value={`${r.name} ${sub}`}
                    onSelect={() => handlePick(r)}
                  >
                    <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{r.name}</span>
                    {sub && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {sub}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
