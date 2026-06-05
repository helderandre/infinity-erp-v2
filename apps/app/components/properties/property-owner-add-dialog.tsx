'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { OwnerSearch } from '@/components/owners/owner-search'
import { OwnerForm } from '@/components/owners/owner-form'
import type { OwnerRow } from '@/types/owner'

type Step = 'choose' | 'create'

export function PropertyOwnerAddDialog({
  propertyId,
  trigger,
  hasExistingOwners,
  onAdded,
}: {
  propertyId: string
  trigger?: React.ReactNode
  hasExistingOwners: boolean
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('choose')
  const [ownershipPercentage, setOwnershipPercentage] = useState(100)
  const [isMainContact, setIsMainContact] = useState(!hasExistingOwners)
  const [linking, setLinking] = useState(false)

  const reset = () => {
    setStep('choose')
    setOwnershipPercentage(100)
    setIsMainContact(!hasExistingOwners)
  }

  const link = async (ownerId: string) => {
    setLinking(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          ownership_percentage: ownershipPercentage,
          is_main_contact: isMainContact,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || 'Erro ao associar proprietário')
      }
      toast.success('Proprietário adicionado')
      onAdded()
      setOpen(false)
      reset()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      {trigger ?? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" /> Adicionar proprietário
        </Button>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'choose'
              ? 'Adicionar proprietário'
              : 'Criar novo proprietário'}
          </DialogTitle>
          <DialogDescription>
            {step === 'choose'
              ? 'Procure um proprietário existente ou crie um novo.'
              : 'Preencha os dados do novo proprietário.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm">Procurar proprietário existente</Label>
              <OwnerSearch
                onSelect={(o) => link(o.id)}
                placeholder="Nome, NIF ou email..."
              />
              <p className="text-xs text-muted-foreground">
                Selecciona um resultado para associar ao imóvel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Percentagem (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={ownershipPercentage}
                  onChange={(e) =>
                    setOwnershipPercentage(
                      Math.max(0, Math.min(100, Number(e.target.value) || 0))
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <Label className="text-xs">Contacto principal</Label>
                <Switch
                  checked={isMainContact}
                  onCheckedChange={setIsMainContact}
                />
              </div>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep('create')}
              disabled={linking}
            >
              {linking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Criar novo proprietário
            </Button>
          </div>
        ) : (
          <div>
            <OwnerForm
              owner={null}
              onSuccess={(owner: OwnerRow) => link(owner.id)}
              onCancel={() => setStep('choose')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
