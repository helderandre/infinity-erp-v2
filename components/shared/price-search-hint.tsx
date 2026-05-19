'use client'

/**
 * Inline hint that appears when the user types a parsable price into a
 * page-level search input. Surfaces two quick-apply buttons ("até X" / "≥ X")
 * so the search input doesn't get used for what is clearly a price filter.
 *
 * Renders nothing if the query doesn't look like a price.
 */

import { Button } from '@/components/ui/button'
import { Euro, X } from 'lucide-react'
import { parsePriceInput, formatPriceShort } from '@/lib/search/parse-price'

interface PriceSearchHintProps {
  query: string
  onApplyMax: (price: number) => void
  onApplyMin: (price: number) => void
}

export function PriceSearchHint({ query, onApplyMax, onApplyMin }: PriceSearchHintProps) {
  const price = parsePriceInput(query)
  if (price === null) return null
  const formatted = formatPriceShort(price)
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/50 px-2.5 py-1 text-[11px] animate-in fade-in slide-in-from-top-1">
      <Euro className="h-3 w-3 text-amber-700 dark:text-amber-300 shrink-0" />
      <span className="text-amber-700 dark:text-amber-300 whitespace-nowrap">
        Filtrar por preço:
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 rounded-full text-[11px] font-medium border-amber-400/60 bg-white/80 hover:bg-white text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
        onClick={() => onApplyMax(price)}
      >
        até {formatted}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 rounded-full text-[11px] font-medium border-amber-400/60 bg-white/80 hover:bg-white text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
        onClick={() => onApplyMin(price)}
      >
        ≥ {formatted}
      </Button>
    </div>
  )
}
