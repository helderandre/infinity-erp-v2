import { createClient } from '@supabase/supabase-js';

// Public Supabase project (shared with the Infinity ERP). The anon key is a
// public client credential and is safe to ship; env vars override it.
const FALLBACK_PROJECT_ID = 'umlndumjfamfsswwjgoo';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbG5kdW1qZmFtZnNzd3dqZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjM4MjksImV4cCI6MjA4NTA5OTgyOX0._nnXnNIMYi2XkQWRtmzudO6bWNJ0mKmUVGlptqcUPtg';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${FALLBACK_PROJECT_ID}.supabase.co`;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;

// Create a singleton Supabase client with proper configuration
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'sb-infinity-group-auth',
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// Profile type definition
export interface Profile {
  id: string;
  full_name: string;
  commercial_name?: string | null;
  date_of_birth?: string | null;
  birth_date?: string | null;
  birthplace?: string | null;
  nationality?: string | null;
  website_name?: string | null;
  professional_email?: string | null;
  personal_email?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  nif?: string | null;
  identity_card?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  district?: string | null;
  country?: string;
  role_id?: string | null;
  department?: string | null;
  license_number?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  iban?: string | null;
  is_active: boolean;
  display_website?: boolean;
  profile_photo_url?: string | null;
  photo_url?: string | null;
  instagram_handle?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  bio?: string | null;
  specializations?: string | null;
  languages?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // HR and billing fields
  previous_agency?: string | null;
  commission_value?: string | null;
  monthly_salary?: string | null;
  agreed_value?: string | null;
  
  // Entity type and company information
  entity_type?: 'individual' | 'company' | 'recibos_verdes' | null;
  company_nif?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_iban?: string | null;
  tax_regime?: string | null;
  green_receipt?: boolean;
  professional_activity?: string | null;
  
  // Document uploads (will store file paths/URLs)
  documents?: {
    id_card?: string | null;
    contract?: string | null;
    other?: string[] | null;
  } | null;
  
  roles?: {
    id: string;
    name: string;
    description?: string | null;
    permissions?: any;
    created_at?: string;
  };
}

// Property type definition
export interface Property {
  id: string;
  reference_code?: string | null;
  property_type_id?: string | null;
  status_id?: string | null;
  owner_id?: string | null;
  primary_agent_id?: string | null;
  title?: string | null;
  description_pt?: string | null;
  description_en?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  district?: string | null;
  municipality?: string | null;
  parish?: string | null;
  postal_code?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  wc?: number | null;
  floors?: number | null;
  floor_location?: number | null;
  total_floors_building?: number | null;
  gross_area?: number | null;
  net_area?: number | null;
  land_area?: number | null;
  terrace_area?: number | null;
  balcony_area?: number | null;
  garden_area?: number | null;
  parking_spaces?: number | null;
  garage_spaces?: number | null;
  storage_rooms?: number | null;
  construction_year?: number | null;
  renovation_year?: number | null;
  building_condition?: string | null;
  orientation?: string | null;
  sun_exposure?: string | null;
  energy_certificate?: string | null;
  asking_price?: number | null;
  price_per_sqm?: number | null;
  condominium_fee?: number | null;
  rental_yield?: number | null;
  imi_annual?: number | null;
  commission_percentage?: number | null;
  commission_amount?: number | null;
  commission_type?: string | null;
  commission_split?: string | null;
  featured?: boolean;
  slug?: string | null;
  show_on_website?: boolean;
  listing_date?: string | null;
  available_from?: string | null;
  days_on_market?: number | null;
  furnished?: boolean;
  elevator?: boolean;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  main_image_url?: string | null;
  area?: number | null; // Computed field for display
  price?: number | null; // Alias for asking_price
  
  // CRM specific fields
  property_type?: string | null;
  typology?: string | null;
  property_address?: string | null;
  full_address_template?: string | null;
  locality?: string | null;
  zone?: string | null;
  business_type?: string | null;
  listing_price?: number | null;
  consultant_name?: string | null;
  consultant_id?: string | null;
  contract_regime?: string | null;
  contract_term?: string | null;
  commission_rate?: number | null;
  approval_date?: string | null;
  cmi_date?: string | null;
  bathrooms_count?: number | null;
  fronts_count?: number | null;
  property_condition?: string | null;
  occupancy_status?: string | null;
  has_elevator?: boolean;
  solar_orientation?: string | null;
  views?: string | null;
  equipment?: string | null;
  other_equipment?: string | null;
  storage_area?: number | null;
  pool_area?: number | null;
  attic_area?: number | null;
  pantry_area?: number | null;
  gym_area?: number | null;
  cpcv_payment_percentage?: number | null;
  deed_payment_percentage?: number | null;
  imi_value?: number | null;
  owner_type?: string | null;
  owners_count?: number | null;
  has_referral?: boolean;
  referral_type?: string | null;
  referral_percentage?: number | null;
  referral_colleague_info?: string | null;
  property_notes?: string | null;
  property_observations?: string | null;
  deal_notes?: string | null;
  
  // Relationships
  property_types?: {
    id: string;
    name: string;
    description?: string | null;
    created_at?: string;
  };
  property_status?: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    display_order?: number | null;
    created_at?: string;
  };
  media?: Array<{
    id: string;
    property_id: string;
    url: string;
    display_order?: number;
    is_cover?: boolean;
    media_type?: string;
    created_at?: string;
  }>;
}