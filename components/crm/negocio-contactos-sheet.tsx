'use client'

import { useState } from 'react'
import { Phone, Mail, MessageSquare, Copy, Check, User } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface NegocioContactosSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  phone: string | null
  email: string | null
}

export function NegocioContactosSheet({
  open, onOpenChange, clientName, phone, email,
}: NegocioContactosSheetProps) {
  const isMobile = useIsMobile()
  const [copied, setCopied] = useState<'phone' | 'email' | null>(null)

  const copyToClipboard = (text: string, label: string, key: 'phone' | 'email') => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success(`${label} copiado`)
    setTimeout(() => setCopied(null), 1800)
  }

  const cleanPhone = phone?.replace(/[^0-9+]/g, '') ?? ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:max-h-[75dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[440px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            Contactos
          </SheetTitle>
          <SheetDescription className="text-[12px] truncate">{clientName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          {phone && (
            <div className="rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</p>
                  <p className="text-sm font-semibold tabular-nums truncate">{phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(phone, 'Telefone', 'phone')}
                  className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/40 bg-background/60 backdrop-blur-xl hover:bg-background/80 active:scale-[0.96] transition-all duration-200"
                  aria-label="Copiar telefone"
                >
                  {copied === 'phone' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${phone}`}
                  className="group inline-flex flex-col items-center justify-center gap-1.5 h-[64px] rounded-xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
                  aria-label="Ligar"
                >
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400/25 to-emerald-600/5 ring-1 ring-inset ring-emerald-500/25 group-hover:ring-emerald-500/35 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.25} />
                  </span>
                  <span className="text-[10px] font-medium tracking-tight text-foreground/85">Ligar</span>
                </a>
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex flex-col items-center justify-center gap-1.5 h-[64px] rounded-xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
                  aria-label="WhatsApp"
                >
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-teal-400/25 to-teal-600/5 ring-1 ring-inset ring-teal-500/25 group-hover:ring-teal-500/35 transition-colors">
                    <WhatsAppIcon className="h-3.5 w-3.5 text-teal-700 dark:text-teal-300" />
                  </span>
                  <span className="text-[10px] font-medium tracking-tight text-foreground/85">WhatsApp</span>
                </a>
                <a
                  href={`sms:${phone}`}
                  className="group inline-flex flex-col items-center justify-center gap-1.5 h-[64px] rounded-xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
                  aria-label="SMS"
                >
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400/25 to-indigo-600/5 ring-1 ring-inset ring-indigo-500/25 group-hover:ring-indigo-500/35 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-300" strokeWidth={2.25} />
                  </span>
                  <span className="text-[10px] font-medium tracking-tight text-foreground/85">SMS</span>
                </a>
              </div>
            </div>
          )}

          {email && (
            <div className="rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="text-sm font-semibold truncate">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(email, 'Email', 'email')}
                  className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/40 bg-background/60 backdrop-blur-xl hover:bg-background/80 active:scale-[0.96] transition-all duration-200"
                  aria-label="Copiar email"
                >
                  {copied === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              <a
                href={`mailto:${email}`}
                className="group inline-flex items-center justify-center gap-2.5 h-12 w-full rounded-xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
                aria-label="Enviar email"
              >
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-sky-400/25 to-sky-600/5 ring-1 ring-inset ring-sky-500/25 group-hover:ring-sky-500/35 transition-colors">
                  <Mail className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" strokeWidth={2.25} />
                </span>
                <span className="text-sm font-medium tracking-tight text-foreground/85">Enviar email</span>
              </a>
            </div>
          )}

          {!phone && !email && (
            <div className="rounded-2xl border border-dashed border-border/40 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Sem contactos registados.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
