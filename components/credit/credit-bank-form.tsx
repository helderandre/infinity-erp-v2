'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { bankSchema } from '@/lib/validations/credit'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import type { CreditBank } from '@/types/credit'

type BankFormValues = z.infer<typeof bankSchema>

interface CreditBankFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  initialData?: CreditBank | null
  isSubmitting: boolean
}

export function CreditBankForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
}: CreditBankFormProps) {
  const isEditing = !!initialData

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema) as any,
    defaultValues: {
      nome: '',
      nome_completo: null,
      tem_protocolo: false,
      protocolo_ref: null,
      protocolo_validade: null,
      spread_protocolo: null,
      gestor_nome: null,
      gestor_email: null,
      gestor_telefone: null,
      agencia: null,
      comissao_percentagem: null,
      comissao_minima: null,
      comissao_maxima: null,
      notas: null,
    },
  })

  const temProtocolo = form.watch('tem_protocolo')

  // Reset form when initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          nome: initialData.nome,
          nome_completo: initialData.nome_completo,
          tem_protocolo: initialData.tem_protocolo,
          protocolo_ref: initialData.protocolo_ref,
          protocolo_validade: initialData.protocolo_validade,
          spread_protocolo: initialData.spread_protocolo,
          gestor_nome: initialData.gestor_nome,
          gestor_email: initialData.gestor_email,
          gestor_telefone: initialData.gestor_telefone,
          agencia: initialData.agencia,
          comissao_percentagem: initialData.comissao_percentagem,
          comissao_minima: initialData.comissao_minima,
          comissao_maxima: initialData.comissao_maxima,
          notas: initialData.notas,
        })
      } else {
        form.reset({
          nome: '',
          nome_completo: null,
          tem_protocolo: false,
          protocolo_ref: null,
          protocolo_validade: null,
          spread_protocolo: null,
          gestor_nome: null,
          gestor_email: null,
          gestor_telefone: null,
          agencia: null,
          comissao_percentagem: null,
          comissao_minima: null,
          comissao_maxima: null,
          notas: null,
        })
      }
    }
  }, [open, initialData, form])

  async function handleFormSubmit(values: BankFormValues) {
    await onSubmit(values as Record<string, unknown>)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Banco' : 'Novo Banco'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit as any)} className="space-y-5">
            {/* Identification */}
            <div className="space-y-3">
              <FormField
                control={form.control as any}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: CGD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="nome_completo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Caixa Geral de Depósitos"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Protocol */}
            <div className="space-y-3">
              <FormField
                control={form.control as any}
                name="tem_protocolo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Protocolo activo
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Banco tem protocolo com condições especiais
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {temProtocolo && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control as any}
                    name="protocolo_ref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ref. protocolo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="REF-2024-001"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="protocolo_validade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validade</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="spread_protocolo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Spread protocolo (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            placeholder="0.80"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Manager */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Gestor de conta</p>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control as any}
                  name="gestor_nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome do gestor"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="gestor_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="gestor@banco.pt"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="gestor_telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+351 912 345 678"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="agencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Agência central"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Commission */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Comissão</p>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control as any}
                  name="comissao_percentagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentagem (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          placeholder="0.50"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="comissao_minima"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mínima (EUR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="500"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="comissao_maxima"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máxima (EUR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="5000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <FormField
              control={form.control as any}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Observações adicionais sobre este banco..."
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
