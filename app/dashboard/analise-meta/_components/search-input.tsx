import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

/**
 * Server-component search input — funciona via <form method="get">
 * sem necessidade de JS. O pathname é passado pelo caller (action attr).
 */
export function MetaSearchInput({
  defaultValue,
  placeholder,
  action,
  name = 'q',
}: {
  defaultValue?: string
  placeholder: string
  action: string
  name?: string
}) {
  return (
    <form action={action} className="relative max-w-sm flex-1">
      <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-8"
        autoComplete="off"
      />
    </form>
  )
}
