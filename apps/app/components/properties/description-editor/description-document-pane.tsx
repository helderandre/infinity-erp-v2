'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, MessageSquarePlus, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DescriptionDocumentPaneProps {
  document: string
  locked: boolean
  onChange: (text: string) => void
  /**
   * Disparado quando o utilizador clica "Pedir à IA" no bubble menu.
   * O canvas envia a selecção como `selection_text` na próxima mensagem.
   */
  onAskAboutSelection: (selectedText: string) => void
}

/* ───────── Plain-text ⇄ Tiptap doc ─────────
 *
 * Modelo do documento:
 *  - Linhas começadas por `- ` ou `* ` → bulletList item.
 *  - `**texto**` → bold mark.
 *  - `*texto*` → italic mark.
 *  - Restantes linhas → parágrafos (linhas vazias separam-nos).
 *
 * Round-trip preserva o formato plain-text original do projecto (compat
 * com `dev_properties.description` e os portais imobiliários que lêem essa
 * coluna). É um subset de Markdown intencionalmente limitado.
 */

type InlinePart = { text: string; bold?: boolean; italic?: boolean }

function parseInline(line: string): InlinePart[] {
  const parts: InlinePart[] = []
  // tokenize **bold** and *italic*
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index) })
    if (m[2]) parts.push({ text: m[2], bold: true })
    else if (m[3]) parts.push({ text: m[3], italic: true })
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push({ text: line.slice(last) })
  if (parts.length === 0) parts.push({ text: '' })
  return parts
}

function partsToTiptapInline(parts: InlinePart[]) {
  return parts
    .filter((p) => p.text !== '')
    .map((p) => {
      const marks: Array<{ type: string }> = []
      if (p.bold) marks.push({ type: 'bold' })
      if (p.italic) marks.push({ type: 'italic' })
      const node: { type: 'text'; text: string; marks?: typeof marks } = {
        type: 'text',
        text: p.text,
      }
      if (marks.length) node.marks = marks
      return node
    })
}

function plainTextToTiptap(text: string) {
  const lines = (text || '').split('\n')
  const content: Array<Record<string, unknown>> = []
  let bulletBuffer: Array<Record<string, unknown>> = []
  const flushBullets = () => {
    if (bulletBuffer.length) {
      content.push({ type: 'bulletList', content: bulletBuffer })
      bulletBuffer = []
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(line)) {
      const inner = line.replace(/^\s*[-*]\s+/, '')
      const inline = partsToTiptapInline(parseInline(inner))
      bulletBuffer.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: inline }],
      })
      continue
    }
    flushBullets()
    if (!line.trim()) {
      content.push({ type: 'paragraph' })
      continue
    }
    const inline = partsToTiptapInline(parseInline(line))
    content.push({ type: 'paragraph', content: inline })
  }
  flushBullets()
  return { type: 'doc', content }
}

function tiptapToPlainText(json: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any): string => {
    if (!node) return ''
    if (node.type === 'text') {
      const marks: Array<{ type: string }> = node.marks || []
      let t = String(node.text ?? '')
      if (marks.some((m) => m.type === 'bold')) t = `**${t}**`
      if (marks.some((m) => m.type === 'italic')) t = `*${t}*`
      return t
    }
    if (node.type === 'paragraph') {
      return (node.content || []).map(walk).join('')
    }
    if (node.type === 'bulletList') {
      return (node.content || [])
        .map((li: { content: Array<Record<string, unknown>> }) => `- ${(li.content || []).map(walk).join('')}`)
        .join('\n')
    }
    if (node.type === 'listItem') {
      return (node.content || []).map(walk).join('')
    }
    if (node.type === 'orderedList') {
      return (node.content || [])
        .map(
          (li: { content: Array<Record<string, unknown>> }, i: number) =>
            `${i + 1}. ${(li.content || []).map(walk).join('')}`,
        )
        .join('\n')
    }
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'doc') {
      return (node.content || [])
        .map((n: Record<string, unknown>) => walk(n))
        .filter((line: string) => line !== undefined)
        .join('\n')
    }
    if (node.content) return (node.content as Array<Record<string, unknown>>).map(walk).join('')
    return ''
  }
  return walk(json)
}

export function DescriptionDocumentPane({
  document,
  locked,
  onChange,
  onAskAboutSelection,
}: DescriptionDocumentPaneProps) {
  const initialDoc = useMemo(() => plainTextToTiptap(document), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // ^ Intencional: only reset content when `document` changes externally
  //   (AI tool calls). Local edits são reflectidas via onChange.

  const lastSetFromExternalRef = useRef<string>(document)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        strike: false,
      }),
      Placeholder.configure({
        placeholder: 'Escreve aqui ou pede à IA na conversa…',
      }),
    ],
    content: initialDoc,
    editable: !locked,
    immediatelyRender: false,
    onUpdate({ editor }) {
      const text = tiptapToPlainText(editor.getJSON() as Record<string, unknown>)
      // Evita loop: só notifica se mudou
      if (text !== lastSetFromExternalRef.current) {
        onChange(text)
        lastSetFromExternalRef.current = text
      }
    },
  })

  // Sync external changes (AI tool calls)
  useEffect(() => {
    if (!editor) return
    if (document === lastSetFromExternalRef.current) return
    lastSetFromExternalRef.current = document
    const json = plainTextToTiptap(document)
    editor.commands.setContent(json, { emitUpdate: false })
  }, [document, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!locked)
  }, [locked, editor])

  const askAboutSelection = () => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const slice = editor.state.doc.cut(from, to)
    const plain = tiptapToPlainText({ type: 'doc', content: slice.toJSON().content || [] })
    if (plain.trim()) onAskAboutSelection(plain.trim())
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Mini toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', editor?.isActive('bold') && 'bg-muted')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            disabled={locked}
            title="Negrito"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', editor?.isActive('italic') && 'bg-muted')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={locked}
            title="Itálico"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', editor?.isActive('bulletList') && 'bg-muted')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            disabled={locked}
            title="Lista"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> A IA está a editar…
          </span>
        )}
      </div>

      {/* Editor surface */}
      <div className="flex-1 overflow-y-auto">
        {editor && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'top' }}
            shouldShow={({ editor, from, to }) => !locked && from !== to && editor.isFocused}
          >
            <div className="flex items-center gap-1 rounded-full border bg-card shadow-md px-1.5 py-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 px-2 text-[11px] gap-1', editor.isActive('bold') && 'bg-muted')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 px-2 text-[11px] gap-1', editor.isActive('italic') && 'bg-muted')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-3 w-3" />
              </Button>
              <span className="h-4 w-px bg-border mx-0.5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] gap-1 text-primary"
                onClick={askAboutSelection}
                title="Enviar selecção para a IA"
              >
                <MessageSquarePlus className="h-3 w-3" />
                Pedir à IA
              </Button>
            </div>
          </BubbleMenu>
        )}
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm max-w-none p-4 focus:outline-none min-h-full',
            '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]',
            '[&_p.is-editor-empty:first-child::before]:text-muted-foreground/40',
            '[&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
            '[&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:pointer-events-none',
            locked && 'opacity-70',
          )}
        />
      </div>
    </div>
  )
}
