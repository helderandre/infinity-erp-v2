export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contact_form_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          notes: string | null
          phone: string | null
          read_at: string | null
          replied_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          notes?: string | null
          phone?: string | null
          read_at?: string | null
          replied_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          notes?: string | null
          phone?: string | null
          read_at?: string | null
          replied_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dev_consultant_private_data: {
        Row: {
          address_private: string | null
          commission_rate: number | null
          documents_json: Json | null
          full_name: string | null
          hiring_date: string | null
          iban: string | null
          monthly_salary: number | null
          nif: string | null
          user_id: string
        }
        Insert: {
          address_private?: string | null
          commission_rate?: number | null
          documents_json?: Json | null
          full_name?: string | null
          hiring_date?: string | null
          iban?: string | null
          monthly_salary?: number | null
          nif?: string | null
          user_id: string
        }
        Update: {
          address_private?: string | null
          commission_rate?: number | null
          documents_json?: Json | null
          full_name?: string | null
          hiring_date?: string | null
          iban?: string | null
          monthly_salary?: number | null
          nif?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_consultant_private_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_consultant_profiles: {
        Row: {
          bio: string | null
          instagram_handle: string | null
          languages: string[] | null
          linkedin_url: string | null
          phone_commercial: string | null
          profile_photo_url: string | null
          specializations: string[] | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          instagram_handle?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          phone_commercial?: string | null
          profile_photo_url?: string | null
          specializations?: string[] | null
          user_id: string
        }
        Update: {
          bio?: string | null
          instagram_handle?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          phone_commercial?: string | null
          profile_photo_url?: string | null
          specializations?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_consultant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_properties: {
        Row: {
          address_parish: string | null
          address_street: string | null
          business_status: string | null
          business_type: string | null
          city: string | null
          consultant_id: string | null
          contract_regime: string | null
          created_at: string | null
          description: string | null
          energy_certificate: string | null
          external_ref: string | null
          id: string
          latitude: number | null
          listing_price: number | null
          longitude: number | null
          postal_code: string | null
          property_condition: string | null
          property_type: string | null
          slug: string | null
          status: string | null
          title: string
          updated_at: string | null
          zone: string | null
        }
        Insert: {
          address_parish?: string | null
          address_street?: string | null
          business_status?: string | null
          business_type?: string | null
          city?: string | null
          consultant_id?: string | null
          contract_regime?: string | null
          created_at?: string | null
          description?: string | null
          energy_certificate?: string | null
          external_ref?: string | null
          id?: string
          latitude?: number | null
          listing_price?: number | null
          longitude?: number | null
          postal_code?: string | null
          property_condition?: string | null
          property_type?: string | null
          slug?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          zone?: string | null
        }
        Update: {
          address_parish?: string | null
          address_street?: string | null
          business_status?: string | null
          business_type?: string | null
          city?: string | null
          consultant_id?: string | null
          contract_regime?: string | null
          created_at?: string | null
          description?: string | null
          energy_certificate?: string | null
          external_ref?: string | null
          id?: string
          latitude?: number | null
          listing_price?: number | null
          longitude?: number | null
          postal_code?: string | null
          property_condition?: string | null
          property_type?: string | null
          slug?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_properties_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_property_internal: {
        Row: {
          commission_agreed: number | null
          commission_type: string | null
          condominium_fee: number | null
          contract_expiry: string | null
          contract_regime: string | null
          contract_term: string | null
          cpcv_percentage: number | null
          exact_address: string | null
          imi_value: number | null
          internal_notes: string | null
          postal_code: string | null
          property_id: string
          reference_internal: string | null
        }
        Insert: {
          commission_agreed?: number | null
          commission_type?: string | null
          condominium_fee?: number | null
          contract_expiry?: string | null
          contract_regime?: string | null
          contract_term?: string | null
          cpcv_percentage?: number | null
          exact_address?: string | null
          imi_value?: number | null
          internal_notes?: string | null
          postal_code?: string | null
          property_id: string
          reference_internal?: string | null
        }
        Update: {
          commission_agreed?: number | null
          commission_type?: string | null
          condominium_fee?: number | null
          contract_expiry?: string | null
          contract_regime?: string | null
          contract_term?: string | null
          cpcv_percentage?: number | null
          exact_address?: string | null
          imi_value?: number | null
          internal_notes?: string | null
          postal_code?: string | null
          property_id?: string
          reference_internal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_property_internal_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_property_media: {
        Row: {
          id: string
          is_cover: boolean | null
          media_type: string | null
          order_index: number | null
          property_id: string | null
          url: string
        }
        Insert: {
          id?: string
          is_cover?: boolean | null
          media_type?: string | null
          order_index?: number | null
          property_id?: string | null
          url: string
        }
        Update: {
          id?: string
          is_cover?: boolean | null
          media_type?: string | null
          order_index?: number | null
          property_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_property_specifications: {
        Row: {
          area_gross: number | null
          area_util: number | null
          attic_area: number | null
          balcony_area: number | null
          bathrooms: number | null
          bedrooms: number | null
          construction_year: number | null
          equipment: string[] | null
          features: string[] | null
          fronts_count: number | null
          garage_spaces: number | null
          gym_area: number | null
          has_elevator: boolean | null
          pantry_area: number | null
          parking_spaces: number | null
          pool_area: number | null
          property_id: string
          solar_orientation: string[] | null
          storage_area: number | null
          typology: string | null
          views: string[] | null
        }
        Insert: {
          area_gross?: number | null
          area_util?: number | null
          attic_area?: number | null
          balcony_area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          construction_year?: number | null
          equipment?: string[] | null
          features?: string[] | null
          fronts_count?: number | null
          garage_spaces?: number | null
          gym_area?: number | null
          has_elevator?: boolean | null
          pantry_area?: number | null
          parking_spaces?: number | null
          pool_area?: number | null
          property_id: string
          solar_orientation?: string[] | null
          storage_area?: number | null
          typology?: string | null
          views?: string[] | null
        }
        Update: {
          area_gross?: number | null
          area_util?: number | null
          attic_area?: number | null
          balcony_area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          construction_year?: number | null
          equipment?: string[] | null
          features?: string[] | null
          fronts_count?: number | null
          garage_spaces?: number | null
          gym_area?: number | null
          has_elevator?: boolean | null
          pantry_area?: number | null
          parking_spaces?: number | null
          pool_area?: number | null
          property_id?: string
          solar_orientation?: string[] | null
          storage_area?: number | null
          typology?: string | null
          views?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_property_specifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_users: {
        Row: {
          commercial_name: string
          created_at: string | null
          display_website: boolean | null
          id: string
          is_active: boolean | null
          professional_email: string | null
        }
        Insert: {
          commercial_name: string
          created_at?: string | null
          display_website?: boolean | null
          id: string
          is_active?: boolean | null
          professional_email?: string | null
        }
        Update: {
          commercial_name?: string
          created_at?: string | null
          display_website?: boolean | null
          id?: string
          is_active?: boolean | null
          professional_email?: string | null
        }
        Relationships: []
      }
      doc_registry: {
        Row: {
          created_at: string | null
          doc_type_id: string | null
          file_name: string
          file_url: string
          id: string
          metadata: Json | null
          property_id: string | null
          status: string | null
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type_id?: string | null
          file_name: string
          file_url: string
          id?: string
          metadata?: Json | null
          property_id?: string | null
          status?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type_id?: string | null
          file_name?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          property_id?: string | null
          status?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_registry_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_registry_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_registry_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_types: {
        Row: {
          allowed_extensions: string[] | null
          category: string | null
          created_at: string | null
          default_validity_months: number | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          allowed_extensions?: string[] | null
          category?: string | null
          created_at?: string | null
          default_validity_months?: number | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          allowed_extensions?: string[] | null
          category?: string | null
          created_at?: string | null
          default_validity_months?: number | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      kv_store_6f39db24: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          agent_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_reason: string | null
          assigned_agent_id: string | null
          business_type: string | null
          created_at: string
          created_at_origin: string | null
          email: string | null
          expires_at: string | null
          first_contacted_at: string | null
          id: string
          language: string | null
          lead_type: string
          name: string
          phone_primary: string | null
          phone_secondary: string | null
          priority: string
          property_id: string | null
          property_reference: string | null
          qualified_at: string | null
          score: number | null
          source: string
          source_detail: string | null
          source_message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_reason?: string | null
          assigned_agent_id?: string | null
          business_type?: string | null
          created_at?: string
          created_at_origin?: string | null
          email?: string | null
          expires_at?: string | null
          first_contacted_at?: string | null
          id?: string
          language?: string | null
          lead_type?: string
          name: string
          phone_primary?: string | null
          phone_secondary?: string | null
          priority?: string
          property_id?: string | null
          property_reference?: string | null
          qualified_at?: string | null
          score?: number | null
          source: string
          source_detail?: string | null
          source_message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_reason?: string | null
          assigned_agent_id?: string | null
          business_type?: string | null
          created_at?: string
          created_at_origin?: string | null
          email?: string | null
          expires_at?: string | null
          first_contacted_at?: string | null
          id?: string
          language?: string | null
          lead_type?: string
          name?: string
          phone_primary?: string | null
          phone_secondary?: string | null
          priority?: string
          property_id?: string | null
          property_reference?: string | null
          qualified_at?: string | null
          score?: number | null
          source?: string
          source_detail?: string | null
          source_message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      log_audit: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      log_emails: {
        Row: {
          delivery_status: string | null
          id: string
          metadata: Json | null
          proc_task_id: string | null
          provider_id: string | null
          recipient_email: string
          sent_at: string | null
          subject: string | null
        }
        Insert: {
          delivery_status?: string | null
          id?: string
          metadata?: Json | null
          proc_task_id?: string | null
          provider_id?: string | null
          recipient_email: string
          sent_at?: string | null
          subject?: string | null
        }
        Update: {
          delivery_status?: string | null
          id?: string
          metadata?: Json | null
          proc_task_id?: string | null
          provider_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_emails_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          address: string | null
          company_cert_url: string | null
          created_at: string | null
          email: string | null
          id: string
          legal_representative_name: string | null
          legal_representative_nif: string | null
          marital_status: string | null
          name: string
          nationality: string | null
          naturality: string | null
          nif: string | null
          observations: string | null
          person_type: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_cert_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_representative_name?: string | null
          legal_representative_nif?: string | null
          marital_status?: string | null
          name: string
          nationality?: string | null
          naturality?: string | null
          nif?: string | null
          observations?: string | null
          person_type: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_cert_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_representative_name?: string | null
          legal_representative_nif?: string | null
          marital_status?: string | null
          name?: string
          nationality?: string | null
          naturality?: string | null
          nif?: string | null
          observations?: string | null
          person_type?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proc_instances: {
        Row: {
          completed_at: string | null
          current_stage_id: string | null
          current_status: string | null
          external_ref: string | null
          id: string
          percent_complete: number | null
          property_id: string
          started_at: string | null
          tpl_process_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          current_stage_id?: string | null
          current_status?: string | null
          external_ref?: string | null
          id?: string
          percent_complete?: number | null
          property_id: string
          started_at?: string | null
          tpl_process_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          current_stage_id?: string | null
          current_status?: string | null
          external_ref?: string | null
          id?: string
          percent_complete?: number | null
          property_id?: string
          started_at?: string | null
          tpl_process_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_instances_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "tpl_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_tpl_process_id_fkey"
            columns: ["tpl_process_id"]
            isOneToOne: false
            referencedRelation: "tpl_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_tasks: {
        Row: {
          assigned_to: string | null
          bypass_reason: string | null
          bypassed_by: string | null
          completed_at: string | null
          due_date: string | null
          id: string
          is_bypassed: boolean | null
          is_mandatory: boolean | null
          proc_instance_id: string
          stage_name: string | null
          stage_order_index: number | null
          status: string | null
          task_result: Json | null
          title: string
          tpl_task_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          bypass_reason?: string | null
          bypassed_by?: string | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          is_bypassed?: boolean | null
          is_mandatory?: boolean | null
          proc_instance_id: string
          stage_name?: string | null
          stage_order_index?: number | null
          status?: string | null
          task_result?: Json | null
          title: string
          tpl_task_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          bypass_reason?: string | null
          bypassed_by?: string | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          is_bypassed?: boolean | null
          is_mandatory?: boolean | null
          proc_instance_id?: string
          stage_name?: string | null
          stage_order_index?: number | null
          status?: string | null
          task_result?: Json | null
          title?: string
          tpl_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_tasks_bypassed_by_fkey"
            columns: ["bypassed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_tasks_proc_instance_id_fkey"
            columns: ["proc_instance_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_tasks_tpl_task_id_fkey"
            columns: ["tpl_task_id"]
            isOneToOne: false
            referencedRelation: "tpl_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      property_listings: {
        Row: {
          approval_date: string | null
          area_bruta: number | null
          area_util: number | null
          attic_area: number | null
          balcony_area: number | null
          bathrooms_count: number | null
          business_type: string | null
          cmi_date: string | null
          commission_rate: number | null
          condominium_fee: number | null
          construction_year: number | null
          consultant_id: string | null
          consultant_name: string | null
          contract_regime: string | null
          contract_term: string | null
          cpcv_payment_percentage: number | null
          created_at: string | null
          deal_notes: string | null
          deed_payment_percentage: number | null
          energy_certificate: string | null
          equipment: string | null
          external_listing: string | null
          external_reference_id: string | null
          fronts_count: number | null
          full_address_template: string | null
          garage_spaces: number | null
          gym_area: number | null
          has_elevator: boolean | null
          has_referral: boolean | null
          id: string
          imi_value: number | null
          listing_price: number | null
          locality: string | null
          occupancy_status: string | null
          other_equipment: string | null
          owner_type: string | null
          owners_count: number | null
          pantry_area: number | null
          parish: string | null
          parking_spaces: number | null
          pool_area: number | null
          postal_code: string | null
          postal_locality_template: string | null
          property_address: string | null
          property_condition: string | null
          property_notes: string | null
          property_observations: string | null
          property_type: string | null
          referral_colleague_info: string | null
          referral_percentage: number | null
          referral_type: string | null
          solar_orientation: string | null
          storage_area: number | null
          typology: string | null
          updated_at: string | null
          views: string | null
          zone: string | null
        }
        Insert: {
          approval_date?: string | null
          area_bruta?: number | null
          area_util?: number | null
          attic_area?: number | null
          balcony_area?: number | null
          bathrooms_count?: number | null
          business_type?: string | null
          cmi_date?: string | null
          commission_rate?: number | null
          condominium_fee?: number | null
          construction_year?: number | null
          consultant_id?: string | null
          consultant_name?: string | null
          contract_regime?: string | null
          contract_term?: string | null
          cpcv_payment_percentage?: number | null
          created_at?: string | null
          deal_notes?: string | null
          deed_payment_percentage?: number | null
          energy_certificate?: string | null
          equipment?: string | null
          external_listing?: string | null
          external_reference_id?: string | null
          fronts_count?: number | null
          full_address_template?: string | null
          garage_spaces?: number | null
          gym_area?: number | null
          has_elevator?: boolean | null
          has_referral?: boolean | null
          id?: string
          imi_value?: number | null
          listing_price?: number | null
          locality?: string | null
          occupancy_status?: string | null
          other_equipment?: string | null
          owner_type?: string | null
          owners_count?: number | null
          pantry_area?: number | null
          parish?: string | null
          parking_spaces?: number | null
          pool_area?: number | null
          postal_code?: string | null
          postal_locality_template?: string | null
          property_address?: string | null
          property_condition?: string | null
          property_notes?: string | null
          property_observations?: string | null
          property_type?: string | null
          referral_colleague_info?: string | null
          referral_percentage?: number | null
          referral_type?: string | null
          solar_orientation?: string | null
          storage_area?: number | null
          typology?: string | null
          updated_at?: string | null
          views?: string | null
          zone?: string | null
        }
        Update: {
          approval_date?: string | null
          area_bruta?: number | null
          area_util?: number | null
          attic_area?: number | null
          balcony_area?: number | null
          bathrooms_count?: number | null
          business_type?: string | null
          cmi_date?: string | null
          commission_rate?: number | null
          condominium_fee?: number | null
          construction_year?: number | null
          consultant_id?: string | null
          consultant_name?: string | null
          contract_regime?: string | null
          contract_term?: string | null
          cpcv_payment_percentage?: number | null
          created_at?: string | null
          deal_notes?: string | null
          deed_payment_percentage?: number | null
          energy_certificate?: string | null
          equipment?: string | null
          external_listing?: string | null
          external_reference_id?: string | null
          fronts_count?: number | null
          full_address_template?: string | null
          garage_spaces?: number | null
          gym_area?: number | null
          has_elevator?: boolean | null
          has_referral?: boolean | null
          id?: string
          imi_value?: number | null
          listing_price?: number | null
          locality?: string | null
          occupancy_status?: string | null
          other_equipment?: string | null
          owner_type?: string | null
          owners_count?: number | null
          pantry_area?: number | null
          parish?: string | null
          parking_spaces?: number | null
          pool_area?: number | null
          postal_code?: string | null
          postal_locality_template?: string | null
          property_address?: string | null
          property_condition?: string | null
          property_notes?: string | null
          property_observations?: string | null
          property_type?: string | null
          referral_colleague_info?: string | null
          referral_percentage?: number | null
          referral_type?: string | null
          solar_orientation?: string | null
          storage_area?: number | null
          typology?: string | null
          updated_at?: string | null
          views?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_listings_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          is_main_contact: boolean | null
          owner_id: string
          ownership_percentage: number | null
          property_id: string
        }
        Insert: {
          is_main_contact?: boolean | null
          owner_id: string
          ownership_percentage?: number | null
          property_id: string
        }
        Update: {
          is_main_contact?: boolean | null
          owner_id?: string
          ownership_percentage?: number | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tpl_doc_library: {
        Row: {
          content_html: string
          created_at: string | null
          description: string | null
          doc_type_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          content_html: string
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpl_doc_library_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "doc_types"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_email_library: {
        Row: {
          body_html: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tpl_processes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      tpl_stages: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number
          tpl_process_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index: number
          tpl_process_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          tpl_process_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpl_stages_tpl_process_id_fkey"
            columns: ["tpl_process_id"]
            isOneToOne: false
            referencedRelation: "tpl_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_tasks: {
        Row: {
          action_type: string
          config: Json | null
          dependency_task_id: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          order_index: number
          sla_days: number | null
          title: string
          tpl_stage_id: string | null
        }
        Insert: {
          action_type: string
          config?: Json | null
          dependency_task_id?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index: number
          sla_days?: number | null
          title: string
          tpl_stage_id?: string | null
        }
        Update: {
          action_type?: string
          config?: Json | null
          dependency_task_id?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number
          sla_days?: number | null
          title?: string
          tpl_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpl_tasks_tpl_stage_id_fkey"
            columns: ["tpl_stage_id"]
            isOneToOne: false
            referencedRelation: "tpl_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agreed_value: number | null
          bio: string | null
          birthplace: string | null
          city: string | null
          commercial_name: string | null
          commission_value: number | null
          company_address: string | null
          company_email: string | null
          company_iban: string | null
          company_name: string | null
          company_nif: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          display_website: boolean | null
          district: string | null
          documents: Json | null
          entity_type: string | null
          facebook_url: string | null
          full_name: string | null
          green_receipt: boolean | null
          hire_date: string | null
          iban: string | null
          id: string
          identity_card: string | null
          identity_card_validity: string | null
          instagram_handle: string | null
          is_active: boolean | null
          languages: string[] | null
          license_number: string | null
          linkedin_url: string | null
          monthly_salary: number | null
          nationality: string | null
          nif: string | null
          personal_email: string | null
          phone_primary: string | null
          phone_secondary: string | null
          photo_url: string | null
          postal_code: string | null
          previous_agency: string | null
          professional_activity: string | null
          professional_email: string | null
          profile_photo_crop: Json | null
          profile_photo_url: string | null
          role_id: string | null
          specializations: string[] | null
          sub_role: string | null
          tax_regime: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agreed_value?: number | null
          bio?: string | null
          birthplace?: string | null
          city?: string | null
          commercial_name?: string | null
          commission_value?: number | null
          company_address?: string | null
          company_email?: string | null
          company_iban?: string | null
          company_name?: string | null
          company_nif?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          display_website?: boolean | null
          district?: string | null
          documents?: Json | null
          entity_type?: string | null
          facebook_url?: string | null
          full_name?: string | null
          green_receipt?: boolean | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          identity_card?: string | null
          identity_card_validity?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          license_number?: string | null
          linkedin_url?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          personal_email?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          postal_code?: string | null
          previous_agency?: string | null
          professional_activity?: string | null
          professional_email?: string | null
          profile_photo_crop?: Json | null
          profile_photo_url?: string | null
          role_id?: string | null
          specializations?: string[] | null
          sub_role?: string | null
          tax_regime?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agreed_value?: number | null
          bio?: string | null
          birthplace?: string | null
          city?: string | null
          commercial_name?: string | null
          commission_value?: number | null
          company_address?: string | null
          company_email?: string | null
          company_iban?: string | null
          company_name?: string | null
          company_nif?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          display_website?: boolean | null
          district?: string | null
          documents?: Json | null
          entity_type?: string | null
          facebook_url?: string | null
          full_name?: string | null
          green_receipt?: boolean | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          identity_card?: string | null
          identity_card_validity?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          license_number?: string | null
          linkedin_url?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          personal_email?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          photo_url?: string | null
          postal_code?: string | null
          previous_agency?: string | null
          professional_activity?: string | null
          professional_email?: string | null
          profile_photo_crop?: Json | null
          profile_photo_url?: string | null
          role_id?: string | null
          specializations?: string[] | null
          sub_role?: string | null
          tax_regime?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
