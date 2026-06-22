'use client'

import { useState, type ReactNode } from 'react'
import { ContactOutcomeSheet } from '@/components/crm/contact-outcome-sheet'

interface CallContactButtonProps {
  /** Phone number to dial. Will be normalized into a tel: URL. */
  phone: string
  /** Display name of the contact (lead, owner, interessado) for the dialog */
  contactName?: string | null
  /** Pre-fill the funnel side. Kept for backwards compatibility; the outcome
   *  endpoint now derives the side automatically from the opportunity/lead. */
  defaultSide?: 'vendedor' | 'comprador'
  /** Lead/contact id — when present, the answered/missed outcome is logged to
   *  the contact's history + funnel + objetivos via the unified outcome sheet.
   *  Skipped (plain tel: only) when absent. */
  leadId?: string | null
  /** Opportunity this call belongs to, so the outcome links to the négocio. */
  negocioId?: string | null
  /** Retained for call-site compatibility (no longer used directly). */
  sourceRefType?: string
  sourceRefId?: string | null
  /** Children = the trigger UI (icon, label, etc). */
  children: ReactNode
  /** Class on the anchor element */
  className?: string
  /** ARIA label override */
  ariaLabel?: string
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^+\d]/g, '')
}

// Wraps a phone-call trigger. The anchor still fires tel: natively (so the OS
// phone app opens); when we have the contact's lead id we then open the single
// canonical <ContactOutcomeSheet>, which records the result to the history, the
// lead-entry funnel and the objetivos ledger through one endpoint. This avoids
// the previous double-write into a second goals table.
export function CallContactButton({
  phone,
  contactName,
  leadId,
  negocioId,
  children,
  className,
  ariaLabel,
}: CallContactButtonProps) {
  const [open, setOpen] = useState(false)
  const tel = `tel:${normalizePhone(phone)}`

  function handleClick() {
    if (!leadId) return
    // Slight delay so the tel: link fires first (mobile OS opens dialer),
    // then the outcome sheet appears once the user comes back to the browser.
    setTimeout(() => setOpen(true), 50)
  }

  return (
    <>
      <a href={tel} onClick={handleClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>

      {leadId && (
        <ContactOutcomeSheet
          open={open}
          onOpenChange={setOpen}
          contactId={leadId}
          contactName={contactName}
          phone={phone}
          negocioId={negocioId ?? null}
          channel="phone"
        />
      )}
    </>
  )
}
