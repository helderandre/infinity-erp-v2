'use client'

import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PERSONAL_EXPENSE_CATEGORY_GROUPS, getCategoryIcon } from '@/lib/financial/personal-expense-categories'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export function CategorySelect({ value, onChange, className, placeholder = 'Categoria' }: Props) {
  const Icon = getCategoryIcon(value)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder}>
          <span className="inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{value}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PERSONAL_EXPENSE_CATEGORY_GROUPS.map((group, gi) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium px-2 pt-2 pb-1">
              {group.label}
            </SelectLabel>
            {group.items.map((item) => {
              const ItemIcon = item.icon
              return (
                <SelectItem key={item.name} value={item.name} className="pl-2">
                  <span className="inline-flex items-center gap-2">
                    <ItemIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{item.name}</span>
                  </span>
                </SelectItem>
              )
            })}
            {gi < PERSONAL_EXPENSE_CATEGORY_GROUPS.length - 1 && (
              <div className="h-px bg-border/40 my-1 mx-2" />
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
