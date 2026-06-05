'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompanyCategories } from './company-categories-provider'

interface CompanyCategoryAddButtonProps {
  onClick: () => void
  /** Label shown on larger viewports. Icon-only on mobile. */
  label?: string
  title?: string
  className?: string
}

export function CompanyCategoryAddButton({
  onClick,
  label = 'Nova categoria',
  title = 'Criar nova categoria',
  className,
}: CompanyCategoryAddButtonProps) {
  const { canManage } = useCompanyCategories()
  if (!canManage) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className={className ?? 'rounded-full gap-1.5 h-9 px-3'}
      onClick={onClick}
      title={title}
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
