'use client'

import { MentionsInput, Mention } from 'react-mentions'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  users: { id: string; display: string }[]
  onSubmit: () => void
  isSubmitting: boolean
}

const mentionsInputStyle = {
  control: { fontSize: 14, fontWeight: 'normal' as const },
  '&multiLine': {
    control: { minHeight: 60 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: {
      padding: 9,
      border: '1px solid hsl(var(--border))',
      borderRadius: 6,
      outline: 'none',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      maxHeight: 200,
      overflowY: 'auto' as const,
    },
    item: {
      '&focused': { backgroundColor: 'hsl(var(--muted))' },
    },
  },
}

const mentionStyle = {
  backgroundColor: 'hsl(var(--primary) / 0.1)',
  borderRadius: 4,
  padding: '1px 2px',
}

export function CommentInput({
  value,
  onChange,
  users,
  onSubmit,
  isSubmitting,
}: CommentInputProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <MentionsInput
          value={value}
          onChange={(_e, newValue) => onChange(newValue)}
          placeholder="Escrever comentário... Use @ para mencionar"
          style={mentionsInputStyle}
          a11ySuggestionsListLabel="Utilizadores sugeridos"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
        >
          <Mention
            trigger="@"
            data={users}
            markup="@[__display__](__id__)"
            displayTransform={(_id, display) => `@${display}`}
            style={mentionStyle}
            renderSuggestion={(suggestion, _search, highlightedDisplay) => (
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {(suggestion as { display?: string }).display?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm">{highlightedDisplay}</span>
              </div>
            )}
          />
        </MentionsInput>
      </div>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={!value.trim() || isSubmitting}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  )
}
