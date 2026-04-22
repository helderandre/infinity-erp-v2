'use client'

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
}

export function CompanyCategorySelect({
  value,
  onValueChange,
  includeAllOption = false,
  placeholder = 'Categoria',
  triggerClassName,
  disabled,
}: CompanyCategorySelectProps) {
  const { activeCategories } = useCompanyCategories()

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
