'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ConvictusCompanyData, FaturacaoCompanyData,
} from '@/types/acessos'

type Props =
  | {
      open: boolean
      onOpenChange: (open: boolean) => void
      scope: 'faturacao'
      initial: FaturacaoCompanyData
      onSaved: () => void
    }
  | {
      open: boolean
      onOpenChange: (open: boolean) => void
      scope: 'convictus'
      initial: ConvictusCompanyData
      onSaved: () => void
    }

export function CompanyInfoEditDialog(props: Props) {
  const { open, onOpenChange, scope, onSaved } = props
  const [submitting, setSubmitting] = useState(false)

  // Faturação state
  const [fNome, setFNome] = useState('')
  const [fSede, setFSede] = useState('')
  const [fNipc, setFNipc] = useState('')

  // Convictus state
  const [cSedeNome, setCSedeNome] = useState('')
  const [cSedeMorada, setCSedeMorada] = useState('')
  const [cSedeTelefone, setCSedeTelefone] = useState('')
  const [cSedeAmi, setCSedeAmi] = useState('')
  const [cAgNome, setCAgNome] = useState('')
  const [cAgMorada, setCAgMorada] = useState('')
  const [cAgTelefone, setCAgTelefone] = useState('')

  useEffect(() => {
    if (!open) return
    if (scope === 'faturacao') {
      const d = (props as Extract<Props, { scope: 'faturacao' }>).initial
      setFNome(d.nome); setFSede(d.sede); setFNipc(d.nipc)
    } else {
      const d = (props as Extract<Props, { scope: 'convictus' }>).initial
      setCSedeNome(d.sede.nome); setCSedeMorada(d.sede.morada)
      setCSedeTelefone(d.sede.telefone); setCSedeAmi(d.sede.ami)
      setCAgNome(d.agencia.nome); setCAgMorada(d.agencia.morada)
      setCAgTelefone(d.agencia.telefone)
    }
  }, [open, scope, props])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = scope === 'faturacao'
      ? { nome: fNome, sede: fSede, nipc: fNipc }
      : {
          agencia: { nome: cAgNome, morada: cAgMorada, telefone: cAgTelefone },
          sede: { nome: cSedeNome, morada: cSedeMorada, telefone: cSedeTelefone, ami: cSedeAmi },
        }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/acessos/company-info/${scope}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao guardar')
      }
      toast.success('Dados actualizados')
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {scope === 'faturacao' ? 'Editar dados de Faturação' : 'Editar dados Convictus'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {scope === 'faturacao' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="f-nome">Nome da Empresa</Label>
                <Input id="f-nome" value={fNome} onChange={(e) => setFNome(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-sede">Sede</Label>
                <Input id="f-sede" value={fSede} onChange={(e) => setFSede(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-nipc">NIPC</Label>
                <Input id="f-nipc" value={fNipc} onChange={(e) => setFNipc(e.target.value)} required />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Sede</p>
                <div className="space-y-1.5">
                  <Label htmlFor="c-sede-nome">Nome</Label>
                  <Input id="c-sede-nome" value={cSedeNome} onChange={(e) => setCSedeNome(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-sede-morada">Morada</Label>
                  <Input id="c-sede-morada" value={cSedeMorada} onChange={(e) => setCSedeMorada(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-sede-tel">Telefone</Label>
                    <Input id="c-sede-tel" value={cSedeTelefone} onChange={(e) => setCSedeTelefone(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-sede-ami">AMI</Label>
                    <Input id="c-sede-ami" value={cSedeAmi} onChange={(e) => setCSedeAmi(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-border/30 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">A Nossa Agência</p>
                <div className="space-y-1.5">
                  <Label htmlFor="c-ag-nome">Nome</Label>
                  <Input id="c-ag-nome" value={cAgNome} onChange={(e) => setCAgNome(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-ag-morada">Morada</Label>
                  <Input id="c-ag-morada" value={cAgMorada} onChange={(e) => setCAgMorada(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-ag-tel">Telefone</Label>
                  <Input id="c-ag-tel" value={cAgTelefone} onChange={(e) => setCAgTelefone(e.target.value)} required />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
