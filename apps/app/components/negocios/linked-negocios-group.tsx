'use client'

import { Link2 } from 'lucide-react'
import { NegocioListItem, type NegocioListItemData } from './negocio-list-item'

/**
 * Renders a cluster of related négocios (same `deal_group_id` — e.g. a sale +
 * the purchase that depends on it) grouped inside a sky card with a vertical
 * connector line, so the "compra depende da venda" relationship is visible at a
 * glance in the contact's deal list.
 */
export function LinkedNegociosGroup({
  negocios,
  onSelect,
  onDelete,
}: {
  negocios: (NegocioListItemData & { id: string })[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-sky-400/30 bg-sky-500/5 p-2 space-y-2">
      <div className="flex items-center gap-1 px-1 text-[10px] font-medium text-sky-700 dark:text-sky-300">
        <Link2 className="h-3 w-3 shrink-0" /> Negócios ligados · compra depende da venda
      </div>
      <div className="relative space-y-2 pl-3">
        {/* Connector line linking the members of the group. */}
        <span aria-hidden className="absolute left-1 top-3 bottom-3 w-px bg-sky-400/50" />
        {negocios.map((neg) => (
          <NegocioListItem
            key={neg.id}
            negocio={neg}
            onSelect={() => onSelect(neg.id)}
            onDelete={() => onDelete(neg.id)}
          />
        ))}
      </div>
    </div>
  )
}
