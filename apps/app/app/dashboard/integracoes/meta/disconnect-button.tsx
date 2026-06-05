'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DisconnectMetaButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleDisconnect() {
    setIsPending(true)
    try {
      const res = await fetch('/api/integrations/meta/disconnect', {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        remote_error?: string | null
      }

      if (!res.ok || !body.ok) {
        toast.error(`Erro a desligar: ${body.error ?? res.statusText}`)
        return
      }

      if (body.remote_error) {
        toast.warning('Desligado localmente. O meta-api reportou erro.', {
          description: body.remote_error,
        })
      } else {
        toast.success('Integração desligada com sucesso.')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Desligar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desligar integração Meta</AlertDialogTitle>
          <AlertDialogDescription>
            Vais perder a recepção de novos leads, formulários, campanhas e
            anúncios via webhook. Os dados já recebidos mantêm-se.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDisconnect} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desligar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
