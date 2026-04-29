'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Handshake, Mail, MessageCircle, Phone,
  User, UserCheck, ArrowUpRight, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WhatsappChatSheet } from '@/components/whatsapp/whatsapp-chat-sheet'
import type { TaskEntityType } from '@/types/task'

interface Props {
  entityType: TaskEntityType
  entityId: string
}

type ResolvedEntity = {
  label: string
  subtitle?: string
  href: string
  icon: 'lead' | 'negocio' | 'property' | 'owner' | 'process' | 'lead_entry'
  /** Phone / email — populated when there's a contactable lead behind the
   *  entity (lead, owner, negocio's linked contact, lead_entry's matched
   *  contact, etc.). */
  phone?: string
  email?: string
  contactHref?: string
  /** Optional secondary link — used by the process card to expose the
   *  property tied to it as a separate clickable row. */
  secondaryHref?: string
  secondaryLabel?: string
}

async function fetchEntity(
  entityType: TaskEntityType,
  entityId: string
): Promise<ResolvedEntity | null> {
  try {
    if (entityType === 'lead') {
      const res = await fetch(`/api/leads/${entityId}`)
      if (!res.ok) return null
      const data = await res.json()
      const l = data?.data ?? data
      if (!l?.id) return null
      return {
        label: String(l.nome ?? 'Contacto'),
        subtitle: [l.estado, l.origem].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/leads/${l.id}`,
        icon: 'lead',
        phone: l.telemovel ? String(l.telemovel) : undefined,
        email: l.email ? String(l.email) : undefined,
      }
    }
    if (entityType === 'negocio') {
      const res = await fetch(`/api/negocios/${entityId}`)
      if (!res.ok) return null
      const data = await res.json()
      const n = data?.data ?? data
      if (!n?.id) return null
      // Negócios carry their lead's contact info indirectly — fetch the lead
      // too so the Call/WhatsApp/Email buttons work off the real recipient.
      let phone: string | undefined
      let email: string | undefined
      let contactHref: string | undefined
      if (n.lead_id) {
        try {
          const lr = await fetch(`/api/leads/${n.lead_id}`)
          if (lr.ok) {
            const ld = await lr.json()
            const l = ld?.data ?? ld
            if (l?.telemovel) phone = String(l.telemovel)
            if (l?.email) email = String(l.email)
            contactHref = `/dashboard/leads/${l.id}`
          }
        } catch {
          /* non-fatal */
        }
      }
      const label = n.tipo_imovel
        ? `${n.tipo} · ${n.tipo_imovel}`
        : (n.tipo ? String(n.tipo) : 'Negócio')
      return {
        label,
        subtitle: [n.localizacao, n.estado].filter(Boolean).join(' · ') || undefined,
        // Abre a página do contacto com o sheet do negócio aberto. A página
        // /dashboard/leads/[id] consome `?negocio=<id>` e abre o
        // <NegocioDetailSheet> automaticamente. Para negócios sem contacto
        // associado (raros), cai no detalhe full-screen do negócio.
        href: n.lead_id
          ? `/dashboard/leads/${n.lead_id}?negocio=${n.id}`
          : `/dashboard/negocios/${n.id}`,
        icon: 'negocio',
        phone,
        email,
        contactHref,
      }
    }
    if (entityType === 'property') {
      const res = await fetch(`/api/properties/${entityId}`)
      if (!res.ok) return null
      const data = await res.json()
      const p = data?.data ?? data
      if (!p?.id) return null
      return {
        label: String(p.title ?? 'Imóvel'),
        subtitle: [p.city, p.external_ref].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/imoveis/${p.id}`,
        icon: 'property',
      }
    }
    if (entityType === 'lead_entry') {
      // Lead = entrada bruta no funil (`leads_entries`). Quando há contacto
      // associado, expomos os botões de Ligar/WhatsApp/Email como em qualquer
      // contacto. O click principal abre a página do contacto se já existir,
      // senão a listagem de leads-entries (ainda sem detalhe dedicado).
      const res = await fetch(`/api/lead-entries/${entityId}`)
      if (!res.ok) return null
      const le: any = await res.json()
      if (!le?.id) return null
      const contact = le.contact ?? null
      const label = contact?.nome || le.source || 'Lead sem contacto'
      const subtitle = [le.source, le.status].filter(Boolean).join(' · ') || undefined
      return {
        label,
        subtitle,
        href: contact?.id ? `/dashboard/leads/${contact.id}` : `/dashboard/crm/lead-entries`,
        icon: 'lead_entry',
        phone: contact?.telemovel ? String(contact.telemovel) : undefined,
        email: contact?.email ? String(contact.email) : undefined,
        contactHref: contact?.id ? `/dashboard/leads/${contact.id}` : undefined,
      }
    }
    if (entityType === 'process') {
      // Processo: dependendo do tipo, o "container" canónico é diferente.
      //   - process_type='angariacao' → página do imóvel (tab Processo).
      //   - process_type='negocio'    → detalhe do negócio (tab Processo).
      // Mantemos o link à propriedade como acção secundária quando existe.
      const res = await fetch(`/api/processes/${entityId}`)
      if (!res.ok) return null
      const data = await res.json()
      const p: any = data?.data ?? data
      if (!p?.id) return null
      const isNeg = p.process_type === 'negocio'
      const propertyId = p.property?.id ?? p.property_id ?? null
      const propertyTitle = p.property?.title ?? null
      const negocioId = p.negocio_id ?? null
      const leadId = p.negocio?.lead_id ?? null
      // Click principal:
      let href = `/dashboard/processos/${p.id}`
      if (isNeg && negocioId) {
        href = leadId
          ? `/dashboard/leads/${leadId}/negocios/${negocioId}?tab=processo`
          : `/dashboard/negocios/${negocioId}?tab=processo`
      } else if (!isNeg && propertyId) {
        href = `/dashboard/imoveis/${propertyId}?tab=processo`
      }
      const label = p.external_ref || (isNeg ? 'Processo de negócio' : 'Processo de angariação')
      const subtitleParts = [
        isNeg ? 'Negócio' : 'Angariação',
        propertyTitle,
      ].filter(Boolean) as string[]
      return {
        label,
        subtitle: subtitleParts.join(' · ') || undefined,
        href,
        icon: 'process',
        // Link secundário para o imóvel (quando existe) — útil para abrir a
        // página do imóvel directamente sem passar pela tab.
        secondaryHref: propertyId ? `/dashboard/imoveis/${propertyId}` : undefined,
        secondaryLabel: propertyTitle ?? undefined,
      }
    }
    if (entityType === 'owner') {
      // No dedicated owner detail page today — fall back to the proprietários
      // list. If one gets added later, swap the href.
      const res = await fetch(`/api/owners/${entityId}`).catch(() => null)
      if (!res || !res.ok) return null
      const data = await res.json()
      const o = data?.data ?? data
      if (!o?.id) return null
      return {
        label: String(o.name ?? 'Proprietário'),
        subtitle: [o.nif, o.email].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/proprietarios?owner=${o.id}`,
        icon: 'owner',
        phone: o.phone ? String(o.phone) : undefined,
        email: o.email ? String(o.email) : undefined,
      }
    }
    return null
  } catch {
    return null
  }
}

const ICON_MAP = {
  lead: User,
  lead_entry: User,
  negocio: Handshake,
  property: Building2,
  owner: UserCheck,
  process: Building2,
} as const

export function TaskEntityCard({ entityType, entityId }: Props) {
  const [entity, setEntity] = useState<ResolvedEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [waSheetOpen, setWaSheetOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEntity(null)
    fetchEntity(entityType, entityId).then((r) => {
      if (cancelled) return
      setEntity(r)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [entityType, entityId])

  if (loading) {
    return (
      <div className="rounded-lg bg-muted/40 ring-1 ring-border/50 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        A carregar {entityType === 'lead' ? 'contacto' : entityType === 'negocio' ? 'negócio' : 'entidade'}…
      </div>
    )
  }

  if (!entity) {
    return null
  }

  const Icon = ICON_MAP[entity.icon] ?? User
  const hasContactActions = Boolean(entity.phone || entity.email)

  return (
    <>
      {entity.phone && (
        <WhatsappChatSheet
          open={waSheetOpen}
          onOpenChange={setWaSheetOpen}
          phone={entity.phone}
          contactName={entity.label}
        />
      )}
    <div className="rounded-lg bg-muted/40 ring-1 ring-border/50 p-3 space-y-2.5">
      <Link
        href={entity.href}
        className="flex items-start gap-2.5 group"
      >
        <div className="h-8 w-8 shrink-0 rounded-md bg-background flex items-center justify-center ring-1 ring-border/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate group-hover:underline">
            {entity.label}
          </p>
          {entity.subtitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {entity.subtitle}
            </p>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground group-hover:text-foreground" />
      </Link>

      {hasContactActions && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          {entity.phone && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-full"
            >
              <a href={`tel:${entity.phone}`}>
                <Phone className="h-3 w-3" />
                Ligar
              </a>
            </Button>
          )}
          {entity.phone && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-full"
              onClick={() => setWaSheetOpen(true)}
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </Button>
          )}
          {entity.email && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-full"
            >
              <a href={`mailto:${entity.email}`}>
                <Mail className="h-3 w-3" />
                Email
              </a>
            </Button>
          )}
          {entity.contactHref && entity.icon === 'negocio' && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={cn('h-7 text-[11px] gap-1 rounded-full')}
            >
              <Link href={entity.contactHref}>
                <User className="h-3 w-3" />
                Ver contacto
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Secondary link — usado pelo cartão de Processo para mostrar o
          imóvel associado como atalho extra. */}
      {entity.secondaryHref && entity.secondaryLabel && (
        <div className="pt-1 border-t border-border/50">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 rounded-full px-2"
          >
            <Link href={entity.secondaryHref}>
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[180px]">{entity.secondaryLabel}</span>
              <ArrowUpRight className="h-3 w-3 ml-0.5 opacity-60" />
            </Link>
          </Button>
        </div>
      )}
    </div>
    </>
  )
}
