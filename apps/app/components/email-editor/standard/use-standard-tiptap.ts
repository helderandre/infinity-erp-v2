'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { VariableNode } from '../extensions/variable-node'
import { FontSize } from '../extensions/font-size'
import {
  VariableMention,
  createVariableSuggestion,
} from '@/components/automations/wpp-variable-suggestion'
import type { VariableItem } from '@/components/automations/variable-picker'
import { EmailButtonNode } from './nodes/button-node'
import { EmailAttachmentNode } from './nodes/attachment-node'
import { EmailImageNode } from './nodes/image-node'
import { EmailPropertyGridNode } from './nodes/property-grid-node'
import { EmailPortalLinksNode } from './nodes/portal-links-node'
import {
  SlashCommand,
  buildSlashMenuItems,
  createSlashSuggestion,
  type SlashMenuHandlers,
} from './slash-menu'

/**
 * Migrate legacy HTML content:
 * - Strip <span class="email-variable"> wrappers from old contentEditable,
 *   leaving raw {{key}} text which VariableNode parseHTML then picks up.
 * - Clean empty formatting tags left over from document.execCommand().
 */
function migrateHtmlContent(html: string): string {
  let cleaned = html.replace(
    /<span class="email-variable"[^>]*>(.*?)<\/span>/g,
    '$1'
  )
  cleaned = cleaned.replace(/<(b|i|u|s|font)>\s*<\/\1>/g, '')
  return cleaned
}

function prepareVariablesForParsing(html: string): string {
  return html.replace(
    /\{\{([^}]+)\}\}/g,
    '<span data-variable-key="$1">{{$1}}</span>'
  )
}

function cleanTiptapOutput(html: string): string {
  return html.replace(
    /<span[^>]*data-variable-key="([^"]*)"[^>]*>.*?<\/span>/g,
    '{{$1}}'
  )
}

export interface UseStandardTiptapOptions {
  content: string
  onUpdate: (html: string) => void
  placeholder?: string
  editable?: boolean
  variables?: VariableItem[]
  slashHandlers: SlashMenuHandlers
}

/**
 * Rich Tiptap editor for the "standard" email mode.
 *
 * Enables headings (H1-H4), horizontal rule, blockquote, strikethrough,
 * lists, image, custom button node, custom attachment node, and a slash
 * command that mirrors the components available in the advanced mode.
 */
export function useStandardTiptap({
  content,
  onUpdate,
  placeholder,
  editable = true,
  variables,
  slashHandlers,
}: UseStandardTiptapOptions): { editor: Editor | null } {
  const preparedContent = prepareVariablesForParsing(migrateHtmlContent(content))

  const variablesRef = useRef<VariableItem[]>(variables || [])
  useEffect(() => {
    variablesRef.current = variables || []
  }, [variables])

  const variableSuggestion = useMemo(
    () => (variables ? createVariableSuggestion(() => variablesRef.current) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!variables]
  )

  const slashHandlersRef = useRef<SlashMenuHandlers>(slashHandlers)
  useEffect(() => {
    slashHandlersRef.current = slashHandlers
  }, [slashHandlers])

  const slashSuggestion = useMemo(
    () =>
      createSlashSuggestion(() =>
        buildSlashMenuItems({
          onInsertImage: (ctx) => slashHandlersRef.current.onInsertImage(ctx),
          onInsertButton: (ctx) => slashHandlersRef.current.onInsertButton(ctx),
          onInsertAttachment: (ctx) =>
            slashHandlersRef.current.onInsertAttachment(ctx),
          onInsertVariable: (ctx) =>
            slashHandlersRef.current.onInsertVariable(ctx),
          onInsertPropertyGrid: (ctx) =>
            slashHandlersRef.current.onInsertPropertyGrid(ctx),
          onInsertPortalLinks: (ctx) =>
            slashHandlersRef.current.onInsertPortalLinks(ctx),
        })
      ),
    []
  )

  const extensions = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exts: any[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
        code: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: #2563eb; text-decoration: underline;',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      VariableNode,
      EmailButtonNode,
      EmailAttachmentNode,
      EmailImageNode,
      EmailPropertyGridNode,
      EmailPortalLinksNode,
      SlashCommand.configure({ suggestion: slashSuggestion }),
    ]

    if (variableSuggestion) {
      exts.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        VariableMention.configure({ suggestion: variableSuggestion as any })
      )
    }

    return exts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder, slashSuggestion, variableSuggestion])

  const editor = useEditor({
    extensions,
    content: preparedContent,
    editable,
    onUpdate: ({ editor }) => {
      const html = cleanTiptapOutput(editor.getHTML())
      onUpdate(html)
    },
    autofocus: false,
    immediatelyRender: false,
  })

  return { editor }
}
