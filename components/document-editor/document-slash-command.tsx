'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SeparatorHorizontal,
  Table,
  Image as ImageIcon,
  Scissors,
  Lock,
  Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SlashCommandItem } from './types'
import type { TemplateVariable } from '@/hooks/use-template-variables'

export function getSlashCommandItems(
  editor: Editor,
  variables: TemplateVariable[],
  getIsSystem: (key: string) => boolean
): SlashCommandItem[] {
  const variableItems = variables.map((variable) => ({
    title: variable.label,
    description: `Inserir {{${variable.key}}}`,
    searchTerms: [
      'variavel',
      variable.key,
      variable.label.toLowerCase(),
      variable.category?.toLowerCase() || '',
    ].filter(Boolean),
    icon: variable.is_system ? (
      <Lock size={18} className="text-sky-600" />
    ) : (
      <Braces size={18} className="text-amber-600" />
    ),
    group: 'variables' as const,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertVariable(variable.key, getIsSystem(variable.key))
        .run()
    },
  }))

  return [
    ...variableItems,
    {
      title: 'Texto',
      description: 'Parágrafo de texto simples',
      searchTerms: ['p', 'paragraph', 'texto', 'paragrafo'],
      icon: <Type size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run()
      },
    },
    {
      title: 'Título 1',
      description: 'Cabeçalho principal',
      searchTerms: ['title', 'h1', 'titulo', 'heading'],
      icon: <Heading1 size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
      },
    },
    {
      title: 'Título 2',
      description: 'Subcabeçalho',
      searchTerms: ['subtitle', 'h2', 'subtitulo'],
      icon: <Heading2 size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
      },
    },
    {
      title: 'Título 3',
      description: 'Subcabeçalho menor',
      searchTerms: ['h3', 'titulo3'],
      icon: <Heading3 size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
      },
    },
    {
      title: 'Lista com marcadores',
      description: 'Lista não ordenada',
      searchTerms: ['unordered', 'bullet', 'lista', 'marcadores'],
      icon: <List size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Lista numerada',
      description: 'Lista ordenada',
      searchTerms: ['ordered', 'number', 'numerada'],
      icon: <ListOrdered size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Citação',
      description: 'Bloco de citação',
      searchTerms: ['quote', 'blockquote', 'citacao'],
      icon: <Quote size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Tabela',
      description: 'Inserir tabela 3x3',
      searchTerms: ['table', 'tabela'],
      icon: <Table size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
      },
    },
    {
      title: 'Imagem',
      description: 'Inserir imagem por URL',
      searchTerms: ['image', 'foto', 'imagem'],
      icon: <ImageIcon size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        const url = window.prompt('URL da imagem:')
        if (!url) return
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run()
      },
    },
    {
      title: 'Linha horizontal',
      description: 'Separador visual',
      searchTerms: ['hr', 'divider', 'separator', 'separador', 'linha'],
      icon: <SeparatorHorizontal size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      title: 'Quebra de página',
      description: 'Inserir quebra de página',
      searchTerms: ['page', 'break', 'pagina', 'quebra'],
      icon: <Scissors size={18} />,
      group: 'insert',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setPageBreak().run()
      },
    },
  ]
}

function filterItems(items: SlashCommandItem[], query: string) {
  if (!query) return items
  const search = query.toLowerCase()
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search) ||
      item.searchTerms.some((term) => term.includes(search))
  )
}

interface SlashCommandListProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

const SlashCommandList = forwardRef<unknown, SlashCommandListProps>(
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
        <div className="rounded-lg border bg-popover p-2 shadow-md">
          <p className="text-sm text-muted-foreground px-2 py-1">
            Nenhum comando encontrado
          </p>
        </div>
      )
    }

    const variableItems = items.filter((i) => i.group === 'variables')
    const insertItems = items.filter((i) => i.group === 'insert')
    let globalIndex = 0

    return (
      <div
        ref={containerRef}
        className="z-50 max-h-[330px] w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
      >
        {variableItems.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Variáveis
            </div>
            {variableItems.map((item) => {
              const idx = globalIndex++
              return (
                <SlashCommandButton
                  key={item.title + idx}
                  item={item}
                  index={idx}
                  isSelected={idx === selectedIndex}
                  onSelect={() => selectItem(idx)}
                />
              )
            })}
          </>
        )}
        {insertItems.length > 0 && (
          <>
            {variableItems.length > 0 && <div className="my-1 border-t border-border" />}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Inserir
            </div>
            {insertItems.map((item) => {
              const idx = globalIndex++
              return (
                <SlashCommandButton
                  key={item.title + idx}
                  item={item}
                  index={idx}
                  isSelected={idx === selectedIndex}
                  onSelect={() => selectItem(idx)}
                />
              )
            })}
          </>
        )}
      </div>
    )
  }
)

SlashCommandList.displayName = 'SlashCommandList'

function SlashCommandButton({
  item,
  index,
  isSelected,
  onSelect,
}: {
  item: SlashCommandItem
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      data-index={index}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
        'hover:bg-accent',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
        {item.icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate">{item.title}</span>
        <span className="text-xs text-muted-foreground truncate">{item.description}</span>
      </div>
    </button>
  )
}

export function createSlashCommandSuggestion(
  getVariables: () => TemplateVariable[],
  getIsSystem: (key: string) => boolean
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    items: ({ query, editor }: { query: string; editor: Editor }) => {
      const variables = getVariables()
      return filterItems(getSlashCommandItems(editor, variables, getIsSystem), query)
    },

    render: () => {
      let component: ReactRenderer<unknown> | null = null
      let popup: TippyInstance[] | null = null

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStart: (props: any) => {
          component = new ReactRenderer(SlashCommandList, {
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
