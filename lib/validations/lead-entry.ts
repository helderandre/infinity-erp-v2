import { z } from 'zod'

export const createLeadEntrySchema = z.object({
  source: z.enum(['meta_ads', 'google_ads', 'website', 'landing_page', 'manual', 'voice', 'partner', 'organic', 'walk_in', 'phone_call', 'social_media', 'other']),
  campaign_id: z.string().optional().nullable(),
  partner_id: z.string().optional().nullable(),
  // Raw contact info
  raw_name: z.string().min(1, 'Nome obrigatorio'),
  raw_email: z.string().email('Email invalido').optional().or(z.literal('')).nullable(),
  raw_phone: z.string().optional().or(z.literal('')).nullable(),
  // UTM
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  // Extra
  form_data: z.record(z.string(), z.unknown()).optional().nullable(),
  form_url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Assignment override
  assigned_consultant_id: z.string().optional().nullable(),
})

export const updateLeadEntryStatusSchema = z.object({
  status: z.enum(['new', 'seen', 'processing', 'converted', 'discarded']),
})

export const transcribeLeadSchema = z.object({
  audio: z.string().min(1),
})
