'use client'

import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMarketingDesignCategoriesContext } from './marketing-design-categories-provider'

const ALL_VALUE = 'all'

interface MarketingDesignCategorySelectProps {
  value: string
  onValueChange: (value: string) => void
  includeAllOption?: boolean
  placeholder?: string
  triggerClassName?: string
  disabled?: boolean
  /**
   * Em viewports < sm rende apenas um ícone de filtros (sem texto), poupando
   * largura horizontal — útil em toolbars apertados (search + add + upload).
   */
  iconOnlyOnMobile?: boolean
}

export function MarketingDesignCategorySelect({
  value,
  onValueChange,
  includeAllOption = false,
  placeholder = 'Categoria',
  triggerClassName,
  disabled,
  iconOnlyOnMobile = false,
}: MarketingDesignCategorySelectProps) {
  const { activeCategories } = useMarketingDesignCategoriesContext()

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'rounded-full',
          // Mobile icon-only: esconde o SelectValue (span) e o chevron
          // (último svg) — só fica visível o SlidersHorizontal abaixo.
          // Em sm+ volta ao layout normal (texto + chevron, ícone hidden).
          iconOnlyOnMobile &&
            'justify-center sm:justify-between [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex [&>svg:last-child]:hidden sm:[&>svg:last-child]:inline-block',
          triggerClassName,
        )}
      >
        {iconOnlyOnMobile && (
          <SlidersHorizontal className="h-4 w-4 sm:hidden" aria-hidden="true" />
        )}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && (
          <SelectItem value={ALL_VALUE}>Todas as categorias</SelectItem>
        )}
        {activeCategories.map((cat) => (
          <SelectItem key={cat.id} value={cat.slug}>
            {cat.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
