'use client'

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
}

export function useEmailTiptap({
  content,
  onUpdate,
  placeholder,
  editable = true,
  isHeading = false,
  headingLevel,
}: UseEmailTiptapOptions): { editor: Editor | null } {
  const preparedContent = prepareVariablesForParsing(migrateHtmlContent(content))

  const editor = useEditor({
    extensions: [
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
    ],
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
