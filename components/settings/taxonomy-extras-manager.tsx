'use client'

/**
 * Admin manager for taxonomy_extras — the user-contributed extension to the
 * hardcoded enum fields. Lives in /dashboard/definicoes → "Taxonomias".
 *
 * Currently surfaces the `property_type` scope. As more `<SelectWithOther>`
 * call sites land, add scopes to TAXONOMY_SCOPES in lib/taxonomy/scopes.ts and
 * append them to the `SCOPES_UI` array below.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Power, RotateCcw, Loader2, Tags } from 'lucide-react'
import { toast } from 'sonner'

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { invalidateTaxonomyExtras, type TaxonomyExtra } from '@/hooks/use-taxonomy-extras'

const SCOPES_UI: Array<{ scope: string; label: string; description: string }> = [
  {
    scope: 'property_type',
    label: 'Tipos de Imóvel',
    description: 'Opções extra para o campo "Tipo de Imóvel" — partilhadas entre o formulário de Imóveis (Novo / Edit / Angariação) e os formulários de CRM (Novo Contacto, Nova Oportunidade, qualificação de lead).',
  },
  {
    scope: 'typology',
    label: 'Tipologias',
    description: 'Opções extra para o campo "Tipologia" — partilhadas entre todos os formulários (Imóveis, Angariação, Negócios, Marketing, Deals). A lista canónica é T0..T6; tudo o que sai daí (ex.: T6+, Loft) vem desta tabela.',
  },
]

export function TaxonomyExtrasManager() {
  const [activeScope, setActiveScope] = useState<string>(SCOPES_UI[0].scope)
  const [rows, setRows] = useState<TaxonomyExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TaxonomyExtra | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/taxonomy/${activeScope}?include_inactive=1`)
      const json = await res.json()
      if (res.ok) setRows(json.data ?? [])
      else toast.error(json.error || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [activeScope])

  useEffect(() => { fetchRows() }, [fetchRows])

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows])

  const openEdit = (row: TaxonomyExtra) => {
    setEditing(row)
    setEditLabel(row.label)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const next = editLabel.trim()
    if (!next || next === editing.label) {
      setEditing(null)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/taxonomy/${activeScope}/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Erro ao guardar')
        return
      }
      invalidateTaxonomyExtras(activeScope)
      toast.success('Opção actualizada')
      setEditing(null)
      fetchRows()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (row: TaxonomyExtra) => {
    const res = await fetch(`/api/taxonomy/${activeScope}/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error || 'Erro')
      return
    }
    invalidateTaxonomyExtras(activeScope)
    toast.success(row.is_active ? 'Opção desactivada' : 'Opção reactivada')
    fetchRows()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Opções adicionadas por consultores via &quot;Outro…&quot; nos formulários. Os valores
            do sistema (hardcoded em código) não aparecem aqui — só podem ser alterados
            por um developer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeScope} onValueChange={setActiveScope}>
            <SelectTrigger className="w-[220px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES_UI.map((s) => (
                <SelectItem key={s.scope} value={s.scope}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {SCOPES_UI.find((s) => s.scope === activeScope)?.description}
      </p>

      <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Valor (slug)</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Acções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={`s-${i}`}>
                  <TableCell colSpan={4}><Skeleton className="h-6 rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <Tags className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-medium">Sem opções adicionadas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando alguém usar &quot;Outro…&quot; num formulário com este campo, a opção aparece aqui.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{row.value}</TableCell>
                  <TableCell>
                    {row.is_active ? (
                      <Badge variant="secondary" className="rounded-full">Activa</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full">Desactivada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggleActive(row)}
                        aria-label={row.is_active ? 'Desactivar' : 'Reactivar'}
                        title={row.is_active ? 'Desactivar (esconde do picker)' : 'Reactivar'}
                      >
                        {row.is_active
                          ? <Power className="h-4 w-4 text-destructive" />
                          : <RotateCcw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Total: <strong>{rows.length}</strong> · Activas: <strong>{activeCount}</strong>
      </p>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar opção</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome a mostrar</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              O valor interno ({editing?.value}) é imutável — registos guardados continuam a apontar para ele.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="rounded-full" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
