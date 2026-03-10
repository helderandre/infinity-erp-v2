'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  consultantUserSchema,
  consultantProfileSchema,
  consultantPrivateDataSchema,
} from '@/lib/validations/consultant'

const SPECIALIZATIONS = [
  'Residencial',
  'Comercial',
  'Luxo',
  'Arrendamento',
  'Investimento',
  'Terrenos',
  'Reabilitação',
  'Internacional',
]

const LANGUAGES = ['Português', 'Inglês', 'Francês', 'Espanhol', 'Alemão', 'Italiano', 'Mandarim']

const formSchema = z.object({
  user: consultantUserSchema,
  profile: consultantProfileSchema,
  private_data: consultantPrivateDataSchema,
  role_id: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ConsultantFormProps {
  defaultValues?: Partial<FormData>
  roles?: { id: string; name: string }[]
  onSubmit: (data: FormData) => Promise<void>
  isEdit?: boolean
}

export function ConsultantForm({
  defaultValues,
  roles = [],
  onSubmit,
  isEdit = false,
}: ConsultantFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openSections, setOpenSections] = useState({
    profile: true,
    private: isEdit,
  })

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      user: {
        commercial_name: '',
        professional_email: '',
        is_active: true,
        display_website: false,
        ...defaultValues?.user,
      },
      profile: {
        bio: '',
        phone_commercial: '',
        specializations: [],
        languages: [],
        instagram_handle: '',
        linkedin_url: '',
        ...defaultValues?.profile,
      },
      private_data: {
        full_name: '',
        nif: '',
        iban: '',
        address_private: '',
        monthly_salary: null,
        commission_rate: null,
        hiring_date: '',
        ...defaultValues?.private_data,
      },
      role_id: defaultValues?.role_id || '',
    },
  })

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSpecialization = (spec: string) => {
    const current = form.getValues('profile.specializations') || []
    const updated = current.includes(spec)
      ? current.filter((s) => s !== spec)
      : [...current, spec]
    form.setValue('profile.specializations', updated, { shouldDirty: true })
  }

  const toggleLanguage = (lang: string) => {
    const current = form.getValues('profile.languages') || []
    const updated = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang]
    form.setValue('profile.languages', updated, { shouldDirty: true })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Dados Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="user.commercial_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Comercial *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do consultor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="user.professional_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Profissional</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@empresa.pt"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="profile.phone_commercial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telemóvel Comercial</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+351 9XX XXX XXX"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar função" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-6">
              <FormField
                control={form.control}
                name="user.is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Activo</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="user.display_website"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Mostrar no Website</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Perfil Público */}
        <Collapsible
          open={openSections.profile}
          onOpenChange={(open) => setOpenSections((s) => ({ ...s, profile: open }))}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Perfil Público</CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      openSections.profile ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="profile.bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Biografia</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Breve descrição do consultor..."
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel className="text-sm">Especializações</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {SPECIALIZATIONS.map((spec) => {
                      const selected = form.watch('profile.specializations')?.includes(spec)
                      return (
                        <Button
                          key={spec}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSpecialization(spec)}
                        >
                          {spec}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <FormLabel className="text-sm">Idiomas</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {LANGUAGES.map((lang) => {
                      const selected = form.watch('profile.languages')?.includes(lang)
                      return (
                        <Button
                          key={lang}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleLanguage(lang)}
                        >
                          {lang}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="profile.instagram_handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="@nome_utilizador"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="profile.linkedin_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://linkedin.com/in/..."
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Dados Privados */}
        <Collapsible
          open={openSections.private}
          onOpenChange={(open) => setOpenSections((s) => ({ ...s, private: open }))}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Dados Privados</CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      openSections.private ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="private_data.full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nome completo legal"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="private_data.nif"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIF</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123456789"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="private_data.iban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IBAN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="PT50 0000 0000 0000 0000 0000 0"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="private_data.address_private"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Morada Pessoal</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Morada completa"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="private_data.monthly_salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salário Mensal</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormDescription>EUR/mês</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="private_data.commission_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taxa de Comissão</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormDescription>%</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="private_data.hiring_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Contratação</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar Alterações' : 'Criar Consultor'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
