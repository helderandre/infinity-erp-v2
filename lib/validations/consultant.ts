import { z } from 'zod'

export const consultantProfileSchema = z.object({
  bio: z.string().max(2000, 'Máximo 2000 caracteres').nullable().optional(),
  phone_commercial: z.string().max(20).nullable().optional(),
  specializations: z.array(z.string()).nullable().optional(),
  languages: z.array(z.string()).nullable().optional(),
  instagram_handle: z.string().max(100).nullable().optional(),
  linkedin_url: z.string().url('URL inválido').or(z.literal('')).nullable().optional(),
})

export const consultantPrivateDataSchema = z.object({
  full_name: z.string().max(200).nullable().optional(),
  nif: z.string().max(20).nullable().optional(),
  iban: z.string().max(34).nullable().optional(),
  address_private: z.string().max(500).nullable().optional(),
  monthly_salary: z.coerce.number().min(0).nullable().optional(),
  commission_rate: z.coerce.number().min(0).max(100).nullable().optional(),
  hiring_date: z.string().nullable().optional(),
})

export const consultantUserSchema = z.object({
  commercial_name: z.string().min(2, 'Nome comercial é obrigatório').max(200),
  professional_email: z.string().email('Email inválido').or(z.literal('')).nullable().optional(),
  is_active: z.boolean().optional(),
  display_website: z.boolean().optional(),
})

export const updateConsultantSchema = z.object({
  user: consultantUserSchema.partial(),
  profile: consultantProfileSchema.optional(),
  private_data: consultantPrivateDataSchema.optional(),
})

export type ConsultantProfileFormData = z.infer<typeof consultantProfileSchema>
export type ConsultantPrivateDataFormData = z.infer<typeof consultantPrivateDataSchema>
export type ConsultantUserFormData = z.infer<typeof consultantUserSchema>
export type UpdateConsultantFormData = z.infer<typeof updateConsultantSchema>
