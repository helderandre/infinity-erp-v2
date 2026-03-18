'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Wand2, Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { useWhatsAppContacts } from '@/hooks/use-whatsapp-contacts'
import { InstanceSelector } from '@/components/whatsapp/instance-selector'
import { ContactCard } from '@/components/whatsapp/contact-card'
import { ContactLinkDialog } from '@/components/whatsapp/contact-link-dialog'
import type { WppContact } from '@/lib/types/whatsapp-web'

interface Instance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
}

interface ContactsPageClientProps {
  instances: Instance[]
}

export function ContactsPageClient({ instances }: ContactsPageClientProps) {
  const router = useRouter()
  const [selectedInstance, setSelectedInstance] = useState(instances[0]?.id || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [linkedFilter, setLinkedFilter] = useState<string>('all')
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<WppContact | null>(null)
  const [autoMatchLoading, setAutoMatchLoading] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 300)
  const { contacts, isLoading, total, fetchContacts, syncContacts } =
    useWhatsAppContacts(selectedInstance || null)

  // Fetch on filter changes
  useEffect(() => {
    if (!selectedInstance) return
    const opts: { search?: string; linked?: string } = {}
    if (debouncedSearch) opts.search = debouncedSearch
    if (linkedFilter === 'linked') opts.linked = 'owner' // simplified
    else if (linkedFilter === 'none') opts.linked = 'none'
    fetchContacts(opts)
  }, [selectedInstance, debouncedSearch, linkedFilter, fetchContacts])

  const handleSync = useCallback(async () => {
    toast.promise(syncContacts(), {
      loading: 'A sincronizar contactos...',
      success: 'Contactos sincronizados',
      error: 'Erro ao sincronizar contactos',
    })
  }, [syncContacts])

  const handleAutoMatch = useCallback(async () => {
    if (!selectedInstance) return
    setAutoMatchLoading(true)
    try {
      const res = await fetch('/api/whatsapp/contacts/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: selectedInstance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.matched} de ${data.total} contactos vinculados`)
      fetchContacts()
    } catch {
      toast.error('Erro ao auto-vincular contactos')
    } finally {
      setAutoMatchLoading(false)
    }
  }, [selectedInstance, fetchContacts])

  const openLinkDialog = useCallback((contact: WppContact) => {
    setSelectedContact(contact)
    setLinkDialogOpen(true)
  }, [])

  const handleViewChat = useCallback(
    (contact: WppContact) => {
      router.push(`/dashboard/whatsapp?chat=${contact.wa_contact_id}`)
    },
    [router]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Contactos WhatsApp</h1>
            {total > 0 && (
              <span className="text-sm text-muted-foreground">({total})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isLoading || !selectedInstance}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Sincronizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMatch}
              disabled={autoMatchLoading || !selectedInstance}
            >
              <Wand2 className="h-4 w-4 mr-1.5" />
              Auto-vincular
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Instance selector */}
          <div className="w-[240px]">
            <InstanceSelector
              instances={instances}
              value={selectedInstance}
              onChange={setSelectedInstance}
            />
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter tabs */}
          <Tabs value={linkedFilter} onValueChange={setLinkedFilter}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="linked">Com vinculacao</TabsTrigger>
              <TabsTrigger value="none">Sem vinculacao</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {!selectedInstance
                ? 'Seleccione uma instancia'
                : debouncedSearch
                  ? 'Nenhum contacto encontrado para esta pesquisa'
                  : 'Nenhum contacto. Clique em "Sincronizar" para importar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onLink={() => openLinkDialog(contact)}
                onViewChat={() => handleViewChat(contact)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Link dialog */}
      {selectedContact && (
        <ContactLinkDialog
          contactId={selectedContact.id}
          instanceId={selectedInstance}
          currentOwnerId={selectedContact.owner_id}
          currentLeadId={selectedContact.lead_id}
          onLinked={() => fetchContacts()}
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
        />
      )}
    </div>
  )
}
