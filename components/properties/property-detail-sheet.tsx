'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2, Pencil } from 'lucide-react'
import { PropertyEditSheet } from '@/components/properties/property-edit-sheet'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { ADMIN_ROLES, classifyMember } from '@/lib/auth/roles'
import { PropertyApresentacaoTab } from '@/components/properties/property-apresentacao-tab'
import { PropertyInteressadosTab } from '@/components/properties/property-interessados-tab'
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
  const [editOpen, setEditOpen] = useState(false)

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
            <div className="flex items-center gap-1.5 sm:gap-2 mr-10 shrink-0">
              <Button
                size="sm"
                variant="outline"
                aria-label="Editar"
                className="rounded-full h-8 w-8 p-0 sm:w-auto sm:px-3 sm:gap-1.5 text-xs"
                onClick={() => setEditOpen(true)}
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full h-8 w-8 p-0 sm:w-auto sm:px-3 sm:gap-1.5 text-xs"
                title="Ver tudo"
              >
                <Link
                  href={fullPageHref}
                  onClick={() => onOpenChange(false)}
                  aria-label="Ver tudo"
                  className="inline-flex items-center justify-center"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ver tudo</span>
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading || !property ? (
          <DetailSkeleton />
        ) : (
          <Tabs defaultValue="apresentacao" className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 sm:px-6 pb-3">
              <div className="inline-flex items-center gap-1 p-0.5 sm:p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
                <TabsList className="bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="apresentacao"
                    className="rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
                  >
                    Apresentação
                  </TabsTrigger>
                  <TabsTrigger
                    value="interessados"
                    className="rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
                  >
                    Interessados
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent
              value="apresentacao"
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-10 m-0"
            >
              <PropertyApresentacaoTab property={property} />
            </TabsContent>

            <TabsContent
              value="interessados"
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-10 m-0"
            >
              <PropertyInteressadosTab
                propertyId={property.id}
                propertySlug={property.slug ?? null}
                propertyTitle={property.title ?? null}
                propertyPrice={property.listing_price ?? null}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>

      <PropertyEditSheet
        propertyId={editOpen ? property?.id ?? null : null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {
          // Refresh the underlying detail by re-fetching.
          if (propertyId) {
            fetch(`/api/properties/${propertyId}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => setProperty(d))
              .catch(() => {})
          }
        }}
      />
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
