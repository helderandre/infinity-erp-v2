'use client'

import { useState, useCallback } from 'react'
import { Phone, Mail, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CallOutcomeModal } from './call-outcome-modal'

interface ContactActionButtonsProps {
  contactId: string
  phone?: string | null
  email?: string | null
  name?: string
  negocioId?: string | null
  className?: string
  size?: 'sm' | 'md'
}

type ContactMethod = 'phone' | 'email' | 'whatsapp'

export function ContactActionButtons({
  contactId,
  phone,
  email,
  name,
  negocioId,
  className,
  size = 'md',
}: ContactActionButtonsProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone')

  const handleContact = useCallback((method: ContactMethod) => {
    setContactMethod(method)

    // Open the native contact method
    if (method === 'phone' && phone) {
      window.open(`tel:${phone}`, '_self')
    } else if (method === 'email' && email) {
      window.open(`mailto:${email}`, '_self')
    } else if (method === 'whatsapp' && phone) {
      const cleaned = phone.replace(/\D/g, '')
      window.open(`https://wa.me/${cleaned}`, '_blank')
    }

    // Show outcome modal after a brief delay (let the native action trigger)
    setTimeout(() => setOutcomeOpen(true), 500)
  }, [phone, email])

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const btnSize = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'

  return (
    <>
      <div className={cn('flex gap-3', className)}>
        {phone && (
          <button
            onClick={() => handleContact('phone')}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={cn(
              btnSize,
              'rounded-full bg-green-50 dark:bg-green-950 flex items-center justify-center',
              'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 transition-colors'
            )}>
              <Phone className={iconSize} />
            </div>
            {size === 'md' && <span className="text-[0.65rem] text-muted-foreground">Ligar</span>}
          </button>
        )}

        {phone && (
          <button
            onClick={() => handleContact('whatsapp')}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={cn(
              btnSize,
              'rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center',
              'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors'
            )}>
              <MessageCircle className={iconSize} />
            </div>
            {size === 'md' && <span className="text-[0.65rem] text-muted-foreground">WhatsApp</span>}
          </button>
        )}

        {email && (
          <button
            onClick={() => handleContact('email')}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={cn(
              btnSize,
              'rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center',
              'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors'
            )}>
              <Mail className={iconSize} />
            </div>
            {size === 'md' && <span className="text-[0.65rem] text-muted-foreground">Email</span>}
          </button>
        )}
      </div>

      <CallOutcomeModal
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        contactId={contactId}
        contactName={name}
        contactMethod={contactMethod}
        negocioId={negocioId}
      />
    </>
  )
}
