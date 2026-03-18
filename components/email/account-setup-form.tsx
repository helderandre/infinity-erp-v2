'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  Trash2,
  Settings2,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEmailAccount } from '@/hooks/use-email-account'
import type { ConsultantEmailAccount } from '@/types/email'

const formSchema = z.object({
  email_address: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  display_name: z.string().min(1, 'Nome de exibição é obrigatório'),
  smtp_host: z.string().min(1),
  smtp_port: z.number().min(1).max(65535),
  imap_host: z.string().min(1),
  imap_port: z.number().min(1).max(65535),
})

type FormData = z.infer<typeof formSchema>

export function AccountSetupForm() {
  const { account, isLoading, setupAccount, removeAccount, refetch } = useEmailAccount()
  const [isVerifying, setIsVerifying] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email_address: '',
      password: '',
      display_name: '',
      smtp_host: 'mail.sooma.com',
      smtp_port: 465,
      imap_host: 'mail.sooma.com',
      imap_port: 993,
    },
  })

  async function onSubmit(data: FormData) {
    setIsVerifying(true)
    setVerifyError(null)
    try {
      await setupAccount(data)
      toast.success('Conta de email verificada e configurada com sucesso!')
      form.reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao verificar conta'
      setVerifyError(msg)
      toast.error(msg)
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleDelete() {
    if (!account) return
    setIsDeleting(true)
    try {
      await removeAccount(account.id)
      toast.success('Conta de email removida.')
      setDeleteOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Account configured ────────────────────────────────────────────
  if (account) {
    return (
      <>
        <AccountCard account={account} onDelete={() => setDeleteOpen(true)} onReconfigure={() => {
          form.setValue('email_address', account.email_address)
          form.setValue('display_name', account.display_name)
          form.setValue('smtp_host', account.smtp_host)
          form.setValue('smtp_port', account.smtp_port)
          form.setValue('imap_host', account.imap_host)
          form.setValue('imap_port', account.imap_port)
          removeAccount(account.id).then(() => refetch())
        }} />
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar conta de email</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza de que pretende eliminar a configuração de email?
                Todas as mensagens sincronizadas serão perdidas. Esta acção é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // ─── Setup form ────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Configurar Email Profissional
        </CardTitle>
        <CardDescription>
          Configure a sua conta de email RE/MAX para enviar e receber emails directamente no ERP.
          O sistema verificará as credenciais SMTP e IMAP antes de guardar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {verifyError && (
          <Alert variant="destructive" className="mb-4">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>{verifyError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormDescription>Nome que aparece como remetente dos emails.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email RE/MAX</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="nome@remax.pt" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>A senha é encriptada antes de ser guardada.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  <Settings2 className="h-4 w-4" />
                  Configuração avançada do servidor
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtp_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Servidor SMTP</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtp_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porta SMTP</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imap_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Servidor IMAP</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imap_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porta IMAP</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" disabled={isVerifying} className="w-full">
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A verificar ligação...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Verificar e Guardar
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ─── Sub-component: configured account card ──────────────────────────────────

function AccountCard({
  account,
  onDelete,
  onReconfigure,
}: {
  account: ConsultantEmailAccount
  onDelete: () => void
  onReconfigure: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Profissional
          </CardTitle>
          <Badge variant={account.is_verified ? 'default' : 'destructive'} className="gap-1">
            {account.is_verified ? (
              <><ShieldCheck className="h-3 w-3" /> Verificado</>
            ) : (
              <><ShieldX className="h-3 w-3" /> Não verificado</>
            )}
          </Badge>
        </div>
        <CardDescription>
          A sua conta de email está configurada e pronta a usar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{account.email_address}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nome de exibição</span>
            <span className="text-sm font-medium">{account.display_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Servidor SMTP</span>
            <span className="text-sm font-mono">{account.smtp_host}:{account.smtp_port}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Servidor IMAP</span>
            <span className="text-sm font-mono">{account.imap_host}:{account.imap_port}</span>
          </div>
          {account.last_sync_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Última sincronização</span>
              <span className="text-sm">
                {new Date(account.last_sync_at).toLocaleString('pt-PT')}
              </span>
            </div>
          )}
          {account.last_error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription className="text-xs">{account.last_error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReconfigure} className="flex-1">
            <Settings2 className="mr-2 h-4 w-4" />
            Reconfigurar
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
