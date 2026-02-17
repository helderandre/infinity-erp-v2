import { z } from 'zod'

export const ownerSchema = z.object({
  person_type: z.enum(['singular', 'coletiva'], {
    message: 'Seleccione o tipo de pessoa',
  }),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  nif: z.string().min(9, 'NIF inválido').max(9, 'NIF inválido').optional(),
  nationality: z.string().optional(),
  naturality: z.string().optional(),
  marital_status: z.string().optional(),
  address: z.string().optional(),
  observations: z.string().optional(),

  // Campos para pessoa colectiva
  legal_representative_name: z.string().optional(),
  legal_representative_nif: z.string().optional(),
  company_cert_url: z.string().url('URL inválida').optional().or(z.literal('')),
})
  .refine(
    (data) => {
      if (data.person_type === 'coletiva') {
        return data.legal_representative_name && data.legal_representative_nif
      }
      return true
    },
    {
      message:
        'Para pessoas colectivas, o nome e NIF do representante legal são obrigatórios',
      path: ['legal_representative_name'],
    }
  )

export const propertyOwnerSchema = z.object({
  property_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  ownership_percentage: z.number().min(0).max(100).default(100),
  is_main_contact: z.boolean().default(false),
})

export type OwnerFormData = z.infer<typeof ownerSchema>
export type PropertyOwnerFormData = z.infer<typeof propertyOwnerSchema>
