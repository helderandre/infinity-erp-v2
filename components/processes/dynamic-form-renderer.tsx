'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form, FormField, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { BadgeMultiSelect } from '@/components/ui/badge-multi-select'
import { CalendarIcon, Loader2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { resolveOptionsFromConstant } from '@/lib/form-options-resolver'
import { AddressMapFieldRenderer } from './address-map-field-renderer'
import { MediaUploadFieldRenderer } from './media-upload-field-renderer'
import { RichTextFieldRenderer } from './rich-text-field-renderer'
import type { FormSectionConfig, FormFieldConfig, FormFieldType } from '@/types/subtask'
import type { Control } from 'react-hook-form'

// ─── Field Renderer Props ────────────────────────────────

export interface FieldRendererProps {
  field: FormFieldConfig
  name: string
  control: Control<Record<string, unknown>>
}

// ─── Field Renderers ─────────────────────────────────────

function TextFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <Input
              {...formField}
              value={(formField.value as string) ?? ''}
              placeholder={field.placeholder}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function TextareaFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <Textarea
              {...formField}
              value={(formField.value as string) ?? ''}
              placeholder={field.placeholder}
              rows={3}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function NumberFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <Input
              type="number"
              {...formField}
              value={formField.value === undefined || formField.value === null ? '' : String(formField.value)}
              onChange={(e) => formField.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CurrencyFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              <Input
                type="number"
                className="pl-7"
                {...formField}
                value={formField.value === undefined || formField.value === null ? '' : String(formField.value)}
                onChange={(e) => formField.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder={field.placeholder || '0.00'}
                min={field.min}
                step="0.01"
              />
            </div>
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function PercentageFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                className="pr-8"
                {...formField}
                value={formField.value === undefined || formField.value === null ? '' : String(formField.value)}
                onChange={(e) => formField.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder={field.placeholder || '0'}
                min={field.min ?? 0}
                max={field.max ?? 100}
                step="0.1"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SelectFieldRenderer({ field, name, control }: FieldRendererProps) {
  const options = field.options?.length
    ? field.options
    : resolveOptionsFromConstant(field.options_from_constant)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <Select
            value={(formField.value as string) ?? ''}
            onValueChange={formField.onChange}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || 'Seleccionar...'} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function MultiselectFieldRenderer({ field, name, control }: FieldRendererProps) {
  const options = field.options?.length
    ? field.options
    : resolveOptionsFromConstant(field.options_from_constant)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <BadgeMultiSelect
            options={options}
            value={(formField.value as string[]) || []}
            onChange={formField.onChange}
          />
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CheckboxFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
          <FormControl>
            <Checkbox
              checked={!!formField.value}
              onCheckedChange={formField.onChange}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>{field.label}</FormLabel>
            {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function DateFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => {
        const dateValue = formField.value ? parseISO(formField.value as string) : undefined
        return (
          <FormItem className="flex flex-col">
            <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full pl-3 text-left font-normal',
                      !formField.value && 'text-muted-foreground'
                    )}
                  >
                    {dateValue
                      ? format(dateValue, 'PPP', { locale: pt })
                      : field.placeholder || 'Seleccionar data...'
                    }
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(date) => {
                    formField.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                  }}
                  locale={pt}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

function EmailFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <Input
              type="email"
              {...formField}
              value={(formField.value as string) ?? ''}
              placeholder={field.placeholder || 'email@exemplo.pt'}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function PhoneFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</FormLabel>
          <FormControl>
            <Input
              type="tel"
              {...formField}
              value={(formField.value as string) ?? ''}
              placeholder={field.placeholder || '+351 ...'}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ─── Component Map ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FIELD_COMPONENTS: Record<FormFieldType, React.ComponentType<any>> = {
  text: TextFieldRenderer,
  textarea: RichTextFieldRenderer,
  rich_text: RichTextFieldRenderer,
  number: NumberFieldRenderer,
  currency: CurrencyFieldRenderer,
  percentage: PercentageFieldRenderer,
  select: SelectFieldRenderer,
  multiselect: MultiselectFieldRenderer,
  checkbox: CheckboxFieldRenderer,
  date: DateFieldRenderer,
  email: EmailFieldRenderer,
  phone: PhoneFieldRenderer,
  address_map: AddressMapFieldRenderer,
  media_upload: MediaUploadFieldRenderer,
}

// ─── Zod Schema Builder ──────────────────────────────────

export function buildZodSchema(sections: FormSectionConfig[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const section of sections) {
    for (const field of section.fields) {
      // address_map: campo composto — cria 6 sub-campos
      if (field.field_type === 'address_map') {
        const entity = field.target_entity
        shape[`${entity}__address_street`] = z.string().optional().nullable()
        shape[`${entity}__postal_code`] = z.string().optional().nullable()
        shape[`${entity}__city`] = z.string().optional().nullable()
        shape[`${entity}__zone`] = z.string().optional().nullable()
        shape[`${entity}__latitude`] = z.coerce.number().optional().nullable()
        shape[`${entity}__longitude`] = z.coerce.number().optional().nullable()
        continue
      }

      // media_upload: armazena contagem de imagens
      if (field.field_type === 'media_upload') {
        const key = `${field.target_entity}__${field.field_name}`
        shape[key] = z.coerce.number().optional().nullable()
        continue
      }

      let fieldSchema: z.ZodTypeAny

      switch (field.field_type) {
        case 'number':
        case 'currency':
        case 'percentage': {
          let numSchema = z.coerce.number()
          if (field.min !== undefined) numSchema = numSchema.min(field.min)
          if (field.max !== undefined) numSchema = numSchema.max(field.max)
          fieldSchema = field.required ? numSchema : numSchema.optional().nullable()
          break
        }
        case 'checkbox':
          fieldSchema = z.boolean().default(false)
          break
        case 'multiselect':
          fieldSchema = z.array(z.string()).default([])
          break
        case 'date':
          fieldSchema = field.required ? z.string().min(1, `${field.label} é obrigatório`) : z.string().optional().nullable()
          break
        default:
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} é obrigatório`)
            : z.string().optional().nullable()
      }

      const key = `${field.target_entity}__${field.field_name}`
      shape[key] = fieldSchema
    }
  }

  return z.object(shape)
}

// ─── Main Renderer ───────────────────────────────────────

export interface FormRendererContext {
  propertyId?: string
}

interface DynamicFormRendererProps {
  sections: FormSectionConfig[]
  defaultValues: Record<string, unknown>
  onSubmit: (values: Record<string, Record<string, unknown>>) => Promise<void>
  isSubmitting?: boolean
  submitLabel?: string
  formId?: string
  hideSubmitButton?: boolean
  context?: FormRendererContext
  readOnly?: boolean
}

export function DynamicFormRenderer({
  sections,
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = 'Guardar Alterações',
  formId,
  hideSubmitButton,
  context,
  readOnly,
}: DynamicFormRendererProps) {
  const schema = useMemo(() => buildZodSchema(sections), [sections])

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Campos media_upload para ignorar no agrupamento (uploads já foram directos)
  const mediaFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const section of sections) {
      for (const f of section.fields) {
        if (f.field_type === 'media_upload') {
          keys.add(`${f.target_entity}__${f.field_name}`)
        }
      }
    }
    return keys
  }, [sections])

  const handleSubmit = async (values: Record<string, unknown>) => {
    // Agrupar valores por target_entity para enviar ao API
    const grouped: Record<string, Record<string, unknown>> = {}

    for (const [key, value] of Object.entries(values)) {
      // Ignorar campos de media_upload (uploads já foram feitos directamente)
      if (mediaFieldKeys.has(key)) continue

      const [entity, ...fieldParts] = key.split('__')
      const fieldName = fieldParts.join('__')
      if (!grouped[entity]) grouped[entity] = {}
      grouped[entity][fieldName] = value
    }

    await onSubmit(grouped)
  }

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className={readOnly ? 'pointer-events-none' : undefined}>
        {sections
          .sort((a, b) => a.order_index - b.order_index)
          .map((section) => (
            <Card key={`${section.title}-${section.order_index}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-4">
                  {section.fields
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((field) => {
                      const key = `${field.target_entity}__${field.field_name}`
                      const Component = FIELD_COMPONENTS[field.field_type]
                      if (!Component) return null

                      // address_map e media_upload são sempre full width
                      const isComposite = field.field_type === 'address_map' || field.field_type === 'media_upload'
                      const colSpan = isComposite ? 'col-span-12' :
                        field.width === 'third' ? 'col-span-12 sm:col-span-4' :
                        field.width === 'half' ? 'col-span-12 sm:col-span-6' :
                        'col-span-12'

                      return (
                        <div key={key} className={colSpan}>
                          <Component
                            field={field}
                            name={key}
                            control={form.control}
                            {...(isComposite ? { context } : {})}
                          />
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!hideSubmitButton && !readOnly && (
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        )}
      </form>
    </Form>
  )
}
