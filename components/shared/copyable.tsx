'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Inline value + small copy-to-clipboard button. Use whenever a user is likely
 * to want to copy the displayed text — phone numbers, emails, NIFs, NIPCs,
 * property/process references, addresses, postal codes.
 *
 * The value prop is what gets copied. Children (if provided) are what's
 * rendered; defaults to the raw value. The copy button is always visible on
 * mobile and fades in on desktop hover.
 *
 * Because the voice long-press trigger would hijack taps on this element,
 * we mark it `data-no-long-press` — long-press here never opens the voice
 * assistant.
 */
export function Copyable({
  value,
  children,
  label,
  className,
  inline = true,
}: {
  value: string | number | null | undefined
  children?: React.ReactNode
  /** Optional context label, e.g. "Telemóvel" — used in the toast. */
  label?: string
  className?: string
  /** When false, renders block-level (for cards). Default inline. */
  inline?: boolean
}) {
  const [copied, setCopied] = useState(false)

  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }

  const text = String(value)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for very old browsers
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      toast.success(label ? `${label} copiado` : 'Copiado')
      setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const Wrapper = inline ? 'span' : 'div'

  return (
    <Wrapper
      data-no-long-press
      className={cn(
        inline
          ? 'inline-flex items-center gap-1.5 group/copyable'
          : 'flex items-center gap-1.5 group/copyable',
        className
      )}
    >
      <span className="min-w-0">{children ?? text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'shrink-0 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors',
          'sm:opacity-0 sm:group-hover/copyable:opacity-100 sm:focus:opacity-100'
        )}
        aria-label={label ? `Copiar ${label.toLowerCase()}` : 'Copiar'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </Wrapper>
  )
}
