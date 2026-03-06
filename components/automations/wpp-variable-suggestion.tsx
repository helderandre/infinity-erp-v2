'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { Braces } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VariableItem } from '@/components/automations/variable-picker'

// ── Plugin Key ──

export const VariableMentionPluginKey = new PluginKey('variable-mention')

// ── Extension ──

export const VariableMention = Extension.create<{
  suggestion: Partial<SuggestionOptions<VariableItem>>
}>({
  name: 'variableMention',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        pluginKey: VariableMentionPluginKey,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertVariable(props.key, false)
            .run()
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

// ── Category labels ──

const CATEGORY_LABELS: Record<string, string> = {
  lead: 'Lead',
  imovel: 'Imovel',
  consultor: 'Consultor',
  proprietario: 'Proprietario',
  negocio: 'Negocio',
  processo: 'Processo',
  sistema: 'Sistema',
  webhook: 'Webhook',
}

const CATEGORY_ORDER: Record<string, number> = {
  lead: 0,
  imovel: 1,
  consultor: 2,
  proprietario: 3,
  negocio: 4,
  processo: 5,
  sistema: 6,
  webhook: 7,
}

// ── Suggestion List Component ──

interface VariableSuggestionListProps {
  items: VariableItem[]
  command: (item: VariableItem) => void
}

const VariableSuggestionList = forwardRef<unknown, VariableSuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const selected = container.querySelector(`[data-index="${selectedIndex}"]`)
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }, [selectedIndex])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) command(item)
      },
      [command, items]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-popover text-popover-foreground p-2 shadow-md">
          <p className="text-sm text-muted-foreground px-2 py-1">
            Nenhuma variável encontrada
          </p>
        </div>
      )
    }

    // Group by category
    const grouped: Record<string, VariableItem[]> = {}
    for (const v of items) {
      if (!grouped[v.category]) grouped[v.category] = []
      grouped[v.category].push(v)
    }
    const sortedGroups = Object.entries(grouped).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    )

    let globalIndex = 0

    return (
      <div
        ref={containerRef}
        className="z-50 max-h-[280px] w-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-md"
      >
        {sortedGroups.map(([category, variables], groupIdx) => (
          <div key={category}>
            {groupIdx > 0 && <div className="my-1 border-t border-border" />}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {CATEGORY_LABELS[category] ?? category}
            </div>
            {variables.map((variable) => {
              const idx = globalIndex++
              return (
                <button
                  key={variable.key}
                  data-index={idx}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    selectItem(idx)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    idx === selectedIndex && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Braces size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">
                    {variable.label}
                  </span>
                  {variable.sampleValue && (
                    <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[100px]">
                      {variable.sampleValue}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    )
  }
)

VariableSuggestionList.displayName = 'VariableSuggestionList'

// ── Factory ──

export function createVariableSuggestion(getVariables: () => VariableItem[]) {
  return {
    items: ({ query }: { query: string }) => {
      const variables = getVariables()
      if (!query) return variables
      const search = query.toLowerCase()
      return variables.filter(
        (v) =>
          v.label.toLowerCase().includes(search) ||
          v.key.toLowerCase().includes(search) ||
          v.category.toLowerCase().includes(search)
      )
    },

    render: () => {
      let component: ReactRenderer<unknown> | null = null
      let popup: TippyInstance[] | null = null

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStart: (props: any) => {
          component = new ReactRenderer(VariableSuggestionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          // Append inside the Sheet portal so it's not blocked by the overlay
          const editorEl = props.editor.view.dom as HTMLElement
          const sheetContent =
            editorEl.closest('[data-radix-dialog-content]') ??
            editorEl.closest('[role="dialog"]') ??
            document.body

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => sheetContent,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            maxWidth: 'none',
            theme: 'editor-menu',
          })
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate: (props: any) => {
          component?.updateProps(props)
          if (!props.clientRect) return
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          })
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (component?.ref as any)?.onKeyDown(props) ?? false
        },

        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}
