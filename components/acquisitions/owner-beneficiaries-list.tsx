'use client'

import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Users } from 'lucide-react'

const ID_DOC_TYPES = [
  { value: 'CC', label: 'Cartao de Cidadao' },
  { value: 'BI', label: 'Bilhete de Identidade' },
  { value: 'Passaporte', label: 'Passaporte' },
  { value: 'Titulo de Residencia', label: 'Titulo de Residencia' },
  { value: 'Outro', label: 'Outro' },
]

interface OwnerBeneficiariesListProps {
  form: UseFormReturn<any>
  ownerIndex: number
}

export function OwnerBeneficiariesList({ form, ownerIndex }: OwnerBeneficiariesListProps) {
  const beneficiaries = form.watch(`owners.${ownerIndex}.beneficiaries`) || []

  const addBeneficiary = () => {
    form.setValue(`owners.${ownerIndex}.beneficiaries`, [
      ...beneficiaries,
      {
        full_name: '',
        position: '',
        share_percentage: '',
        id_doc_type: '',
        id_doc_number: '',
        id_doc_expiry: '',
        id_doc_issued_by: '',
        nif: '',
      },
    ])
  }

  const removeBeneficiary = (index: number) => {
    const updated = beneficiaries.filter((_: any, i: number) => i !== index)
    form.setValue(`owners.${ownerIndex}.beneficiaries`, updated)
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Beneficiarios Efectivos</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addBeneficiary}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Obrigatorio para pessoas colectivas sem codigo RCBE.
      </p>

      {beneficiaries.map((ben: any, bIdx: number) => (
        <Card key={bIdx}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Beneficiario {bIdx + 1}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeBeneficiary(bIdx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome Completo *</Label>
                <Input
                  placeholder="Nome..."
                  value={ben.full_name || ''}
                  onChange={(e) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.full_name`, e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo / Funcao</Label>
                <Input
                  placeholder="Cargo..."
                  value={ben.position || ''}
                  onChange={(e) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.position`, e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Percentagem</Label>
                <Input
                  placeholder="%"
                  value={ben.share_percentage || ''}
                  onChange={(e) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.share_percentage`, e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NIF</Label>
                <Input
                  placeholder="NIF..."
                  value={ben.nif || ''}
                  onChange={(e) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.nif`, e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Documento</Label>
                <Select
                  value={ben.id_doc_type || ''}
                  onValueChange={(v) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.id_doc_type`, v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Numero do Documento</Label>
                <Input
                  placeholder="Numero..."
                  value={ben.id_doc_number || ''}
                  onChange={(e) =>
                    form.setValue(`owners.${ownerIndex}.beneficiaries.${bIdx}.id_doc_number`, e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
