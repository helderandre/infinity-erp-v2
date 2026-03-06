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
import { VariableNode } from '../extensions/variable-node'
import { FontSize } from '../extensions/font-size'
import {
  VariableMention,
  createVariableSuggestion,
} from '@/components/automations/wpp-variable-suggestion'
import type { VariableItem } from '@/components/automations/variable-picker'

/**
 * Migrate legacy HTML content:
 * - Strip <span class="email-variable"> wrappers from old contentEditable,
 *   leaving raw {{key}} text which the VariableNode parseHTML will pick up
 *   via input rules.
 * - Clean up empty formatting tags from document.execCommand()
 */
function migrateHtmlContent(html: string): string {
  // Remove email-variable spans, keeping their inner text
  let cleaned = html.replace(
    /<span class="email-variable"[^>]*>(.*?)<\/span>/g,
    '$1'
  )
  // Remove empty <b>, <i>, <u>, <s>, <font> tags
  cleaned = cleaned.replace(/<(b|i|u|s|font)>\s*<\/\1>/g, '')
  return cleaned
}

/**
 * Convert raw {{key}} text patterns in HTML to our variable node spans
 * so that Tiptap's parseHTML can pick them up.
 */
function prepareVariablesForParsing(html: string): string {
  return html.replace(
    /\{\{([^}]+)\}\}/g,
    '<span data-variable-key="$1">{{$1}}</span>'
  )
}

export interface UseEmailTiptapOptions {
  content: string
  onUpdate: (html: string) => void
  placeholder?: string
  editable?: boolean
  isHeading?: boolean
  headingLevel?: 1 | 2 | 3 | 4
  /** When provided, enables @ mention trigger for inserting variables */
  variables?: VariableItem[]
}

export function useEmailTiptap({
  content,
  onUpdate,
  placeholder,
  editable = true,
  isHeading = false,
  headingLevel,
  variables,
}: UseEmailTiptapOptions): { editor: Editor | null } {
  const preparedContent = prepareVariablesForParsing(migrateHtmlContent(content))

  // Keep variables ref fresh for the suggestion plugin
  const variablesRef = useRef<VariableItem[]>(variables || [])
  useEffect(() => {
    variablesRef.current = variables || []
  }, [variables])

  const suggestion = useMemo(
    () => (variables ? createVariableSuggestion(() => variablesRef.current) : null),
    // Only create once — the ref keeps it fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!variables]
  )

  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        heading: isHeading ? { levels: [1, 2, 3, 4] } : false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
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
      FontSize,
      Color,
      Placeholder.configure({
        placeholder: placeholder || '',
      }),
      VariableNode,
    ]

    if (suggestion) {
      exts.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        VariableMention.configure({ suggestion: suggestion as any }) as any
      )
    }

    return exts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHeading, placeholder, suggestion])

  const editor = useEditor({
    extensions,
    content: preparedContent,
    editable,
    onUpdate: ({ editor }) => {
      const html = cleanTiptapOutput(editor.getHTML())
      onUpdate(html)
    },
    // Prevent Tiptap from taking focus when created
    autofocus: false,
    immediatelyRender: false,
  })

  return { editor }
}

/**
 * Convert Tiptap HTML output back to a format compatible with our
 * Craft.js serialization — replace variable spans with raw {{key}} text.
 */
function cleanTiptapOutput(html: string): string {
  // Convert variable node spans back to {{key}}
  let cleaned = html.replace(
    /<span[^>]*data-variable-key="([^"]*)"[^>]*>.*?<\/span>/g,
    '{{$1}}'
  )
  // Remove wrapping <p> if content is a single paragraph (for inline text blocks)
  // Keep it if there are multiple paragraphs or other block elements
  return cleaned
}
