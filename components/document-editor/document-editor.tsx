'use client'

import { useState, useEffect, useCallback, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import { EditorContent, useEditor, BubbleMenu } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'

import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Typography } from '@tiptap/extension-typography'
import { CharacterCount } from '@tiptap/extension-character-count'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { Gapcursor } from '@tiptap/extension-gapcursor'

import { VariableNode } from './extensions/variable-node'
import { SlashCommand } from './extensions/slash-command'
import { PageBreak } from './extensions/page-break'
import { Indent } from './extensions/indent'
import { createSlashCommandSuggestion } from './document-slash-command'
import { DocumentToolbar } from './document-toolbar'
import { DocumentBubbleMenuContent } from './document-bubble-menu'
import { extractVariablesFromJSON } from './utils/parse-variables'
import { decorateVariablesInHtml, stripVariableSpans } from './utils/variable-html'
import { cn } from '@/lib/utils'
import {
  DEFAULT_EDITOR_SETTINGS,
  type DocumentEditorProps,
  type DocumentEditorRef,
  type EditorSettingsConfig,
} from './types'
import type { TemplateVariable } from '@/hooks/use-template-variables'

interface DocumentEditorInternalProps extends DocumentEditorProps {
  getIsSystem?: (key: string) => boolean
  getSlashCommandVariables?: () => TemplateVariable[]
  onInsertImage?: () => void
}

export const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorInternalProps>(
  function DocumentEditor(
    {
      content,
      defaultContent,
      mode,
      settings: settingsProp,
      onChange,
      onHtmlChange,
      onVariablesChange,
      onVariableClick,
      className,
      placeholder = 'Digite "/" para comandos...',
      getIsSystem,
      getSlashCommandVariables,
      onInsertImage,
    },
    ref
  ) {
    const settings: EditorSettingsConfig = {
      ...DEFAULT_EDITOR_SETTINGS,
      ...settingsProp,
    }

    const [fontSize, setFontSize] = useState(settings.fontSize)
    const [lineHeight, setLineHeight] = useState(settings.lineHeight)
    const [currentFont, setCurrentFont] = useState(settings.fontFamily)
    const isEditable = mode !== 'readonly'

    const variablesRef = useRef<TemplateVariable[]>([])
    useEffect(() => {
      if (getSlashCommandVariables) {
        variablesRef.current = getSlashCommandVariables()
      }
    }, [getSlashCommandVariables])

    const getSystemKeys = useCallback(() => {
      return variablesRef.current.filter((v) => v.is_system).map((v) => v.key)
    }, [])

    const slashSuggestion = useMemo(() => {
      return createSlashCommandSuggestion(
        () => variablesRef.current,
        (key) => getIsSystem?.(key) ?? false
      )
    }, [getIsSystem])

    const normalizeContent = useCallback(
      (value?: JSONContent | string) => {
        if (!value) return undefined
        if (typeof value === 'string') {
          return decorateVariablesInHtml(value, getSystemKeys())
        }
        return value
      },
      [getSystemKeys]
    )

    const initialContent = useMemo(() => normalizeContent(content ?? defaultContent), [content, defaultContent, normalizeContent])

    const editor = useEditor({
      immediatelyRender: false,
      editable: isEditable,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          dropcursor: false,
          gapcursor: false,
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          alignments: ['left', 'center', 'right', 'justify'],
        }),
        TextStyle,
        FontFamily,
        Color,
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Image.configure({
          HTMLAttributes: { class: 'rounded-lg max-w-full' },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
        }),
        Typography,
        CharacterCount,
        Dropcursor.configure({ color: 'hsl(var(--primary))', width: 2 }),
        Gapcursor,
        VariableNode.configure({
          onVariableClick,
          mode: mode === 'readonly' ? 'document' : mode,
          getIsSystem,
        }),
        SlashCommand.configure({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          suggestion: slashSuggestion as any,
        }),
        PageBreak,
        Indent,
      ],
      content: initialContent || '',
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-10 py-8',
            '[&>.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&>.is-editor-empty:first-child::before]:text-muted-foreground [&>.is-editor-empty:first-child::before]:float-left [&>.is-editor-empty:first-child::before]:h-0 [&>.is-editor-empty:first-child::before]:pointer-events-none'
          ),
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON()
        onChange?.(json)
        const html = stripVariableSpans(editor.getHTML())
        onHtmlChange?.(html)
        const variables = extractVariablesFromJSON(json, getSystemKeys())
        onVariablesChange?.(variables)
      },
    })

    useEffect(() => {
      if (!editor) return
      const el = editor.view.dom as HTMLElement
      el.style.fontFamily = currentFont
      el.style.fontSize = `${fontSize}pt`
      el.style.lineHeight = String(lineHeight)
    }, [editor, currentFont, fontSize, lineHeight])

    useEffect(() => {
      if (!editor || !content) return
      if (editor.isDestroyed) return
      if (typeof content === 'string') {
        const decorated = decorateVariablesInHtml(content, getSystemKeys())
        editor.commands.setContent(decorated)
        return
      }
      const currentJSON = JSON.stringify(editor.getJSON())
      const newJSON = JSON.stringify(content)
      if (currentJSON !== newJSON) {
        editor.commands.setContent(content)
      }
    }, [editor, content])

    useImperativeHandle(ref, () => ({
      getContent: () => editor?.getJSON() || { type: 'doc', content: [] },
      getHTML: () => (editor ? stripVariableSpans(editor.getHTML()) : ''),
      getText: () => editor?.getText() || '',
      getVariables: () => {
        if (!editor) return []
        return extractVariablesFromJSON(editor.getJSON(), getSystemKeys())
      },
      insertVariable: (key: string, isSystem?: boolean) => {
        editor?.chain().focus().insertVariable(key, isSystem).run()
      },
      focus: () => editor?.chain().focus().run(),
      clear: () => editor?.commands.clearContent(),
      editor: editor ?? null,
    }))

    const handleFontSizeChange = useCallback(
      (size: number) => {
        setFontSize(size)
        if (editor) {
          const el = editor.view.dom as HTMLElement
          el.style.fontSize = `${size}pt`
        }
      },
      [editor]
    )

    const handleLineHeightChange = useCallback(
      (lh: number) => {
        setLineHeight(lh)
        if (editor) {
          const el = editor.view.dom as HTMLElement
          el.style.lineHeight = String(lh)
        }
      },
      [editor]
    )

    const handleFontFamilyChange = useCallback(
      (font: string) => {
        setCurrentFont(font)
        if (editor) {
          const el = editor.view.dom as HTMLElement
          el.style.fontFamily = font
        }
      },
      [editor]
    )

    if (!editor) {
      return (
        <div className={cn('h-[600px] w-full animate-pulse rounded-md border bg-muted', className)} />
      )
    }

    return (
      <div className={cn('flex flex-col h-full overflow-hidden', className)}>
        {isEditable && (
          <DocumentToolbar
            editor={editor}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            lineHeight={lineHeight}
            onLineHeightChange={handleLineHeightChange}
            currentFont={currentFont}
            onFontFamilyChange={handleFontFamilyChange}
            onInsertImage={onInsertImage}
          />
        )}

        {isEditable && editor && (
          <BubbleMenu
            editor={editor}
            pluginKey="formattingMenu"
            shouldShow={({ editor, state }) => {
              const { from, to } = state.selection
              if (from === to) return false
              const text = state.doc.textBetween(from, to, '')
              if (editor.isActive('codeBlock') || editor.isActive('variable')) return false
              return text.length > 0
            }}
            tippyOptions={{
              placement: 'top',
              offset: [0, 8],
              maxWidth: 'none',
              arrow: false,
              theme: 'editor-menu',
            }}
          >
            <DocumentBubbleMenuContent editor={editor} mode={mode} getIsSystem={getIsSystem} />
          </BubbleMenu>
        )}

        <div className="relative flex-1 overflow-y-auto bg-muted/50 dark:bg-muted/20">
          <div className="flex justify-center py-8 min-h-full">
            <div className="bg-background shadow-lg border border-border/50 rounded-xl" style={{ width: '210mm', minHeight: '297mm' }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <span>{editor.storage.characterCount.characters()} caracteres</span>
          <span>{editor.storage.characterCount.words()} palavras</span>
        </div>
      </div>
    )
  }
)
