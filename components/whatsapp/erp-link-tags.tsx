'use client'

import { useEffect, useState } from 'react'
import { User, UserPlus, Building2, FileCheck, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

interface OwnerData {
  id: string
  name: string
  email: string | null
  phone: string | null
  nif: string | null
  person_type: string | null
  properties: Array<{
    id: string
    title: string
    slug: string | null
    status: string
    listing_price: number | null
    property_type: string | null
    city: string | null
  }>
  processes: Array<{
    id: string
    external_ref: string | null
    current_status: string
    percent_complete: number
    property_id: string
  }>
}

interface LeadData {
  id: string
  name: string
  email: string | null
  phone_primary: string | null
  status: string
  score: number | null
  source: string | null
  lead_type: string | null
  priority: string | null
  negocios: Array<{
    id: string
    tipo: string | null
    estado: string | null
    tipo_imovel: string | null
    localizacao: string | null
    orcamento_max: number | null
  }>
}

interface ErpLinkTagsProps {
  contactId: string
}

export function ErpLinkTags({ contactId }: ErpLinkTagsProps) {
  const [owner, setOwner] = useState<OwnerData | null>(null)
  const [lead, setLead] = useState<LeadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/whatsapp/contacts/${contactId}/erp-data`)
      .then((r) => r.json())
      .then((data) => {
        setOwner(data.owner || null)
        setLead(data.lead || null)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [contactId])

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-48" />
      </div>
    )
  }

  if (!owner && !lead) return null

  return (
    <div className="space-y-3">
      {/* Owner */}
      {owner && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
            <User className="h-3.5 w-3.5" />
            Proprietario
          </div>
          <div className="flex flex-wrap gap-1">
            <Link href={`/dashboard/proprietarios/${owner.id}`}>
              <Badge variant="default" className="text-xs cursor-pointer hover:opacity-80">
                {owner.name}
                {owner.nif ? ` (${owner.nif})` : ''}
              </Badge>
            </Link>
          </div>

          {/* Imoveis */}
          {owner.properties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {owner.properties.map((p) => (
                <Link key={p.id} href={`/dashboard/imoveis/${p.slug || p.id}`}>
                  <Badge variant="secondary" className="text-[11px] cursor-pointer hover:opacity-80">
                    <Building2 className="h-3 w-3 mr-1" />
                    <span className="truncate max-w-[120px]">{p.title}</span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Processos */}
          {owner.processes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {owner.processes.map((proc) => (
                <Link key={proc.id} href={`/dashboard/processos/${proc.id}`}>
                  <Badge variant="secondary" className="text-[11px] cursor-pointer hover:opacity-80">
                    <FileCheck className="h-3 w-3 mr-1" />
                    {proc.external_ref || proc.id.slice(0, 8)} ({proc.percent_complete}%)
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead */}
      {lead && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <UserPlus className="h-3.5 w-3.5" />
            Lead
          </div>
          <div className="flex flex-wrap gap-1">
            <Link href={`/dashboard/leads/${lead.id}`}>
              <Badge variant="default" className="text-xs cursor-pointer hover:opacity-80 bg-amber-600 hover:bg-amber-700">
                {lead.name} — {lead.status}
                {lead.score != null ? ` (Score: ${lead.score})` : ''}
              </Badge>
            </Link>
          </div>

          {/* Negocios */}
          {lead.negocios.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lead.negocios.map((neg) => (
                <Link key={neg.id} href={`/dashboard/leads/${lead.id}/negocios/${neg.id}`}>
                  <Badge variant="secondary" className="text-[11px] cursor-pointer hover:opacity-80">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    {neg.tipo || 'Negocio'} — {neg.tipo_imovel || ''}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
