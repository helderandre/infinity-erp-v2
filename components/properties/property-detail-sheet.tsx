'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { ADMIN_ROLES, classifyMember } from '@/lib/auth/roles'
import { PropertyApresentacaoTab } from '@/components/properties/property-apresentacao-tab'
import type { PropertyDetail } from '@/types/property'

interface PropertyDetailSheetProps {
  propertyId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PropertyDetailSheet({ propertyId, open, onOpenChange }: PropertyDetailSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !propertyId) {
      setProperty(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/properties/${propertyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProperty(data)
      })
      .catch(() => {
        if (!cancelled) setProperty(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, propertyId])

  const roleName = user?.role?.name
  const isStaffLike =
    classifyMember(roleName) === 'staff' ||
    ADMIN_ROLES.some((r) => r.toLowerCase() === roleName?.toLowerCase())
  const isOwner = !!property?.consultant?.id && property.consultant.id === user?.id
  const canSeeFullPage = isOwner || isStaffLike

  const fullPageHref = property
    ? `/dashboard/imoveis/${property.slug || property.id}`
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[880px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0 flex-row items-start justify-between">
          <div className="min-w-0">
            <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight truncate">
              {property?.title || 'Imóvel'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Apresentação do imóvel.
            </SheetDescription>
          </div>
          {canSeeFullPage && fullPageHref && (
            <div className="flex items-center gap-2 mr-10 shrink-0">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs gap-1.5"
              >
                <Link href={fullPageHref} onClick={() => onOpenChange(false)}>
                  Ver tudo
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading || !property ? (
          <DetailSkeleton />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-10">
            <PropertyApresentacaoTab property={property} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
      <Skeleton className="aspect-[16/10] rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-1/3 mt-2" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="flex items-center gap-2 text-muted-foreground/40 pt-4">
        <Building2 className="h-4 w-4" />
        <span className="text-xs">A carregar imóvel...</span>
      </div>
    </div>
  )
}
