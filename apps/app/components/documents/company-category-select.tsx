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
import { useCompanyCategories } from './company-categories-provider'

const ALL_VALUE = 'all'

interface CompanyCategorySelectProps {
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

export function CompanyCategorySelect({
  value,
  onValueChange,
  includeAllOption = false,
  placeholder = 'Categoria',
  triggerClassName,
  disabled,
  iconOnlyOnMobile = false,
}: CompanyCategorySelectProps) {
  const { activeCategories } = useCompanyCategories()

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'rounded-full',
          // Mobile icon-only: esconde SelectValue (span) e chevron
          // (último svg). Só fica visível o SlidersHorizontal.
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
