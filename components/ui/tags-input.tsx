'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { X, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagsInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  suggestions?: readonly string[]
}

/**
 * Multi-tag input that stores values as comma-separated string.
 * Supports optional autocomplete suggestions.
 */
export function TagsInput({
  value,
  onChange,
  placeholder = 'Adicionar...',
  className,
  disabled,
  suggestions,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const tags = value
    ? value.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const tagsLower = tags.map((t) => t.toLowerCase())

  // Filter suggestions: match input, exclude already-added tags
  const filtered = suggestions && inputValue.trim().length >= 1
    ? suggestions.filter((s) => {
        const lower = s.toLowerCase()
        const query = inputValue.trim().toLowerCase()
        return lower.includes(query) && !tagsLower.includes(lower)
      }).slice(0, 8)
    : []

  const commitTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag) return
    if (tagsLower.includes(tag.toLowerCase())) return
    const next = [...tags, tag].join(', ')
    onChange(next)
    setInputValue('')
    setShowSuggestions(false)
    setHighlightIndex(-1)
  }

  const removeTag = (index: number) => {
    const next = tags.filter((_, i) => i !== index).join(', ')
    onChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
        return
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault()
        commitTag(filtered[highlightIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        setHighlightIndex(-1)
        return
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (inputValue.trim()) {
        commitTag(inputValue)
      }
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }, 150)
  }

  const handleInputChange = (val: string) => {
    setInputValue(val)
    setHighlightIndex(-1)
    if (val.trim().length >= 1 && suggestions && suggestions.length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.children
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightIndex])

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-[2rem] cursor-text',
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(i)
                }}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => {
              if (inputValue.trim().length >= 1 && filtered.length > 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((suggestion, i) => {
            const query = inputValue.trim().toLowerCase()
            const idx = suggestion.toLowerCase().indexOf(query)
            const before = suggestion.slice(0, idx)
            const match = suggestion.slice(idx, idx + query.length)
            const after = suggestion.slice(idx + query.length)

            return (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitTag(suggestion)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  i === highlightIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted',
                )}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  {before}
                  <span className="font-semibold">{match}</span>
                  {after}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Display-only version for non-editing mode.
 * Shows tags as pills without remove buttons.
 */
export function TagsDisplay({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const tags = value
    ? value.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  if (tags.length === 0) return <span className="text-sm font-medium">—</span>

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
