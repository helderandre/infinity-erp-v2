'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Braces, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VariableNodeView({ node, selected, extension }: NodeViewProps) {
  const { key, isSystem } = node.attrs
  const mode = extension.options.mode || 'template'
  const onVariableClick = extension.options.onVariableClick

  const handleClick = () => {
    if (!isSystem && mode === 'template' && onVariableClick) {
      onVariableClick(key)
    }
  }

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        onClick={handleClick}
        title={isSystem ? `Variável do sistema: {{${key}}}` : `Variável: {{${key}}}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.85em] font-medium font-mono',
          'border select-all whitespace-nowrap align-baseline',
          isSystem && [
            'bg-sky-100 text-sky-700 border-sky-200',
            'dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
            'cursor-default',
          ],
          !isSystem && [
            'bg-amber-100 text-amber-800 border-amber-200',
            'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
          ],
          !isSystem &&
            mode === 'template' && [
              'cursor-pointer',
              'hover:brightness-95 hover:ring-2 hover:ring-ring',
            ],
          selected && 'ring-2 ring-offset-1',
          selected && isSystem && 'ring-sky-500',
          selected && !isSystem && 'ring-amber-500'
        )}
      >
        {isSystem ? (
          <Lock size={12} className="shrink-0" />
        ) : (
          <Braces size={12} className="shrink-0" />
        )}
        {`{{${key}}}`}
      </span>
    </NodeViewWrapper>
  )
}
