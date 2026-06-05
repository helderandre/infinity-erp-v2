'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { CharacterCount } from '@tiptap/extension-character-count'
import {
  Bold,
  Italic,
  Strikethrough,
  Smile,
  Braces,
} from 'lucide-react'
import { VariableNode } from '@/components/document-editor/extensions/variable-node'
import {
  VariableMention,
  createVariableSuggestion,
} from '@/components/automations/wpp-variable-suggestion'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { VariableItem } from '@/components/automations/variable-picker'

// ── Public ref ──

export interface WppRichEditorRef {
  insertVariable: (key: string) => void
  focus: () => void
}

// ── Props ──

interface WppRichEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  minHeight?: string
  variables: VariableItem[]
  className?: string
}

// ── WhatsApp markdown serializer ──

function serializeNode(node: JSONContent): string {
  if (node.type === 'variable') {
    return `{{${node.attrs?.key}}}`
  }
  if (node.type === 'hardBreak') {
    return '\n'
  }
  if (node.type === 'text') {
    let text = node.text || ''
    const marks = node.marks || []
    if (marks.some((m) => m.type === 'strike')) text = `~${text}~`
    if (marks.some((m) => m.type === 'italic')) text = `_${text}_`
    if (marks.some((m) => m.type === 'bold')) text = `*${text}*`
    return text
  }
  if (node.type === 'paragraph') {
    return (node.content || []).map(serializeNode).join('')
  }
  if (node.type === 'doc') {
    return (node.content || []).map(serializeNode).join('\n')
  }
  return ''
}

function tiptapToWhatsAppMarkdown(doc: JSONContent): string {
  return serializeNode(doc)
}

// ── WhatsApp markdown parser ──

interface ParsedToken {
  type: 'text' | 'variable'
  text?: string
  key?: string
  marks?: { type: string }[]
}

function parseInlineTokens(line: string): ParsedToken[] {
  const tokens: ParsedToken[] = []
  // Match variables, bold, italic, strikethrough
  const regex = /(\{\{[^}]+\}\}|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: line.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (token.startsWith('{{') && token.endsWith('}}')) {
      tokens.push({ type: 'variable', key: token.slice(2, -2) })
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'bold' }] })
    } else if (token.startsWith('_') && token.endsWith('_')) {
      tokens.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] })
    } else if (token.startsWith('~') && token.endsWith('~')) {
      tokens.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'strike' }] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < line.length) {
    tokens.push({ type: 'text', text: line.slice(lastIndex) })
  }
  return tokens
}

function tokensToContent(tokens: ParsedToken[]): JSONContent[] {
  return tokens
    .map((t) => {
      if (t.type === 'variable') {
        return { type: 'variable', attrs: { key: t.key, isSystem: false } }
      }
      if (t.text) {
        const node: JSONContent = { type: 'text', text: t.text }
        if (t.marks && t.marks.length > 0) node.marks = t.marks
        return node
      }
      return null
    })
    .filter(Boolean) as JSONContent[]
}

function whatsAppMarkdownToTiptap(markdown: string): JSONContent {
  if (!markdown) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  const lines = markdown.split('\n')
  const paragraphs: JSONContent[] = lines.map((line) => {
    if (!line) return { type: 'paragraph' }
    const tokens = parseInlineTokens(line)
    const content = tokensToContent(tokens)
    return content.length > 0
      ? { type: 'paragraph', content }
      : { type: 'paragraph' }
  })

  return { type: 'doc', content: paragraphs }
}

// ── Emoji helper ──

const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
const emojiShortcutLabel = isWindows ? 'Win + .' : isMac ? 'Ctrl + Cmd + Espaço' : 'Emojis'

// ── Component ──

export const WppRichEditor = forwardRef<WppRichEditorRef, WppRichEditorProps>(
  function WppRichEditor(
    { value, onChange, placeholder = 'Escreva a sua mensagem...', maxLength, minHeight = '120px', variables, className },
    ref
  ) {
    const isInternalChange = useRef(false)
    const variablesRef = useRef<VariableItem[]>(variables)

    useEffect(() => {
      variablesRef.current = variables
    }, [variables])

    const suggestion = useMemo(
      () => createVariableSuggestion(() => variablesRef.current),
      []
    )

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          horizontalRule: false,
          dropcursor: false,
          gapcursor: false,
        }),
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({ limit: maxLength }),
        VariableNode.configure({ mode: 'template' }),
        VariableMention.configure({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          suggestion: suggestion as any,
        }),
      ],
      content: whatsAppMarkdownToTiptap(value),
      editorProps: {
        attributes: {
          class: 'outline-none text-sm leading-relaxed',
          style: `min-height: ${minHeight}`,
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor }) => {
        isInternalChange.current = true
        const md = tiptapToWhatsAppMarkdown(editor.getJSON())
        onChange(md)
      },
    })

    // Sync external value changes (e.g. reset on open)
    useEffect(() => {
      if (!editor || editor.isDestroyed) return
      if (isInternalChange.current) {
        isInternalChange.current = false
        return
      }
      const currentMd = tiptapToWhatsAppMarkdown(editor.getJSON())
      if (currentMd !== value) {
        editor.commands.setContent(whatsAppMarkdownToTiptap(value))
      }
    }, [editor, value])

    useImperativeHandle(ref, () => ({
      insertVariable: (key: string) => {
        editor?.chain().focus().insertVariable(key, false).run()
      },
      focus: () => {
        editor?.chain().focus().run()
      },
    }))

    const charCount = value.length
    const isOverLimit = maxLength ? charCount > maxLength * 0.9 : false

    const handleEmojiClick = useCallback(() => {
      // Focus editor then trigger OS emoji picker via keyboard simulation
      editor?.chain().focus().run()
      // On Windows: Win+. — we can't programmatically trigger this
      // Just show a tooltip hint
    }, [editor])

    if (!editor) {
      return (
        <div
          className={cn('animate-pulse rounded-md border bg-muted', className)}
          style={{ minHeight }}
        />
      )
    }

    return (
      <div className={cn('space-y-2', className)}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5">
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            aria-label="Negrito"
            className="h-7 w-7 p-0 data-[state=on]:bg-accent"
          >
            <Bold className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Itálico"
            className="h-7 w-7 p-0 data-[state=on]:bg-accent"
          >
            <Italic className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('strike')}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            aria-label="Riscado"
            className="h-7 w-7 p-0 data-[state=on]:bg-accent"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Toggle>

          <div className="w-px h-4 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleEmojiClick}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{emojiShortcutLabel}</p>
            </TooltipContent>
          </Tooltip>

          {maxLength && (
            <span
              className={cn(
                'ml-auto text-[10px] tabular-nums',
                isOverLimit ? 'text-red-500' : 'text-muted-foreground'
              )}
            >
              {charCount} / {maxLength}
            </span>
          )}
        </div>

        {/* Editor */}
        <div className="rounded-md border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <EditorContent editor={editor} />
        </div>

        {/* Hints */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Formatação: *negrito* _itálico_ ~riscado~ | <Braces className="inline h-2.5 w-2.5" /> @ para variáveis
          </p>
        </div>
      </div>
    )
  }
)
