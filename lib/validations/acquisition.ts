import { z } from 'zod'

// Schema para o formulário de angariação (multi-step)
export const acquisitionSchema = z.object({
  // Step 1: Dados do Imóvel
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres'),
  property_type: z.string().min(1, 'Seleccione o tipo de imóvel'),
  business_type: z.string().min(1, 'Seleccione o tipo de negócio'),
  listing_price: z.number().positive('O preço deve ser positivo'),
  description: z.string().optional(),
  property_condition: z.string().optional(),
  energy_certificate: z.string().optional(),

  // Step 2: Localização
  address_street: z.string().min(1, 'A morada é obrigatória'),
  city: z.string().min(1, 'A cidade é obrigatória'),
  address_parish: z.string().optional(),
  postal_code: z.string().optional(),
  zone: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  // Step 3: Proprietários (array de IDs ou novos)
  owners: z
    .array(
      z.object({
        id: z.string().uuid().optional(), // Se já existe
        person_type: z.enum(['singular', 'coletiva'], {
          message: 'Seleccione o tipo de pessoa',
        }),
        name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
        email: z
          .string()
          .email('Email inválido')
          .optional()
          .or(z.literal('')),
        phone: z.string().optional(),
        nif: z
          .string()
          .min(9, 'NIF inválido')
          .max(9, 'NIF inválido')
          .optional()
          .or(z.literal('')),
        nationality: z.string().optional(),
        naturality: z.string().optional(),
        marital_status: z.string().optional(),
        address: z.string().optional(),
        observations: z.string().optional(),
        ownership_percentage: z.number().min(0).max(100),
        is_main_contact: z.boolean(),
        // Campos para pessoa coletiva
        legal_representative_name: z.string().optional(),
        legal_representative_nif: z.string().optional(),
        // KYC Singular
        birth_date: z.string().optional(),
        id_doc_type: z.string().optional(),
        id_doc_number: z.string().optional(),
        id_doc_expiry: z.string().optional(),
        id_doc_issued_by: z.string().optional(),
        is_pep: z.boolean().default(false),
        pep_position: z.string().optional(),
        funds_origin: z.array(z.string()).default([]),
        profession: z.string().optional(),
        last_profession: z.string().optional(),
        is_portugal_resident: z.boolean().default(true),
        residence_country: z.string().optional(),
        postal_code: z.string().optional(),
        city: z.string().optional(),
        marital_regime: z.string().optional(),
        legal_rep_id_doc: z.string().optional(),
        // KYC Colectiva
        company_object: z.string().optional(),
        company_branches: z.string().optional(),
        legal_nature: z.string().optional(),
        country_of_incorporation: z.string().default('Portugal'),
        cae_code: z.string().optional(),
        rcbe_code: z.string().optional(),
        // Beneficiarios (apenas para colectiva sem rcbe_code)
        beneficiaries: z.array(z.object({
          full_name: z.string().min(2, 'Nome obrigatorio'),
          position: z.string().optional(),
          share_percentage: z.string().optional(),
          id_doc_type: z.string().optional(),
          id_doc_number: z.string().optional(),
          id_doc_expiry: z.string().optional(),
          id_doc_issued_by: z.string().optional(),
          nif: z.string().optional(),
        })).optional().default([]),
      })
    )
    .min(1, 'Deve ter pelo menos um proprietário'),

  // Step 4: Dados Contratuais
  contract_regime: z.string().min(1, 'Seleccione o regime de contrato'),
  commission_agreed: z
    .number()
    .nonnegative('A comissão não pode ser negativa'),
  commission_type: z.string().default('percentage'),
  contract_term: z.string().optional(),
  contract_expiry: z.string().optional(),
  imi_value: z.number().nonnegative().optional(),
  condominium_fee: z.number().nonnegative().optional(),
  internal_notes: z.string().optional(),

  // Especificações técnicas (opcional)
  specifications: z
    .object({
      typology: z.string().optional(),
      bedrooms: z.number().int().nonnegative().optional(),
      bathrooms: z.number().int().nonnegative().optional(),
      area_gross: z.number().nonnegative().optional(),
      area_util: z.number().nonnegative().optional(),
      construction_year: z.number().int().nullable().optional(),
      parking_spaces: z.number().int().nonnegative().optional(),
      garage_spaces: z.number().int().nonnegative().optional(),
      has_elevator: z.boolean().optional(),
      features: z.array(z.string()).optional(),
    })
    .optional(),

  // Step 5: Documentos (podem ser uploaded OU deferred)
  documents: z
    .array(
      z.object({
        doc_type_id: z.string(),
        file_url: z.string().optional(),     // Preenchido se upload imediato
        file_name: z.string().optional(),    // Sempre presente
        file_size: z.number().optional(),    // Presente no deferred
        file_type: z.string().optional(),    // Presente no deferred
        valid_until: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        owner_id: z.string().optional(),
      })
    )
    .optional(),

  // Campos internos (preenchidos automaticamente)
  consultant_id: z.string().uuid().optional(), // Auth user
  status: z.string().default('pending_approval'),
})

// Schema para edição de angariação (quando returned/pending)
export const acquisitionEditSchema = acquisitionSchema.partial()

// Types inferidos
export type AcquisitionFormData = z.infer<typeof acquisitionSchema>
export type AcquisitionEditFormData = z.infer<typeof acquisitionEditSchema>
