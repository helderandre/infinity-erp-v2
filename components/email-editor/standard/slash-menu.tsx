'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import {
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  MousePointer,
  Minus,
  Paperclip,
  Quote,
  List,
  ListOrdered,
  Braces,
  Building2,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlashCommandItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
  keywords: string[]
  command: (ctx: { editor: Editor; range: Range }) => void
}

export const SlashCommandPluginKey = new PluginKey('slash-command')

export interface SlashCommandOptions {
  suggestion: Partial<SuggestionOptions<SlashCommandItem>>
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SlashCommandPluginKey,
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
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

// ─── Slash menu items factory ──────────────────────────────────────────────

export interface SlashMenuHandlers {
  onInsertImage: (ctx: { editor: Editor; range: Range }) => void
  onInsertButton: (ctx: { editor: Editor; range: Range }) => void
  onInsertAttachment: (ctx: { editor: Editor; range: Range }) => void
  onInsertVariable: (ctx: { editor: Editor; range: Range }) => void
  onInsertPropertyGrid: (ctx: { editor: Editor; range: Range }) => void
  onInsertPortalLinks: (ctx: { editor: Editor; range: Range }) => void
}

export function buildSlashMenuItems(handlers: SlashMenuHandlers): SlashCommandItem[] {
  const headingItem = (level: 1 | 2 | 3): SlashCommandItem => ({
    id: `heading-${level}`,
    label: `Título ${level}`,
    description: `Secção de nível ${level}`,
    icon: level === 1 ? Heading1 : level === 2 ? Heading2 : Heading3,
    keywords: ['heading', 'titulo', 'título', `h${level}`],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level }).run()
    },
  })

  return [
    headingItem(1),
    headingItem(2),
    headingItem(3),
    {
      id: 'bullet-list',
      label: 'Lista com marcadores',
      description: 'Criar uma lista não ordenada',
      icon: List,
      keywords: ['list', 'lista', 'bullets', 'marcadores'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      id: 'ordered-list',
      label: 'Lista numerada',
      description: 'Criar uma lista ordenada',
      icon: ListOrdered,
      keywords: ['list', 'lista', 'numbered', 'ordenada'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      id: 'blockquote',
      label: 'Citação',
      description: 'Bloco de citação',
      icon: Quote,
      keywords: ['quote', 'citação', 'citacao', 'blockquote'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      id: 'divider',
      label: 'Divisor',
      description: 'Linha horizontal',
      icon: Minus,
      keywords: ['divider', 'divisor', 'hr', 'linha'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      id: 'image',
      label: 'Imagem',
      description: 'Carregar uma imagem',
      icon: ImageIcon,
      keywords: ['image', 'imagem', 'img', 'picture'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertImage(ctx)
      },
    },
    {
      id: 'button',
      label: 'Botão',
      description: 'Botão com link',
      icon: MousePointer,
      keywords: ['button', 'botão', 'botao', 'cta', 'link'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertButton(ctx)
      },
    },
    {
      id: 'attachment',
      label: 'Anexo',
      description: 'Anexar ficheiro',
      icon: Paperclip,
      keywords: ['attachment', 'anexo', 'ficheiro', 'file'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertAttachment(ctx)
      },
    },
    {
      id: 'property-grid',
      label: 'Grelha de Imóveis',
      description: 'Cartões de imóveis em grelha',
      icon: Building2,
      keywords: ['property', 'imoveis', 'imóveis', 'grid', 'grelha', 'cards'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertPropertyGrid(ctx)
      },
    },
    {
      id: 'portal-links',
      label: 'Links de Portais',
      description: 'Botões Idealista, Imovirtual, Casa Sapo...',
      icon: ExternalLink,
      keywords: ['portal', 'portais', 'idealista', 'imovirtual', 'casa sapo'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertPortalLinks(ctx)
      },
    },
    {
      id: 'variable',
      label: 'Variável',
      description: 'Inserir variável dinâmica ({{chave}})',
      icon: Braces,
      keywords: ['variavel', 'variável', 'variable', 'placeholder', 'merge'],
      command: (ctx) => {
        ctx.editor.chain().focus().deleteRange(ctx.range).run()
        handlers.onInsertVariable(ctx)
      },
    },
  ]
}

// ─── Suggestion list UI ────────────────────────────────────────────────────

interface SlashMenuListProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export const SlashMenuList = forwardRef<unknown, SlashMenuListProps>(
  function SlashMenuList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const selected = container.querySelector(`[data-index="${selectedIndex}"]`)
      if (selected) selected.scrollIntoView({ block: 'nearest' })
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
            Nenhum comando encontrado
          </p>
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className="z-50 max-h-[320px] w-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-md"
      >
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              data-index={idx}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                selectItem(idx)
              }}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left',
                'hover:bg-accent hover:text-accent-foreground',
                idx === selectedIndex && 'bg-accent text-accent-foreground'
              )}
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {item.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }
) as (props: SlashMenuListProps & { ref?: React.Ref<unknown> }) => ReactElement | null

// ─── Factory to wire the extension ─────────────────────────────────────────

export function createSlashSuggestion(
  getItems: () => SlashCommandItem[]
): Partial<SuggestionOptions<SlashCommandItem>> {
  return {
    items: ({ query }) => {
      const all = getItems()
      if (!query) return all
      const q = query.toLowerCase()
      return all.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
      )
    },

    render: () => {
      let component: ReactRenderer<unknown> | null = null
      let popup: TippyInstance[] | null = null

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStart: (props: any) => {
          component = new ReactRenderer(SlashMenuList, {
            props,
            editor: props.editor,
          })
          if (!props.clientRect) return
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
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
          popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect })
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
