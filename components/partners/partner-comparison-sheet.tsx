'use client'

import {
  X, Phone, Mail, Globe, MapPin, Star, CheckCircle2, XCircle, Briefcase,
} from 'lucide-react'
import { PARTNER_PAYMENT_OPTIONS } from '@/lib/constants'
import {
  usePartnerCategories,
  resolvePartnerCategoryColor,
} from '@/hooks/use-partner-categories'
import { resolvePartnerCategoryIcon } from '@/lib/partners/category-icons'
import type { Partner } from '@/types/partner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn, normalizeWebsiteUrl } from '@/lib/utils'

interface PartnerComparisonSheetProps {
  partners: Partner[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove?: (partner: Partner) => void
}

export function PartnerComparisonSheet({
  partners, open, onOpenChange, onRemove,
}: PartnerComparisonSheetProps) {
  const isMobile = useIsMobile()
  const { categories } = usePartnerCategories()
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-muted',
          isMobile
            ? 'data-[side=bottom]:h-[75dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[1100px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-4 sm:pt-10 gap-0">
          <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight">
            Comparar parceiros
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            {partners.length} parceiros lado-a-lado.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8">
          <div className="rounded-2xl bg-background border border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border-b border-r border-border/50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[180px]">
                      &nbsp;
                    </th>
                    {partners.map((p) => {
                      const cat = categoryMap[p.category]
                      const color = resolvePartnerCategoryColor(cat?.color || 'slate')
                      const Icon = resolvePartnerCategoryIcon(cat?.icon || 'Briefcase')
                      return (
                        <th key={p.id} className="border-b border-border/50 px-4 py-3 text-left align-top min-w-[240px]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', color.bg)}>
                                <Icon className={cn('h-5 w-5', color.text)} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[13px] leading-tight truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {cat?.label || p.category || 'Outro'}
                                </p>
                              </div>
                            </div>
                            {onRemove && (
                              <button
                                type="button"
                                onClick={() => onRemove(p)}
                                className="h-6 w-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                aria-label="Remover da comparação"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <Row label="Pessoa de contacto" partners={partners} value={(p) => p.contact_person || '—'} />
                  <Row label="Telemóvel" partners={partners} value={(p) => p.phone || '—'} href={(p) => p.phone ? `tel:${p.phone}` : undefined} icon={Phone} />
                  <Row label="Email" partners={partners} value={(p) => p.email || '—'} href={(p) => p.email ? `mailto:${p.email}` : undefined} icon={Mail} />
                  <Row label="Website" partners={partners} value={(p) => p.website || '—'} href={(p) => normalizeWebsiteUrl(p.website) || undefined} external icon={Globe} />
                  <Row label="Cidade" partners={partners} value={(p) => p.city || '—'} icon={MapPin} />
                  <Row
                    label="Rating"
                    partners={partners}
                    render={(p) => (
                      p.rating_count > 0 ? (
                        <div className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{p.rating_avg.toFixed(1)}</span>
                          <span className="text-muted-foreground text-xs">({p.rating_count})</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>
                    )}
                  />
                  <Row
                    label="Recomendado"
                    partners={partners}
                    render={(p) => p.is_recommended
                      ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sim</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  />
                  <Row
                    label="Activo"
                    partners={partners}
                    render={(p) => p.is_active
                      ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sim</span>
                      : <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" /> Não</span>
                    }
                  />
                  <Row
                    label="Especialidades"
                    partners={partners}
                    render={(p) => p.specialties && p.specialties.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.specialties.map((s) => (
                          <Badge key={s} variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">{s}</Badge>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  />
                  <Row
                    label="Zonas de actuação"
                    partners={partners}
                    render={(p) => p.service_areas && p.service_areas.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.service_areas.map((a) => (
                          <Badge key={a} variant="outline" className="rounded-full text-[10px] px-2 py-0.5">{a}</Badge>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  />
                  <Row
                    label="Método de pagamento"
                    partners={partners}
                    value={(p) => p.payment_method
                      ? (PARTNER_PAYMENT_OPTIONS.find((o) => o.value === p.payment_method)?.label || p.payment_method)
                      : '—'
                    }
                  />
                  <Row
                    label="Prazo médio (dias)"
                    partners={partners}
                    value={(p) => typeof p.average_delivery_days === 'number' ? String(p.average_delivery_days) : '—'}
                  />
                  <Row label="NIF / NIPC" partners={partners} value={(p) => p.nif || '—'} />
                  <Row
                    label="Descrição"
                    partners={partners}
                    render={(p) => p.description
                      ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{p.description}</p>
                      : <span className="text-muted-foreground">—</span>
                    }
                    last
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-border/40 flex justify-end">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  label, partners, value, render, href, external, icon: Icon, last,
}: {
  label: string
  partners: Partner[]
  value?: (p: Partner) => string
  render?: (p: Partner) => React.ReactNode
  href?: (p: Partner) => string | undefined
  external?: boolean
  icon?: React.ElementType
  last?: boolean
}) {
  return (
    <tr>
      <th className={cn(
        'sticky left-0 z-10 bg-background border-r border-border/50 px-4 py-3 text-left align-top text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[180px]',
        !last && 'border-b',
      )}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
      </th>
      {partners.map((p) => {
        const link = href?.(p)
        const content = render ? render(p) : value ? value(p) : '—'
        return (
          <td key={p.id} className={cn('px-4 py-3 align-top', !last && 'border-b border-border/50')}>
            {link ? (
              <a
                href={link}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className="text-sm hover:underline truncate inline-block max-w-[240px]"
              >
                {content}
              </a>
            ) : (
              <div className="text-sm">{content}</div>
            )}
          </td>
        )
      })}
    </tr>
  )
}
