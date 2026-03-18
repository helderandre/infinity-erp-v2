'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { createClient } from '@/lib/supabase/client'

interface Owner {
  id: string
  name: string
  nif: string | null
  phone: string | null
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone_primary: string | null
}

interface ContactLinkDialogProps {
  contactId: string
  instanceId: string
  currentOwnerId?: string | null
  currentLeadId?: string | null
  onLinked: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContactLinkDialog({
  contactId,
  instanceId,
  currentOwnerId,
  currentLeadId,
  onLinked,
  open,
  onOpenChange,
}: ContactLinkDialogProps) {
  const [ownerSearch, setOwnerSearch] = useState('')
  const [leadSearch, setLeadSearch] = useState('')
  const [owners, setOwners] = useState<Owner[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [linking, setLinking] = useState(false)

  const debouncedOwnerSearch = useDebounce(ownerSearch, 300)
  const debouncedLeadSearch = useDebounce(leadSearch, 300)

  // Search owners
  useEffect(() => {
    if (!debouncedOwnerSearch || debouncedOwnerSearch.length < 2) {
      setOwners([])
      return
    }

    setLoadingOwners(true)
    const supabase = createClient()
    supabase
      .from('owners')
      .select('id, name, nif, phone')
      .or(`name.ilike.%${debouncedOwnerSearch}%,nif.ilike.%${debouncedOwnerSearch}%,phone.ilike.%${debouncedOwnerSearch}%`)
      .limit(10)
      .then(({ data }) => {
        setOwners((data as Owner[]) || [])
        setLoadingOwners(false)
      })
  }, [debouncedOwnerSearch])

  // Search leads
  useEffect(() => {
    if (!debouncedLeadSearch || debouncedLeadSearch.length < 2) {
      setLeads([])
      return
    }

    setLoadingLeads(true)
    const supabase = createClient()
    supabase
      .from('leads')
      .select('id, nome, email, telemovel')
      .or(`nome.ilike.%${debouncedLeadSearch}%,email.ilike.%${debouncedLeadSearch}%,telemovel.ilike.%${debouncedLeadSearch}%`)
      .limit(10)
      .then(({ data }) => {
        // Mapear colunas PT para interface Lead
        const mapped = (data || []).map((l: any) => ({
          id: l.id,
          name: l.nome,
          email: l.email,
          phone_primary: l.telemovel,
        }))
        setLeads(mapped)
        setLoadingLeads(false)
      })
  }, [debouncedLeadSearch])

  const handleLink = useCallback(
    async (type: 'owner' | 'lead', id: string | null) => {
      setLinking(true)
      try {
        const body = type === 'owner' ? { owner_id: id } : { lead_id: id }
        const res = await fetch(
          `/api/whatsapp/instances/${instanceId}/contacts/${contactId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )

        if (!res.ok) throw new Error('Erro ao vincular')

        toast.success(id ? 'Contacto vinculado com sucesso' : 'Vinculacao removida com sucesso')
        onLinked()
        onOpenChange(false)
      } catch {
        toast.error('Erro ao vincular contacto')
      } finally {
        setLinking(false)
      }
    },
    [contactId, instanceId, onLinked, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Vincular contacto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="owner" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="owner" className="flex-1">Proprietario</TabsTrigger>
            <TabsTrigger value="lead" className="flex-1">Lead</TabsTrigger>
          </TabsList>

          {/* Tab Proprietario */}
          <TabsContent value="owner" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, NIF ou telefone..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {loadingOwners ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : owners.length > 0 ? (
                <RadioGroup
                  value={selectedOwnerId || ''}
                  onValueChange={setSelectedOwnerId}
                >
                  {owners.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 p-2.5 rounded-md border hover:bg-muted/50"
                    >
                      <RadioGroupItem value={o.id} id={`owner-${o.id}`} />
                      <Label htmlFor={`owner-${o.id}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.nif && <span>NIF: {o.nif}</span>}
                          {o.nif && o.phone && <span> | </span>}
                          {o.phone && <span>{o.phone}</span>}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : debouncedOwnerSearch.length >= 2 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum proprietario encontrado
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end">
              {currentOwnerId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink('owner', null)}
                  disabled={linking}
                >
                  Desvincular
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleLink('owner', selectedOwnerId)}
                disabled={!selectedOwnerId || linking}
              >
                Vincular
              </Button>
            </div>
          </TabsContent>

          {/* Tab Lead */}
          <TabsContent value="lead" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email ou telefone..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {loadingLeads ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : leads.length > 0 ? (
                <RadioGroup
                  value={selectedLeadId || ''}
                  onValueChange={setSelectedLeadId}
                >
                  {leads.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 p-2.5 rounded-md border hover:bg-muted/50"
                    >
                      <RadioGroupItem value={l.id} id={`lead-${l.id}`} />
                      <Label htmlFor={`lead-${l.id}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.email && <span>{l.email}</span>}
                          {l.email && l.phone_primary && <span> | </span>}
                          {l.phone_primary && <span>{l.phone_primary}</span>}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : debouncedLeadSearch.length >= 2 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead encontrado
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end">
              {currentLeadId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink('lead', null)}
                  disabled={linking}
                >
                  Desvincular
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleLink('lead', selectedLeadId)}
                disabled={!selectedLeadId || linking}
              >
                Vincular
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
