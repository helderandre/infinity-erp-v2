'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExternalLink, FileDown } from 'lucide-react'
import { GeneratePresentationDialog } from '@/components/apresentacao/generate-presentation-dialog'
import { BookingLinkDialog } from '@/components/booking/booking-link-dialog'
import { SharePropertyButton } from '@/components/properties/share-property-button'
import { PresentationOverridesSheet } from '@/components/properties/presentation-overrides-sheet'
import type { PropertyDetail } from '@/types/property'

interface Props {
  property: PropertyDetail
  /**
   * Quando `false`, BookingLinkDialog e GeneratePresentationDialog não são
   * renderizados, e os toggles "Mostrar na apresentação" do
   * SharePropertyButton ficam read-only. SharePropertyButton e Ver Online
   * continuam funcionais para todos.
   */
  canShareAsOwner: boolean
}

export function PropertyApresentacaoActions({ property, canShareAsOwner }: Props) {
  const [overridesOpen, setOverridesOpen] = useState(false)
  const [overrides, setOverrides] = useState(
    (property as any).presentation_overrides ?? null,
  )

  return (
    <>
      <div className="flex items-center gap-2">
        <SharePropertyButton
          propertyId={property.id}
          propertySlug={property.slug ?? null}
          propertyTitle={property.title ?? ''}
          propertyConsultantId={property.consultant_id ?? null}
          showStaging={(property as any).presentation_show_staging !== false}
          showAiPlantas={(property as any).presentation_show_ai_plantas !== false}
          canEditFlags={canShareAsOwner}
        />
        <ViewOnlinePopover property={property} />
        {canShareAsOwner && (
          <BookingLinkDialog
            propertyId={property.id}
            propertySlug={property.slug ?? null}
            consultantId={property.consultant_id ?? null}
          />
        )}
        {canShareAsOwner && (
          <GeneratePresentationDialog
            propertyId={property.id}
            onEditClick={() => setOverridesOpen(true)}
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                title="Gerar apresentação (PDF)"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </div>

      {canShareAsOwner && (
        <PresentationOverridesSheet
          open={overridesOpen}
          onOpenChange={setOverridesOpen}
          propertyId={property.id}
          media={property.dev_property_media || []}
          initial={overrides}
          onSaved={(next) => setOverrides(next)}
        />
      )}
    </>
  )
}

function ViewOnlinePopover({ property }: { property: PropertyDetail }) {
  const portals: Array<{
    key: string
    label: string
    url: string | null
    bg: string
    hover: string
    icon: React.ReactNode
  }> = [
    {
      key: 'infinity',
      label: 'Infinity',
      url:
        (property as any).link_portal_infinity ||
        `https://infinitygroup.pt/property/${property.slug || property.id}`,
      bg: 'bg-black',
      hover: 'hover:bg-neutral-800',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2C8.2 7.18 6.84 6.62 5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53l7.03-6.24c.64-.64 1.49-.99 2.4-.99 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03l-1.14-1.01-1.51 1.34 1.27 1.12c1.02 1.01 2.37 1.57 3.82 1.57 2.98 0 5.4-2.41 5.4-5.38s-2.42-5.37-5.4-5.37z" />
        </svg>
      ),
    },
    {
      key: 'remax',
      label: 'Remax',
      url:
        (property as any).link_portal_remax ||
        (property.external_ref ? `https://www.remax.pt/${property.external_ref}` : null),
      bg: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#EF4444" />
        </svg>
      ),
    },
    {
      key: 'idealista',
      label: 'Idealista',
      url: (property as any).link_portal_idealista || null,
      bg: 'bg-yellow-400',
      hover: 'hover:bg-yellow-300',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#000" />
        </svg>
      ),
    },
    {
      key: 'imovirtual',
      label: 'Imovirtual',
      url: (property as any).link_portal_imovirtual || null,
      bg: 'bg-red-500',
      hover: 'hover:bg-red-600',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#fff" />
        </svg>
      ),
    },
  ]

  const availablePortals = portals.filter((p) => !!p.url)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          title="Ver online"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-1.5">
          Ver online em
        </div>
        {availablePortals.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Sem portais disponíveis para este imóvel.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {availablePortals.map((p) => (
              <a
                key={p.key}
                href={p.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 shadow-sm',
                    p.bg,
                    p.hover,
                  )}
                >
                  {p.icon}
                </span>
                <span className="flex-1 font-medium">{p.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
