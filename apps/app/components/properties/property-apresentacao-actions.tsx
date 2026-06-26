'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExternalLink } from 'lucide-react'
import { SharePropertyButton } from '@/components/properties/share-property-button'
import type { PropertyDetail } from '@/types/property'

interface Props {
  property: PropertyDetail
  /**
   * Quando `false`, os toggles "Mostrar na apresentação" do SharePropertyButton
   * ficam read-only. SharePropertyButton e Ver Online continuam funcionais para
   * todos. (Gerar apresentação (PDF) e a gestão de disponibilidade não vivem
   * nesta sheet — fazem-se na página completa do imóvel. A sheet é a vista que
   * os colegas veem, não a do próprio dono.)
   */
  canShareAsOwner: boolean
}

export function PropertyApresentacaoActions({ property, canShareAsOwner }: Props) {
  return (
    <div className="flex items-center gap-2">
      <ViewOnlinePopover property={property} />
      {/* Partilhar — sempre o botão mais à direita da sheet. */}
      <SharePropertyButton
        propertyId={property.id}
        propertySlug={property.slug ?? null}
        propertyTitle={property.title ?? ''}
        propertyConsultantId={property.consultant_id ?? null}
        showStaging={(property as any).presentation_show_staging !== false}
        showAiPlantas={(property as any).presentation_show_ai_plantas !== false}
        canEditFlags={canShareAsOwner}
      />
    </div>
  )
}

function ViewOnlinePopover({ property }: { property: PropertyDetail }) {
  const portals: Array<{
    key: string
    label: string
    domain: string
    url: string | null
  }> = [
    {
      key: 'infinity',
      label: 'Infinity',
      domain: 'infinitygroup.pt',
      url:
        (property as any).link_portal_infinity ||
        `https://infinitygroup.pt/property/${property.slug || property.id}`,
    },
    {
      key: 'remax',
      label: 'RE/MAX',
      domain: 'remax.pt',
      url:
        (property as any).link_portal_remax ||
        (property.external_ref ? `https://www.remax.pt/${property.external_ref}` : null),
    },
    {
      key: 'idealista',
      label: 'Idealista',
      domain: 'idealista.pt',
      url: (property as any).link_portal_idealista || null,
    },
    {
      key: 'imovirtual',
      label: 'Imovirtual',
      domain: 'imovirtual.com',
      url: (property as any).link_portal_imovirtual || null,
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
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 overflow-hidden border border-border/50 bg-background shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${p.domain}&sz=64`}
                    alt={p.label}
                    className="h-4 w-4"
                    loading="lazy"
                  />
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
