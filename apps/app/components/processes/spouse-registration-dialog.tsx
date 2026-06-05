'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, Search, UserPlus, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import type { OwnerRoleType } from '@/types/owner'

interface SpouseRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ownerName: string
  propertyId: string
  roleTypes: OwnerRoleType[]
  onRegistered?: () => void
}

export function SpouseRegistrationDialog({
  open,
  onOpenChange,
  ownerName,
  propertyId,
  roleTypes,
  onRegistered,
}: SpouseRegistrationDialogProps) {
  const [tab, setTab] = useState<string>('search')
  const [saving, setSaving] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState<any>(null)
  const debouncedSearch = useDebounce(searchQuery, 300)

  // New owner state
  const [newOwner, setNewOwner] = useState({
    name: '',
    nif: '',
    email: '',
    phone: '',
    birth_date: '',
    nationality: '',
    id_doc_type: '',
    id_doc_number: '',
  })

  // Percentage for spouse
  const [spousePercentage, setSpousePercentage] = useState(50)

  const conjugeRoleId = roleTypes.find((r) => r.name === 'conjuge')?.id

  // Search existing owners
  const handleSearch = useCallback(async () => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(
        `/api/owners?search=${encodeURIComponent(debouncedSearch)}&limit=5`
      )
      const data = await res.json()
      setSearchResults(data.data || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [debouncedSearch])

  // Trigger search on debounce
  useState(() => {
    handleSearch()
  })

  // Actually use useEffect for debounced search
  const searchEffect = useCallback(() => {
    handleSearch()
  }, [handleSearch])

  // We need a proper effect — let's handle it in the search input onChange
  const onSearchInput = async (value: string) => {
    setSearchQuery(value)
    setSelectedOwner(null)

    if (value.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(
        `/api/owners?search=${encodeURIComponent(value)}&limit=5`
      )
      const data = await res.json()
      setSearchResults(data.data || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleRegister = async () => {
    if (!conjugeRoleId) {
      toast.error('Role de cônjuge não encontrado')
      return
    }

    setSaving(true)
    try {
      let body: any

      if (tab === 'search' && selectedOwner) {
        // Link existing owner
        body = {
          owner_id: selectedOwner.id,
          ownership_percentage: spousePercentage,
          is_main_contact: false,
          owner_role_id: conjugeRoleId,
        }
      } else if (tab === 'new') {
        // Create new owner inline
        if (!newOwner.name) {
          toast.error('O nome do cônjuge é obrigatório')
          setSaving(false)
          return
        }

        body = {
          owner: {
            person_type: 'singular',
            name: newOwner.name,
            nif: newOwner.nif || undefined,
            email: newOwner.email || undefined,
            phone: newOwner.phone || undefined,
            birth_date: newOwner.birth_date || undefined,
            nationality: newOwner.nationality || undefined,
            id_doc_type: newOwner.id_doc_type || undefined,
            id_doc_number: newOwner.id_doc_number || undefined,
          },
          ownership_percentage: spousePercentage,
          is_main_contact: false,
          owner_role_id: conjugeRoleId,
        }
      } else {
        toast.error('Seleccione um proprietário existente ou crie um novo')
        setSaving(false)
        return
      }

      const res = await fetch(`/api/properties/${propertyId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409 && err.existing_id) {
          toast.error('Já existe um proprietário com este NIF')
        } else {
          throw new Error(err.error || 'Erro ao registar cônjuge')
        }
        setSaving(false)
        return
      }

      toast.success('Cônjuge registado com sucesso')
      onRegistered?.()
      onOpenChange(false)

      // Reset
      setSearchQuery('')
      setSearchResults([])
      setSelectedOwner(null)
      setNewOwner({ name: '', nif: '', email: '', phone: '', birth_date: '', nationality: '', id_doc_type: '', id_doc_number: '' })
      setSpousePercentage(50)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao registar cônjuge'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Registar Cônjuge
          </DialogTitle>
          <DialogDescription>
            O proprietário <strong>{ownerName}</strong> é casado/em união de facto.
            Deseja registar o cônjuge como co-proprietário?
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Pesquisar Existente
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Criar Novo
            </TabsTrigger>
          </TabsList>

          {/* Search existing */}
          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label>Pesquisar por nome, NIF ou email</Label>
              <Input
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => onSearchInput(e.target.value)}
              />
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A pesquisar...
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent ${
                      selectedOwner?.id === o.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedOwner(o)}
                  >
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.nif && `NIF: ${o.nif}`}
                      {o.nif && o.email && ' · '}
                      {o.email}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
            )}
          </TabsContent>

          {/* Create new */}
          <TabsContent value="new" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="spouse-name">Nome Completo *</Label>
                <Input
                  id="spouse-name"
                  value={newOwner.name}
                  onChange={(e) => setNewOwner((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spouse-nif">NIF</Label>
                <Input
                  id="spouse-nif"
                  value={newOwner.nif}
                  onChange={(e) => setNewOwner((p) => ({ ...p, nif: e.target.value }))}
                  maxLength={9}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spouse-email">Email</Label>
                <Input
                  id="spouse-email"
                  type="email"
                  value={newOwner.email}
                  onChange={(e) => setNewOwner((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spouse-phone">Telefone</Label>
                <Input
                  id="spouse-phone"
                  value={newOwner.phone}
                  onChange={(e) => setNewOwner((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Nascimento</Label>
                <DatePicker
                  value={newOwner.birth_date}
                  onChange={(v) => setNewOwner((p) => ({ ...p, birth_date: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Documento</Label>
                <Select
                  value={newOwner.id_doc_type}
                  onValueChange={(v) => setNewOwner((p) => ({ ...p, id_doc_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cc">Cartão de Cidadão</SelectItem>
                    <SelectItem value="passport">Passaporte</SelectItem>
                    <SelectItem value="bi">Bilhete de Identidade</SelectItem>
                    <SelectItem value="ar">Autorização de Residência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spouse-doc-number">Número do Documento</Label>
                <Input
                  id="spouse-doc-number"
                  value={newOwner.id_doc_number}
                  onChange={(e) => setNewOwner((p) => ({ ...p, id_doc_number: e.target.value }))}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Ownership percentage */}
        <div className="space-y-2">
          <Label htmlFor="spouse-percentage">Percentagem de Propriedade do Cônjuge (%)</Label>
          <Input
            id="spouse-percentage"
            type="number"
            min={0}
            max={100}
            value={spousePercentage}
            onChange={(e) => setSpousePercentage(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Sugestão: 50% (divisão igual). Ajuste conforme necessário.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRegister}
            disabled={saving || (tab === 'search' && !selectedOwner) || (tab === 'new' && !newOwner.name)}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registar Cônjuge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
