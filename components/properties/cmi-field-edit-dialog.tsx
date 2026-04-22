'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { PropertyDetail } from '@/types/property'
import type { Database } from '@/types/database'

type OwnerRow = Database['public']['Tables']['owners']['Row']

const MARITAL_STATUSES = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_facto', label: 'União de facto' },
]

const MARITAL_REGIMES = [
  { value: 'comunhao_adquiridos', label: 'Comunhão de adquiridos' },
  { value: 'comunhao_geral', label: 'Comunhão geral de bens' },
  { value: 'separacao_bens', label: 'Separação de bens' },
  { value: 'outro', label: 'Outro' },
]

export type CmiFieldEditTarget =
  | { kind: 'owner'; ownerId: string; fieldKey: string; owner: OwnerRow }
  | { kind: 'property'; propertyId: string; fieldKey: string; property: PropertyDetail }

interface Props {
  target: CmiFieldEditTarget | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export function CmiFieldEditDialog({ target, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, any>>({})

  // Reset form state whenever target changes.
  useEffect(() => {
    if (!target) {
      setValues({})
      return
    }
    if (target.kind === 'owner') {
      setValues({
        naturality: target.owner.naturality || '',
        address: target.owner.address || '',
        marital_status: target.owner.marital_status || '',
        marital_regime: (target.owner as any).marital_regime || '',
      })
    } else {
      const internal = target.property.dev_property_internal as any
      setValues({
        has_mortgage: internal?.has_mortgage ?? undefined,
        mortgage_owed: internal?.mortgage_owed ?? '',
      })
    }
  }, [target])

  const title = getTitle(target)

  async function handleSave() {
    if (!target) return
    setSaving(true)
    try {
      if (target.kind === 'owner') {
        const payload = buildOwnerPayload(target.fieldKey, values)
        const res = await fetch(`/api/owners/${target.ownerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Falha ao actualizar proprietário')
      } else {
        const payload = buildPropertyInternalPayload(target.fieldKey, values)
        const res = await fetch(`/api/properties/${target.propertyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ internal: payload }),
        })
        if (!res.ok) throw new Error('Falha ao actualizar imóvel')
      }
      toast.success('Guardado')
      await onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title.title}</DialogTitle>
          {title.description && (
            <DialogDescription>{title.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {target?.kind === 'owner' && renderOwnerField(target.fieldKey, values, setValues)}
          {target?.kind === 'property' && renderPropertyField(target.fieldKey, values, setValues)}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-full gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getTitle(target: CmiFieldEditTarget | null): {
  title: string
  description?: string
} {
  if (!target) return { title: '' }
  if (target.kind === 'owner') {
    const name = target.owner.name
    const keyLabels: Record<string, string> = {
      naturality: 'Naturalidade',
      address: 'Morada atual',
      'marital-status': 'Estado civil',
      'marital-regime': 'Regime de casamento',
    }
    const label = keyLabels[target.fieldKey] || 'Editar campo'
    return { title: label, description: `Proprietário: ${name}` }
  }
  return {
    title: 'Hipoteca',
    description: 'Indicar se existe hipoteca e, em caso afirmativo, valor em dívida.',
  }
}

function renderOwnerField(
  fieldKey: string,
  values: Record<string, any>,
  setValues: (v: Record<string, any>) => void
) {
  const update = (patch: Record<string, any>) => setValues({ ...values, ...patch })

  if (fieldKey === 'naturality') {
    return (
      <div className="space-y-2">
        <Label>Naturalidade (freguesia e concelho)</Label>
        <Input
          value={values.naturality || ''}
          placeholder="Ex.: Lumiar, Lisboa"
          onChange={(e) => update({ naturality: e.target.value })}
        />
      </div>
    )
  }
  if (fieldKey === 'address') {
    return (
      <div className="space-y-2">
        <Label>Morada atual</Label>
        <Input
          value={values.address || ''}
          placeholder="Rua, número, andar, código postal, localidade"
          onChange={(e) => update({ address: e.target.value })}
        />
      </div>
    )
  }
  if (fieldKey === 'marital-status') {
    return (
      <>
        <div className="space-y-2">
          <Label>Estado civil</Label>
          <Select
            value={values.marital_status || ''}
            onValueChange={(v) => update({ marital_status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(values.marital_status === 'casado') && (
          <div className="space-y-2">
            <Label>Regime de casamento</Label>
            <Select
              value={values.marital_regime || ''}
              onValueChange={(v) => update({ marital_regime: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_REGIMES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </>
    )
  }
  if (fieldKey === 'marital-regime') {
    return (
      <div className="space-y-2">
        <Label>Regime de casamento</Label>
        <Select
          value={values.marital_regime || ''}
          onValueChange={(v) => update({ marital_regime: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {MARITAL_REGIMES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  return null
}

function renderPropertyField(
  fieldKey: string,
  values: Record<string, any>,
  setValues: (v: Record<string, any>) => void
) {
  const update = (patch: Record<string, any>) => setValues({ ...values, ...patch })
  if (fieldKey === 'hipoteca') {
    return (
      <>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={!!values.has_mortgage}
            onCheckedChange={(v) => update({ has_mortgage: v === true })}
          />
          <Label className="cursor-pointer" onClick={() => update({ has_mortgage: !values.has_mortgage })}>
            Existe hipoteca sobre o imóvel
          </Label>
        </div>
        {values.has_mortgage && (
          <div className="space-y-2">
            <Label>Valor aproximado em dívida (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={values.mortgage_owed ?? ''}
              onChange={(e) => update({ mortgage_owed: e.target.value })}
              placeholder="0,00"
            />
          </div>
        )}
        {values.has_mortgage === false && (
          <p className="text-[11px] text-muted-foreground">
            Marcado como sem hipoteca. Desmarque para voltar ao estado anterior.
          </p>
        )}
      </>
    )
  }
  return null
}

function buildOwnerPayload(
  fieldKey: string,
  values: Record<string, any>
): Record<string, unknown> {
  if (fieldKey === 'naturality') return { naturality: values.naturality || null }
  if (fieldKey === 'address') return { address: values.address || null }
  if (fieldKey === 'marital-status') {
    const out: Record<string, unknown> = { marital_status: values.marital_status || null }
    if (values.marital_status === 'casado' && values.marital_regime) {
      out.marital_regime = values.marital_regime
    }
    return out
  }
  if (fieldKey === 'marital-regime') {
    return { marital_regime: values.marital_regime || null }
  }
  return {}
}

function buildPropertyInternalPayload(
  fieldKey: string,
  values: Record<string, any>
): Record<string, unknown> {
  if (fieldKey === 'hipoteca') {
    const out: Record<string, unknown> = { has_mortgage: values.has_mortgage ?? null }
    if (values.has_mortgage === true) {
      out.mortgage_owed = values.mortgage_owed ? Number(values.mortgage_owed) : null
    } else {
      out.mortgage_owed = null
    }
    return out
  }
  return {}
}
