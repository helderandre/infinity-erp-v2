'use client'

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
import { Loader2 } from 'lucide-react'

interface StageCompleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageName: string
  onConfirm: () => void
  isLoading?: boolean
}

export function StageCompleteDialog({
  open,
  onOpenChange,
  stageName,
  onConfirm,
  isLoading,
}: StageCompleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Concluir Estágio</AlertDialogTitle>
          <AlertDialogDescription>
            Tem a certeza de que pretende marcar o estágio &ldquo;{stageName}&rdquo; como
            concluído? Após confirmação, o próximo estágio ficará em evidência.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A concluir...
              </>
            ) : (
              'Confirmar Conclusão'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
