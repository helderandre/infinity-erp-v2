import { z } from 'zod'

export const ownerSchema = z.object({
  person_type: z.enum(['singular', 'coletiva'], {
    message: 'Seleccione o tipo de pessoa',
  }),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  nif: z.string().min(9, 'NIF inválido').max(9, 'NIF inválido').optional().or(z.literal('')),
  nationality: z.string().optional(),
  naturality: z.string().optional(),
  marital_status: z.string().optional(),
  marital_regime: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  observations: z.string().optional(),

  // Pessoa singular — identificação
  birth_date: z.string().optional().or(z.literal('')),
  id_doc_type: z.string().optional(),
  id_doc_number: z.string().optional(),
  id_doc_expiry: z.string().optional().or(z.literal('')),
  id_doc_issued_by: z.string().optional(),
  profession: z.string().optional(),
  last_profession: z.string().optional(),
  is_portugal_resident: z.boolean().optional().nullable(),
  residence_country: z.string().optional(),

  // PEP
  is_pep: z.boolean().optional().nullable(),
  pep_position: z.string().optional(),
  funds_origin: z.array(z.string()).optional().nullable(),

  // Pessoa colectiva
  legal_representative_name: z.string().optional(),
  legal_representative_nif: z.string().optional(),
  legal_rep_id_doc: z.string().optional(),
  company_cert_url: z.string().url('URL inválida').optional().or(z.literal('')),
  company_object: z.string().optional(),
  company_branches: z.string().optional(),
  legal_nature: z.string().optional(),
  country_of_incorporation: z.string().optional(),
  cae_code: z.string().optional(),
  rcbe_code: z.string().optional(),
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
