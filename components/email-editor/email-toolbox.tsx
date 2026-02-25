'use client'

import { useState } from 'react'
import { useEditor, Element } from '@craftjs/core'
import {
  Type,
  Heading,
  ImageIcon,
  MousePointer,
  Square,
  LayoutGrid,
  Minus,
  ArrowUpDown,
  Paperclip,
  ChevronDown,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { EmailContainer } from './user/email-container'
import { EmailText } from './user/email-text'
import { EmailHeading } from './user/email-heading'
import { EmailImage } from './user/email-image'
import { EmailButton } from './user/email-button'
import { EmailDivider } from './user/email-divider'
import { EmailSpacer } from './user/email-spacer'
import { EmailAttachment } from './user/email-attachment'
import { EmailGrid } from './user/email-grid'

interface ToolboxItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  element: React.ReactElement
}

interface ToolboxCategory {
  name: string
  items: ToolboxItem[]
}

const categories: ToolboxCategory[] = [
  {
    name: 'Conteúdo',
    items: [
      { label: 'Texto', icon: Type, element: <EmailText /> },
      { label: 'Título', icon: Heading, element: <EmailHeading /> },
      { label: 'Botão', icon: MousePointer, element: <EmailButton /> },
      { label: 'Anexo', icon: Paperclip, element: <EmailAttachment /> },
    ],
  },
  {
    name: 'Media',
    items: [
      { label: 'Imagem', icon: ImageIcon, element: <EmailImage /> },
    ],
  },
  {
    name: 'Estrutura',
    items: [
      {
        label: 'Contentor',
        icon: Square,
        element: (
          <Element is={EmailContainer} canvas padding={16} background="#f5f5f5" width="100%" />
        ),
      },
      {
        label: 'Grelha',
        icon: LayoutGrid,
        element: (
          <Element is={EmailGrid} canvas columns={2} rows={1} gap={16} />
        ),
      },
      { label: 'Divisor', icon: Minus, element: <EmailDivider /> },
      { label: 'Espaçador', icon: ArrowUpDown, element: <EmailSpacer /> },
    ],
  },
]

function CategorySection({
  category,
  search,
}: {
  category: ToolboxCategory
  search: string
}) {
  const [open, setOpen] = useState(true)
  const { connectors } = useEditor()

  const filtered = search
    ? category.items.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : category.items

  if (filtered.length === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            !open && '-rotate-90'
          )}
        />
        {category.name}
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
          {filtered.map((comp) => (
            <button
              key={comp.label}
              ref={(ref) => {
                if (ref) connectors.create(ref, comp.element)
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 cursor-grab text-xs transition-colors hover:bg-muted hover:border-border"
            >
              <comp.icon className="h-5 w-5 text-muted-foreground" />
              <span className="truncate w-full text-center">{comp.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function EmailToolbox() {
  const [search, setSearch] = useState('')

  return (
    <div className="w-72 shrink-0 border-r overflow-auto flex flex-col">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {categories.map((cat) => (
          <CategorySection key={cat.name} category={cat} search={search} />
        ))}
      </div>
    </div>
  )
}
