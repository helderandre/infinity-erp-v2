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
  // Identification
  gender: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  id_doc_type: z.string().nullable().optional(),
  id_doc_number: z.string().nullable().optional(),
  id_doc_expiry: z.string().nullable().optional(),
  id_doc_issuer: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  id_doc_file_url: z.string().nullable().optional(),
  // Address
  postal_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  concelho: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  // Company
  has_company: z.boolean().nullable().optional(),
  company_name: z.string().nullable().optional(),
  company_phone: z.string().nullable().optional(),
  company_email: z.string().nullable().optional(),
  company_address: z.string().nullable().optional(),
  company_nipc: z.string().nullable().optional(),
  company_website: z.string().nullable().optional(),
  // Contract
  contract_file_url: z.string().nullable().optional(),
  contract_start_date: z.string().nullable().optional(),
  contract_end_date: z.string().nullable().optional(),
  contract_type: z.string().nullable().optional(),
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
