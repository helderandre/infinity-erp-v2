'use client'

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
}

export function MarketingDesignCategorySelect({
  value,
  onValueChange,
  includeAllOption = false,
  placeholder = 'Categoria',
  triggerClassName,
  disabled,
}: MarketingDesignCategorySelectProps) {
  const { activeCategories } = useMarketingDesignCategoriesContext()

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('rounded-full', triggerClassName)}>
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
