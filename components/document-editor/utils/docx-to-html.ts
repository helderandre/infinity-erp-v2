import mammoth from 'mammoth'
import type { ParsedVariable } from '../types'
import { extractVariableKeysFromText } from './parse-variables'

export async function convertDocxToHtml(file: File): Promise<{
  html: string
  variables: ParsedVariable[]
  messages: string[]
}> {
  const arrayBuffer = await file.arrayBuffer()

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='Quote'] => blockquote",
        "p[style-name='Block Text'] => blockquote",
      ],
    }
  )

  const html = result.value
  const messages = result.messages.map((m) => m.message)

  const keys = extractVariableKeysFromText(html)
  const variables: ParsedVariable[] = keys.map((key) => ({
    key,
    displayKey: `{{${key}}}`,
    isSystem: false,
    count: 1,
  }))

  return { html, variables, messages }
}
