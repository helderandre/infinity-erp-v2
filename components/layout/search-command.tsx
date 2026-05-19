'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon, Building2, FileSearch } from 'lucide-react'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'
import {
  InputGroup,
  InputGroupAddon,
} from '@/components/ui/input-group'
import { usePermissions } from '@/hooks/use-permissions'
import { menuItems, builderItems } from './app-sidebar'
import { parsePriceInput, formatPriceShort } from '@/lib/search/parse-price'

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { hasPermission } = usePermissions()

  // Reset query on open/close to avoid surfacing stale price shortcuts.
  useEffect(() => { if (!open) setQuery('') }, [open])

  // Intent: typing a price like "300000", "300k" or "300 000 €" surfaces
  // quick-action shortcuts to filter Imóveis and Processos by max price.
  const parsedPrice = useMemo(() => parsePriceInput(query), [query])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Listen for mobile toolbar event
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'search') setOpen(true)
    }
    window.addEventListener('open-quick-action', handler)
    return () => window.removeEventListener('open-quick-action', handler)
  }, [])

  const visibleMenuItems = menuItems.filter((item) =>
    'permission' in item ? hasPermission(item.permission as any) : true
  )

  const visibleBuilderItems = hasPermission('settings' as any)
    ? builderItems
    : []

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <>
      {/* Mobile: simple icon button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex sm:hidden h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/50 transition-colors"
      >
        <SearchIcon className="size-4 opacity-50" />
      </button>

      {/* Desktop: full search bar */}
      <InputGroup
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        className="hidden sm:flex h-8 w-56 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
        <span className="flex-1 text-left text-sm text-muted-foreground">
          Pesquisar...
        </span>
        <InputGroupAddon align="inline-end">
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded-[calc(var(--radius)-5px)] border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            Ctrl K
          </kbd>
        </InputGroupAddon>
      </InputGroup>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Pesquisar páginas"
        description="Pesquise e navegue rapidamente para qualquer página."
      >
        <Command shouldFilter={!parsedPrice}>
          <CommandInput
            placeholder="Pesquisar páginas ou escrever um preço..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
            {parsedPrice !== null && (
              <CommandGroup heading={`Filtrar por preço (${formatPriceShort(parsedPrice)})`}>
                {hasPermission('properties' as any) && (
                  <>
                    <CommandItem
                      value={`__price_imoveis_max_${parsedPrice}`}
                      onSelect={() => handleSelect(`/dashboard/imoveis?price_max=${parsedPrice}`)}
                    >
                      <Building2 className="size-4 shrink-0" />
                      <span>Imóveis até {formatPriceShort(parsedPrice)}</span>
                      <CommandShortcut>price_max</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                      value={`__price_imoveis_min_${parsedPrice}`}
                      onSelect={() => handleSelect(`/dashboard/imoveis?price_min=${parsedPrice}`)}
                    >
                      <Building2 className="size-4 shrink-0" />
                      <span>Imóveis a partir de {formatPriceShort(parsedPrice)}</span>
                      <CommandShortcut>price_min</CommandShortcut>
                    </CommandItem>
                  </>
                )}
                {hasPermission('processes' as any) && (
                  <>
                    <CommandItem
                      value={`__price_processos_max_${parsedPrice}`}
                      onSelect={() => handleSelect(`/dashboard/processos?price_max=${parsedPrice}`)}
                    >
                      <FileSearch className="size-4 shrink-0" />
                      <span>Processos até {formatPriceShort(parsedPrice)}</span>
                      <CommandShortcut>price_max</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                      value={`__price_processos_min_${parsedPrice}`}
                      onSelect={() => handleSelect(`/dashboard/processos?price_min=${parsedPrice}`)}
                    >
                      <FileSearch className="size-4 shrink-0" />
                      <span>Processos a partir de {formatPriceShort(parsedPrice)}</span>
                      <CommandShortcut>price_min</CommandShortcut>
                    </CommandItem>
                  </>
                )}
              </CommandGroup>
            )}
            <CommandGroup heading="Menu Principal">
              {visibleMenuItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.title}
                  onSelect={() => handleSelect(item.href)}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.title}</span>
                  <CommandShortcut>
                    {item.href.replace('/dashboard', '') || '/'}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {visibleBuilderItems.length > 0 && (
              <CommandGroup heading="Builder">
                {visibleBuilderItems.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.title}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
