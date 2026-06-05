'use client'

/**
 * StageTag — pastel-gradient pill that mirrors the kanban column header
 * design (see [components/crm/kanban-board.tsx]). Used in the CRM list /
 * table views, the negócio detail sheet, and anywhere a pipeline stage
 * needs to be displayed as a compact tag with its colour identity.
 *
 * Props:
 *   - name        : the stage display name (e.g. "Estudo de Mercado")
 *   - color       : hex (#RRGGBB) from leads_pipeline_stages.color, or
 *                   nullable — falls back to a neutral slate
 *   - size        : 'sm' (table cells) | 'md' (cards / sheets, default)
 */

interface StageTagProps {
  name: string
  color?: string | null
  size?: 'sm' | 'md'
}

export function StageTag({ name, color, size = 'md' }: StageTagProps) {
  const c = color || '#64748b'
  const sizeClass =
    size === 'sm'
      ? 'gap-1 px-2 py-0.5 text-[10px]'
      : 'gap-1.5 px-2.5 py-0.5 text-[11px]'
  const dotSize = size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${sizeClass}`}
      style={{
        // Soft pastel gradient + tinted ring, same recipe as the kanban
        // column header in components/crm/kanban-board.tsx.
        backgroundImage: `linear-gradient(to right, ${c}33, ${c}1a)`,
        color: c,
        boxShadow: `inset 0 0 0 1px ${c}40`,
      }}
    >
      <span
        className={`${dotSize} rounded-full shrink-0`}
        style={{ backgroundColor: c }}
      />
      {name}
    </span>
  )
}
