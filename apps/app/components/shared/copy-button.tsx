'use client'

import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  variant?: 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'icon' | 'default'
}

export function CopyButton({ value, label, className, variant = 'ghost', size = 'icon' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(true)
    toast.success(label ? `${label} copiado!` : 'Copiado!')
    setTimeout(() => setCopied(false), 2000)
  }, [value, label])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('h-7 w-7', className)}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  )
}
