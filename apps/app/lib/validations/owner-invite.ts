import { z } from 'zod'

export const createOwnerInviteSchema = z.object({
  note: z.string().max(500).optional(),
  // Defaults to 14 days server-side; optional override up to 60 days.
  expires_in_days: z.number().int().min(1).max(60).optional(),
})

export type CreateOwnerInviteInput = z.infer<typeof createOwnerInviteSchema>

// Public form captures only fields that are NOT extractable from the
// uploaded docs (CC, comprovativo de morada, certidão permanente, etc.).
// The submit handler runs OCR/AI over the docs and merges the extracted
// fields into the owner row. All "manual" fields are optional on the wire.
const manualSingularFields = z.object({
  name: z.string().min(2, 'Indique nome e apelido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  marital_status: z.string().optional().or(z.literal('')),
  marital_regime: z.string().optional().or(z.literal('')),
  profession: z.string().optional().or(z.literal('')),
})

const manualColetivaFields = z.object({
  name: z.string().min(2, 'Indique a designação da empresa'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
})

const uploadedFileSchema = z.object({
  slot_slug: z.string(),
  file_url: z.string().url(),
  r2_key: z.string(),
  file_name: z.string(),
  file_size: z.number().int().nonnegative(),
  mime_type: z.string(),
})

export type UploadedInviteFile = z.infer<typeof uploadedFileSchema>

export const submitOwnerInviteSchema = z.union([
  // Pessoa singular — single owner.
  z.object({
    mode: z.literal('singular'),
    is_heranca: z.literal(false),
    primary: manualSingularFields.extend({
      ownership_percentage: z.number().min(0).max(100).default(100),
    }),
    files: z.array(uploadedFileSchema).default([]),
  }),
  // Singular + herança — cabeça + herdeiros.
  z.object({
    mode: z.literal('singular'),
    is_heranca: z.literal(true),
    primary: manualSingularFields.extend({
      ownership_percentage: z.number().min(0).max(100).default(50),
    }),
    heirs: z
      .array(
        z.object({
          name: z.string().min(2, 'Indique nome e apelido do herdeiro'),
          email: z.string().email('Email inválido').optional().or(z.literal('')),
          phone: z.string().optional().or(z.literal('')),
          ownership_percentage: z.number().min(0).max(100).optional(),
        })
      )
      .default([]),
    files: z.array(uploadedFileSchema).default([]),
    heir_files: z
      .array(
        uploadedFileSchema.extend({
          heir_index: z.number().int().nonnegative(),
        })
      )
      .default([]),
  }),
  // Pessoa colectiva.
  z.object({
    mode: z.literal('coletiva'),
    primary: manualColetivaFields.extend({
      ownership_percentage: z.number().min(0).max(100).default(100),
    }),
    files: z.array(uploadedFileSchema).default([]),
  }),
])

export type SubmitOwnerInviteInput = z.infer<typeof submitOwnerInviteSchema>
