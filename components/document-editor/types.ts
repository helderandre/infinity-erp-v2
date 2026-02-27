import type { JSONContent, Editor } from '@tiptap/core'

export interface ParsedVariable {
  key: string
  displayKey: string
  isSystem: boolean
  count: number
}

export type EditorMode = 'template' | 'document' | 'readonly'

export interface EditorSettingsConfig {
  fontFamily: string
  fontSize: number
  lineHeight: number
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettingsConfig = {
  fontFamily: 'Source Serif 4, ui-serif, Georgia, serif',
  fontSize: 12,
  lineHeight: 1.6,
}

export interface DocumentEditorProps {
  content?: JSONContent | string
  defaultContent?: JSONContent | string
  mode: EditorMode
  settings?: Partial<EditorSettingsConfig>
  onChange?: (content: JSONContent) => void
  onHtmlChange?: (html: string) => void
  onVariablesChange?: (variables: ParsedVariable[]) => void
  onVariableClick?: (variableKey: string) => void
  className?: string
  placeholder?: string
}

export interface DocumentEditorRef {
  getContent: () => JSONContent
  getHTML: () => string
  getText: () => string
  getVariables: () => ParsedVariable[]
  insertVariable: (key: string, isSystem?: boolean) => void
  focus: () => void
  clear: () => void
  editor: Editor | null
}

export interface SlashCommandItem {
  title: string
  description: string
  icon: React.ReactNode
  searchTerms: string[]
  group: 'variables' | 'insert'
  command: (props: { editor: Editor; range: { from: number; to: number } }) => void
}

export const TEXT_COLORS = [
  { name: 'Preto', value: '#000000' },
  { name: 'Cinza', value: '#4b5563' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Amarelo', value: '#ca8a04' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Roxo', value: '#8b5cf6' },
] as const

export const HIGHLIGHT_COLORS = [
  { name: 'Sem fundo', value: '' },
  { name: 'Cinza', value: '#f3f4f6' },
  { name: 'Vermelho', value: '#fef2f2' },
  { name: 'Laranja', value: '#fff7ed' },
  { name: 'Amarelo', value: '#fefce8' },
  { name: 'Verde', value: '#f0fdf4' },
  { name: 'Azul', value: '#eff6ff' },
  { name: 'Roxo', value: '#faf5ff' },
] as const

export const EDITOR_FONTS = [
  // — Serif (Google Fonts)
  { name: 'Source Serif 4', value: 'Source Serif 4, ui-serif, Georgia, serif' },
  { name: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Crimson Pro', value: 'Crimson Pro, serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'EB Garamond', value: 'EB Garamond, serif' },
  { name: 'Cormorant Garamond', value: 'Cormorant Garamond, serif' },
  { name: 'Noto Serif', value: 'Noto Serif, serif' },
  { name: 'PT Serif', value: 'PT Serif, serif' },
  { name: 'Bitter', value: 'Bitter, serif' },
  { name: 'Roboto Slab', value: 'Roboto Slab, serif' },
  // — Sans-serif (Google Fonts)
  { name: 'Source Sans 3', value: 'Source Sans 3, sans-serif' },
  { name: 'Work Sans', value: 'Work Sans, sans-serif' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Raleway', value: 'Raleway, sans-serif' },
  { name: 'Nunito', value: 'Nunito, sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif' },
  { name: 'Rubik', value: 'Rubik, sans-serif' },
  { name: 'PT Sans', value: 'PT Sans, sans-serif' },
  // — Sistema
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
] as const

export const LINE_SPACING_OPTIONS = [
  { label: '1.0', value: 1 },
  { label: '1.15', value: 1.15 },
  { label: '1.5', value: 1.5 },
  { label: '1.6', value: 1.6 },
  { label: '2.0', value: 2 },
  { label: '2.5', value: 2.5 },
] as const
