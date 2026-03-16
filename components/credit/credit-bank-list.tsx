'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Building2,
  Mail,
  Pencil,
  Phone,
  Percent,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'
import type { CreditBank } from '@/types/credit'

interface CreditBankListProps {
  banks: CreditBank[]
  onEdit: (bank: CreditBank) => void
  onDelete: (bankId: string) => void
}

export function CreditBankList({ banks, onEdit, onDelete }: CreditBankListProps) {
  const [deleteTarget, setDeleteTarget] = useState<CreditBank | null>(null)

  function handleConfirmDelete() {
    if (deleteTarget) {
      onDelete(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum banco configurado
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Adicione bancos para gerir propostas de crédito.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banks.map((bank) => (
          <Card
            key={bank.id}
            className="transition-all hover:shadow-md hover:scale-[1.01]"
          >
            <CardContent className="p-4 space-y-3">
              {/* Header: name + protocol badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">{bank.nome}</h3>
                  {bank.nome_completo && (
                    <p className="text-xs text-muted-foreground truncate">
                      {bank.nome_completo}
                    </p>
                  )}
                </div>
                <Badge
                  variant={bank.tem_protocolo ? 'default' : 'secondary'}
                  className="shrink-0 text-[10px]"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {bank.tem_protocolo ? 'Protocolo' : 'Sem protocolo'}
                </Badge>
              </div>

              {/* Spread protocolo */}
              {bank.tem_protocolo && bank.spread_protocolo != null && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <Percent className="h-3 w-3" />
                  <span>
                    Spread protocolo: <strong>{bank.spread_protocolo.toFixed(2)}%</strong>
                  </span>
                </div>
              )}

              {/* Commission */}
              {bank.comissao_percentagem != null && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  <span>
                    Comissão: {bank.comissao_percentagem.toFixed(2)}%
                    {bank.comissao_minima != null && bank.comissao_maxima != null && (
                      <span className="ml-1">
                        ({bank.comissao_minima.toFixed(0)} - {bank.comissao_maxima.toFixed(0)} EUR)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Manager info */}
              {(bank.gestor_nome || bank.gestor_email || bank.gestor_telefone) && (
                <div className="space-y-1 rounded-md bg-muted/50 p-2">
                  {bank.gestor_nome && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{bank.gestor_nome}</span>
                    </div>
                  )}
                  {bank.gestor_email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{bank.gestor_email}</span>
                    </div>
                  )}
                  {bank.gestor_telefone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{bank.gestor_telefone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(bank)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Editar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(bank)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar banco</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o banco{' '}
              <strong>{deleteTarget?.nome}</strong>? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
