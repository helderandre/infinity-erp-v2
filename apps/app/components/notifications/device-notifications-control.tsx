'use client'

import { Bell, BellOff, BellRing, Loader2, Share, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { usePushSubscription } from '@/hooks/use-push-subscription'

interface DeviceNotificationsControlProps {
  variant?: 'card' | 'compact'
  className?: string
}

export function DeviceNotificationsControl({
  variant = 'card',
  className,
}: DeviceNotificationsControlProps) {
  const { permission, isSubscribed, isLoading, iosNeedsInstall, subscribe, unsubscribe } =
    usePushSubscription()

  // On iPhone/iPad outside the installed PWA, "unsupported" is misleading — the
  // real path is to add the app to the Home Screen. Render dedicated guidance.
  const unsupported = permission === 'unsupported' && !iosNeedsInstall
  const denied = permission === 'denied'

  const handleToggle = async (next: boolean) => {
    if (unsupported) {
      toast.error('Este dispositivo não suporta notificações push.')
      return
    }
    if (denied) {
      toast.error('As notificações estão bloqueadas nas definições do navegador. Desbloqueie-as e tente de novo.')
      return
    }

    if (next) {
      const ok = await subscribe()
      if (ok) toast.success('Notificações activadas neste dispositivo.')
      else toast.error('Não foi possível activar as notificações.')
    } else {
      await unsubscribe()
      toast.success('Notificações desactivadas neste dispositivo.')
    }
  }

  const statusLabel = unsupported
    ? 'Não suportado neste dispositivo'
    : denied
    ? 'Bloqueado nas definições do navegador'
    : isSubscribed
    ? 'Activas neste dispositivo'
    : 'Desactivadas'

  const Icon = isSubscribed ? BellRing : unsupported || denied ? BellOff : Bell

  // iOS-not-installed: same guidance in both variants. Web Push on iPhone/iPad
  // only works from the app installed on the Home Screen.
  if (iosNeedsInstall) {
    const steps = (
      <span className="inline-flex flex-wrap items-center gap-1">
        Toca em
        <Share className="inline h-3.5 w-3.5" aria-label="Partilhar" />
        <span className="font-medium">Partilhar</span>
        e depois
        <Plus className="inline h-3.5 w-3.5" aria-label="Adicionar" />
        <span className="font-medium">Adicionar ao ecrã principal</span>.
        Abre a app pelo ícone e activa aqui as notificações.
      </span>
    )

    if (variant === 'compact') {
      return (
        <div
          className={cn(
            'rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
            className,
          )}
        >
          <p className="font-medium text-foreground mb-0.5">Instala a app para receber notificações</p>
          {steps}
        </div>
      )
    }

    return (
      <Card className={className}>
        <CardContent className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BellOff className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Instala a app para receber notificações</p>
            <p className="text-xs text-muted-foreground mt-0.5">{steps}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        variant={isSubscribed ? 'default' : 'outline'}
        size="sm"
        disabled={isLoading || unsupported || denied}
        onClick={() => handleToggle(!isSubscribed)}
        title={statusLabel}
        className={cn('gap-1.5 text-xs', className)}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {isSubscribed ? 'Notificações activas' : 'Activar notificações'}
      </Button>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            isSubscribed
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Notificações no dispositivo</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unsupported
              ? 'Este navegador ou dispositivo não suporta notificações push.'
              : denied
              ? 'Permissão bloqueada. Desbloqueie nas definições do navegador para activar.'
              : isSubscribed
              ? 'Recebe alertas de tarefas, processos e mensagens neste dispositivo.'
              : 'Active para receber alertas mesmo com o separador fechado.'}
          </p>
        </div>
        <Switch
          checked={isSubscribed}
          disabled={isLoading || unsupported || denied}
          onCheckedChange={handleToggle}
          aria-label={statusLabel}
        />
      </CardContent>
    </Card>
  )
}
