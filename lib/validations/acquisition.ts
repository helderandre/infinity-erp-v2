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
  latitude: z.number().optional(),
  longitude: z.number().optional(),

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
          .optional(),
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
      construction_year: z.number().int().optional(),
      parking_spaces: z.number().int().nonnegative().optional(),
      garage_spaces: z.number().int().nonnegative().optional(),
      has_elevator: z.boolean().optional(),
      features: z.array(z.string()).optional(),
    })
    .optional(),

  // Step 5: Documentos Iniciais (opcional - array de file IDs ou URLs)
  documents: z
    .array(
      z.object({
        doc_type_id: z.string().uuid(),
        file_url: z.string().optional(), // Se já foi feito upload
        file_name: z.string().optional(),
        valid_until: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
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
