import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import type { SlashCommandItem } from '../types'

export const SlashCommandPluginKey = new PluginKey('slash-command')

export const SlashCommand = Extension.create<{
  suggestion: Partial<SuggestionOptions<SlashCommandItem>>
}>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SlashCommandPluginKey,
        command: ({ editor, range, props }) => {
          ;(props as SlashCommandItem).command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
