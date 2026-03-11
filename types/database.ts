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
      auto_delivery_log: {
        Row: {
          channel: Database["public"]["Enums"]["auto_channel_type"]
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          external_message_id: string | null
          final_content: string | null
          flow_id: string
          id: string
          media_url: string | null
          message_type: string | null
          recipient_address: string
          run_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["auto_delivery_status"]
          step_run_id: string
          track_source: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["auto_channel_type"]
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          final_content?: string | null
          flow_id: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          recipient_address: string
          run_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["auto_delivery_status"]
          step_run_id: string
          track_source?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["auto_channel_type"]
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          final_content?: string | null
          flow_id?: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          recipient_address?: string
          run_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["auto_delivery_status"]
          step_run_id?: string
          track_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_delivery_log_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "auto_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_delivery_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "auto_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_delivery_log_step_run_id_fkey"
            columns: ["step_run_id"]
            isOneToOne: false
            referencedRelation: "auto_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_flow_versions: {
        Row: {
          changed_by: string | null
          created_at: string | null
          flow_definition: Json
          flow_id: string
          id: string
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          flow_definition: Json
          flow_id: string
          id?: string
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          flow_definition?: Json
          flow_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_flow_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_flow_versions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "auto_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_flows: {
        Row: {
          context_config: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          draft_definition: Json
          id: string
          is_active: boolean | null
          name: string
          published_at: string | null
          published_by: string | null
          published_definition: Json | null
          published_triggers: Json | null
          updated_at: string | null
          wpp_instance_id: string | null
        }
        Insert: {
          context_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          draft_definition?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          published_at?: string | null
          published_by?: string | null
          published_definition?: Json | null
          published_triggers?: Json | null
          updated_at?: string | null
          wpp_instance_id?: string | null
        }
        Update: {
          context_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          draft_definition?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          published_at?: string | null
          published_by?: string | null
          published_definition?: Json | null
          published_triggers?: Json | null
          updated_at?: string | null
          wpp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_flows_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_flows_wpp_instance_id_fkey"
            columns: ["wpp_instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_runs: {
        Row: {
          completed_at: string | null
          completed_steps: number | null
          context: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          failed_steps: number | null
          flow_id: string
          id: string
          is_test: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["auto_run_status"]
          total_steps: number | null
          trigger_id: string | null
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: number | null
          context?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          failed_steps?: number | null
          flow_id: string
          id?: string
          is_test?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["auto_run_status"]
          total_steps?: number | null
          trigger_id?: string | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_steps?: number | null
          context?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          failed_steps?: number | null
          flow_id?: string
          id?: string
          is_test?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["auto_run_status"]
          total_steps?: number | null
          trigger_id?: string | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "auto_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_runs_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "auto_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_step_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          flow_id: string
          id: string
          input_data: Json | null
          max_retries: number | null
          node_id: string
          node_label: string | null
          node_type: string
          output_data: Json | null
          priority: number | null
          retry_count: number | null
          run_id: string
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["auto_step_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          flow_id: string
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          node_id: string
          node_label?: string | null
          node_type: string
          output_data?: Json | null
          priority?: number | null
          retry_count?: number | null
          run_id: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["auto_step_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          flow_id?: string
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          node_id?: string
          node_label?: string | null
          node_type?: string
          output_data?: Json | null
          priority?: number | null
          retry_count?: number | null
          run_id?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["auto_step_status"]
        }
        Relationships: [
          {
            foreignKeyName: "auto_step_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "auto_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_step_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "auto_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_triggers: {
        Row: {
          active: boolean | null
          created_at: string | null
          flow_id: string
          id: string
          payload_mapping: Json | null
          source_type: string
          trigger_condition: Json | null
          trigger_source: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          flow_id: string
          id?: string
          payload_mapping?: Json | null
          source_type: string
          trigger_condition?: Json | null
          trigger_source?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          flow_id?: string
          id?: string
          payload_mapping?: Json | null
          source_type?: string
          trigger_condition?: Json | null
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_triggers_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "auto_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_webhook_captures: {
        Row: {
          flow_name: string | null
          payload: Json | null
          received_at: string | null
          source_id: string
          updated_at: string | null
        }
        Insert: {
          flow_name?: string | null
          payload?: Json | null
          received_at?: string | null
          source_id: string
          updated_at?: string | null
        }
        Update: {
          flow_name?: string | null
          payload?: Json | null
          received_at?: string | null
          source_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      auto_wpp_instances: {
        Row: {
          connection_status: string
          created_at: string | null
          id: string
          is_business: boolean | null
          name: string
          phone: string | null
          profile_name: string | null
          profile_pic_url: string | null
          status: string
          uazapi_instance_id: string | null
          uazapi_token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          connection_status?: string
          created_at?: string | null
          id?: string
          is_business?: boolean | null
          name: string
          phone?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          status?: string
          uazapi_instance_id?: string | null
          uazapi_token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string | null
          id?: string
          is_business?: boolean | null
          name?: string
          phone?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          status?: string
          uazapi_instance_id?: string | null
          uazapi_token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_wpp_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_wpp_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          messages: Json
          name: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json
          name: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json
          name?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_wpp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_documents: {
        Row: {
          consultant_id: string
          created_at: string | null
          doc_type_id: string | null
          file_name: string
          file_url: string
          id: string
          metadata: Json | null
          notes: string | null
          status: string | null
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          doc_type_id?: string | null
          file_name: string
          file_url: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          doc_type_id?: string | null
          file_name?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_documents_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_documents_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_corrente_limits: {
        Row: {
          agent_id: string
          created_at: string
          credit_limit: number
          id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          credit_limit?: number
          id?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          credit_limit?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_corrente_limits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_corrente_transactions: {
        Row: {
          agent_id: string
          amount: number
          balance_after: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          agent_id: string
          amount: number
          balance_after?: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          agent_id?: string
          amount?: number
          balance_after?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_corrente_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_corrente_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
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
          notes: string | null
          owner_id: string | null
          property_id: string | null
          status: string | null
          updated_at: string | null
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
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
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
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
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
            foreignKeyName: "doc_registry_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
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
      email_senders: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          reply_to: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          reply_to?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          reply_to?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_senders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      embarcacoes: {
        Row: {
          arqueacao: number | null
          boca: number | null
          comprimento: number | null
          cor_casco: string | null
          cor_superestrutura: string | null
          created_at: string | null
          data_construcao: number | null
          data_registo: string | null
          documento_url: string | null
          fls: number | null
          id: string
          livro: number | null
          lotacao: number | null
          marca: string | null
          material_casco: string | null
          meios_salvacao: Json | null
          modelo: string | null
          motor_combustivel: string | null
          motor_marca: string | null
          motor_numero: string | null
          motor_potencia_hp: number | null
          motor_potencia_kw: number | null
          motor_ps: string | null
          motor_tipo: string | null
          nome: string
          numero_casco: string | null
          numero_registo: string | null
          observacoes: string | null
          pontal: number | null
          proprietario_cidade: string | null
          proprietario_codigo_postal: string | null
          proprietario_morada: string | null
          proprietario_nome: string | null
          proprietario_pais: string | null
          radiobaliza: boolean | null
          rx_msi: boolean | null
          tipo_zona: string | null
          updated_at: string | null
          vhf_fixo: boolean | null
          vhf_portatil: boolean | null
        }
        Insert: {
          arqueacao?: number | null
          boca?: number | null
          comprimento?: number | null
          cor_casco?: string | null
          cor_superestrutura?: string | null
          created_at?: string | null
          data_construcao?: number | null
          data_registo?: string | null
          documento_url?: string | null
          fls?: number | null
          id?: string
          livro?: number | null
          lotacao?: number | null
          marca?: string | null
          material_casco?: string | null
          meios_salvacao?: Json | null
          modelo?: string | null
          motor_combustivel?: string | null
          motor_marca?: string | null
          motor_numero?: string | null
          motor_potencia_hp?: number | null
          motor_potencia_kw?: number | null
          motor_ps?: string | null
          motor_tipo?: string | null
          nome: string
          numero_casco?: string | null
          numero_registo?: string | null
          observacoes?: string | null
          pontal?: number | null
          proprietario_cidade?: string | null
          proprietario_codigo_postal?: string | null
          proprietario_morada?: string | null
          proprietario_nome?: string | null
          proprietario_pais?: string | null
          radiobaliza?: boolean | null
          rx_msi?: boolean | null
          tipo_zona?: string | null
          updated_at?: string | null
          vhf_fixo?: boolean | null
          vhf_portatil?: boolean | null
        }
        Update: {
          arqueacao?: number | null
          boca?: number | null
          comprimento?: number | null
          cor_casco?: string | null
          cor_superestrutura?: string | null
          created_at?: string | null
          data_construcao?: number | null
          data_registo?: string | null
          documento_url?: string | null
          fls?: number | null
          id?: string
          livro?: number | null
          lotacao?: number | null
          marca?: string | null
          material_casco?: string | null
          meios_salvacao?: Json | null
          modelo?: string | null
          motor_combustivel?: string | null
          motor_marca?: string | null
          motor_numero?: string | null
          motor_potencia_hp?: number | null
          motor_potencia_kw?: number | null
          motor_ps?: string | null
          motor_tipo?: string | null
          nome?: string
          numero_casco?: string | null
          numero_registo?: string | null
          observacoes?: string | null
          pontal?: number | null
          proprietario_cidade?: string | null
          proprietario_codigo_postal?: string | null
          proprietario_morada?: string | null
          proprietario_nome?: string | null
          proprietario_pais?: string | null
          radiobaliza?: boolean | null
          rx_msi?: boolean | null
          tipo_zona?: string | null
          updated_at?: string | null
          vhf_fixo?: boolean | null
          vhf_portatil?: boolean | null
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
      lead_attachments: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          name: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          name?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          name?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string | null
          codigo_postal: string | null
          concelho: string | null
          consentimento_contacto: boolean | null
          consentimento_webmarketing: boolean | null
          created_at: string
          data: string | null
          data_contacto: string | null
          data_nascimento: string | null
          data_validade_documento: string | null
          distrito: string | null
          documento_identificacao_frente_url: string | null
          documento_identificacao_url: string | null
          documento_identificacao_verso_url: string | null
          email: string | null
          email_empresa: string | null
          empresa: string | null
          estado: string | null
          forma_contacto: string | null
          freguesia: string | null
          full_name: string | null
          genero: string | null
          id: string
          localidade: string | null
          meio_contacto_preferencial: string | null
          morada: string | null
          morada_empresa: string | null
          nacionalidade: string | null
          nif: string | null
          nipc: string | null
          nome: string
          numero_documento: string | null
          observacoes: string | null
          origem: string | null
          pais: string | null
          pais_emissor: string | null
          telefone: string | null
          telefone_empresa: string | null
          telefone_fixo: string | null
          telemovel: string | null
          tem_empresa: boolean | null
          temperatura: string | null
          tipo_documento: string | null
          website_empresa: string | null
          zona: string | null
        }
        Insert: {
          agent_id?: string | null
          codigo_postal?: string | null
          concelho?: string | null
          consentimento_contacto?: boolean | null
          consentimento_webmarketing?: boolean | null
          created_at?: string
          data?: string | null
          data_contacto?: string | null
          data_nascimento?: string | null
          data_validade_documento?: string | null
          distrito?: string | null
          documento_identificacao_frente_url?: string | null
          documento_identificacao_url?: string | null
          documento_identificacao_verso_url?: string | null
          email?: string | null
          email_empresa?: string | null
          empresa?: string | null
          estado?: string | null
          forma_contacto?: string | null
          freguesia?: string | null
          full_name?: string | null
          genero?: string | null
          id?: string
          localidade?: string | null
          meio_contacto_preferencial?: string | null
          morada?: string | null
          morada_empresa?: string | null
          nacionalidade?: string | null
          nif?: string | null
          nipc?: string | null
          nome: string
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          pais?: string | null
          pais_emissor?: string | null
          telefone?: string | null
          telefone_empresa?: string | null
          telefone_fixo?: string | null
          telemovel?: string | null
          tem_empresa?: boolean | null
          temperatura?: string | null
          tipo_documento?: string | null
          website_empresa?: string | null
          zona?: string | null
        }
        Update: {
          agent_id?: string | null
          codigo_postal?: string | null
          concelho?: string | null
          consentimento_contacto?: boolean | null
          consentimento_webmarketing?: boolean | null
          created_at?: string
          data?: string | null
          data_contacto?: string | null
          data_nascimento?: string | null
          data_validade_documento?: string | null
          distrito?: string | null
          documento_identificacao_frente_url?: string | null
          documento_identificacao_url?: string | null
          documento_identificacao_verso_url?: string | null
          email?: string | null
          email_empresa?: string | null
          empresa?: string | null
          estado?: string | null
          forma_contacto?: string | null
          freguesia?: string | null
          full_name?: string | null
          genero?: string | null
          id?: string
          localidade?: string | null
          meio_contacto_preferencial?: string | null
          morada?: string | null
          morada_empresa?: string | null
          nacionalidade?: string | null
          nif?: string | null
          nipc?: string | null
          nome?: string
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          pais?: string | null
          pais_emissor?: string | null
          telefone?: string | null
          telefone_empresa?: string | null
          telefone_fixo?: string | null
          telemovel?: string | null
          tem_empresa?: boolean | null
          temperatura?: string | null
          tipo_documento?: string | null
          website_empresa?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
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
          body_html: string | null
          cc: string[] | null
          delivery_status: string | null
          error_message: string | null
          events: Json | null
          id: string
          last_event: string | null
          metadata: Json | null
          parent_email_id: string | null
          proc_subtask_id: string | null
          proc_task_id: string | null
          provider_id: string | null
          recipient_email: string
          resend_email_id: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          cc?: string[] | null
          delivery_status?: string | null
          error_message?: string | null
          events?: Json | null
          id?: string
          last_event?: string | null
          metadata?: Json | null
          parent_email_id?: string | null
          proc_subtask_id?: string | null
          proc_task_id?: string | null
          provider_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          cc?: string[] | null
          delivery_status?: string | null
          error_message?: string | null
          events?: Json | null
          id?: string
          last_event?: string | null
          metadata?: Json | null
          parent_email_id?: string | null
          proc_subtask_id?: string | null
          proc_task_id?: string | null
          provider_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_emails_parent_email_id_fkey"
            columns: ["parent_email_id"]
            isOneToOne: false
            referencedRelation: "log_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_emails_proc_subtask_id_fkey"
            columns: ["proc_subtask_id"]
            isOneToOne: false
            referencedRelation: "proc_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_emails_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_catalog: {
        Row: {
          category: string
          created_at: string
          description: string
          estimated_delivery_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          requires_property: boolean
          requires_scheduling: boolean
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          estimated_delivery_days?: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          requires_property?: boolean
          requires_scheduling?: boolean
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          estimated_delivery_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          requires_property?: boolean
          requires_scheduling?: boolean
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_order_deliverables: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          order_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          order_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_order_deliverables_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_order_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          name: string
          order_id: string
          pack_id: string | null
          price: number
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          name: string
          order_id: string
          pack_id?: string | null
          price: number
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          name?: string
          order_id?: string
          pack_id?: string | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "marketing_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_order_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "marketing_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_orders: {
        Row: {
          access_instructions: string | null
          address: string | null
          agent_id: string
          alternative_date: string | null
          alternative_time: string | null
          area_m2: number | null
          assigned_to: string | null
          calendar_event_id: string | null
          cancellation_reason: string | null
          city: string | null
          confirmed_date: string | null
          confirmed_time: string | null
          contact_is_agent: boolean | null
          contact_name: string | null
          contact_observations: string | null
          contact_phone: string | null
          contact_relationship: string | null
          created_at: string
          floor_door: string | null
          has_exteriors: boolean | null
          has_facades: boolean | null
          id: string
          internal_notes: string | null
          is_occupied: boolean | null
          is_staged: boolean | null
          number_of_divisions: number | null
          parish: string | null
          parking_available: boolean | null
          postal_code: string | null
          preferred_date: string | null
          preferred_time: string | null
          property_id: string | null
          property_type: string | null
          rejection_reason: string | null
          status: string
          total_amount: number
          typology: string | null
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          address?: string | null
          agent_id: string
          alternative_date?: string | null
          alternative_time?: string | null
          area_m2?: number | null
          assigned_to?: string | null
          calendar_event_id?: string | null
          cancellation_reason?: string | null
          city?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          contact_is_agent?: boolean | null
          contact_name?: string | null
          contact_observations?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          created_at?: string
          floor_door?: string | null
          has_exteriors?: boolean | null
          has_facades?: boolean | null
          id?: string
          internal_notes?: string | null
          is_occupied?: boolean | null
          is_staged?: boolean | null
          number_of_divisions?: number | null
          parish?: string | null
          parking_available?: boolean | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          property_type?: string | null
          rejection_reason?: string | null
          status?: string
          total_amount: number
          typology?: string | null
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          address?: string | null
          agent_id?: string
          alternative_date?: string | null
          alternative_time?: string | null
          area_m2?: number | null
          assigned_to?: string | null
          calendar_event_id?: string | null
          cancellation_reason?: string | null
          city?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          contact_is_agent?: boolean | null
          contact_name?: string | null
          contact_observations?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          created_at?: string
          floor_door?: string | null
          has_exteriors?: boolean | null
          has_facades?: boolean | null
          id?: string
          internal_notes?: string | null
          is_occupied?: boolean | null
          is_staged?: boolean | null
          number_of_divisions?: number | null
          parish?: string | null
          parking_available?: boolean | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          property_type?: string | null
          rejection_reason?: string | null
          status?: string
          total_amount?: number
          typology?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_pack_items: {
        Row: {
          catalog_item_id: string
          id: string
          pack_id: string
        }
        Insert: {
          catalog_item_id: string
          id?: string
          pack_id: string
        }
        Update: {
          catalog_item_id?: string
          id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_pack_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "marketing_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "marketing_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_packs: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          price: number
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      negocios: {
        Row: {
          aceita_animais: boolean | null
          area_m2: number | null
          area_min_m2: number | null
          capital_proprio: number | null
          casas_banho: number | null
          caucao_rendas: number | null
          classe_imovel: string | null
          concelho: string | null
          created_at: string | null
          credito_pre_aprovado: boolean | null
          distrito: string | null
          duracao_minima_contrato: string | null
          estado: string | null
          estado_imovel: string | null
          estado_imovel_venda: string | null
          financiamento_necessario: boolean | null
          freguesia: string | null
          id: string
          lead_id: string
          localizacao: string | null
          localizacao_venda: string | null
          mobilado: boolean | null
          motivacao_compra: string | null
          num_wc: number | null
          observacoes: string | null
          orcamento: number | null
          orcamento_max: number | null
          prazo_compra: string | null
          preco_venda: number | null
          quartos: number | null
          quartos_min: number | null
          renda_max_mensal: number | null
          renda_pretendida: number | null
          rendimento_mensal: number | null
          situacao_profissional: string | null
          tem_arrumos: boolean | null
          tem_arrumos_venda: boolean | null
          tem_elevador: boolean | null
          tem_elevador_venda: boolean | null
          tem_estacionamento: boolean | null
          tem_estacionamento_venda: boolean | null
          tem_exterior: boolean | null
          tem_exterior_venda: boolean | null
          tem_fiador: boolean | null
          tem_garagem: boolean | null
          tem_garagem_venda: boolean | null
          tem_piscina: boolean | null
          tem_piscina_venda: boolean | null
          tem_porteiro: boolean | null
          tem_porteiro_venda: boolean | null
          tem_varanda: boolean | null
          tem_varanda_venda: boolean | null
          tipo: string
          tipo_imovel: string | null
          tipo_imovel_venda: string | null
          total_divisoes: number | null
          valor_credito: number | null
        }
        Insert: {
          aceita_animais?: boolean | null
          area_m2?: number | null
          area_min_m2?: number | null
          capital_proprio?: number | null
          casas_banho?: number | null
          caucao_rendas?: number | null
          classe_imovel?: string | null
          concelho?: string | null
          created_at?: string | null
          credito_pre_aprovado?: boolean | null
          distrito?: string | null
          duracao_minima_contrato?: string | null
          estado?: string | null
          estado_imovel?: string | null
          estado_imovel_venda?: string | null
          financiamento_necessario?: boolean | null
          freguesia?: string | null
          id?: string
          lead_id: string
          localizacao?: string | null
          localizacao_venda?: string | null
          mobilado?: boolean | null
          motivacao_compra?: string | null
          num_wc?: number | null
          observacoes?: string | null
          orcamento?: number | null
          orcamento_max?: number | null
          prazo_compra?: string | null
          preco_venda?: number | null
          quartos?: number | null
          quartos_min?: number | null
          renda_max_mensal?: number | null
          renda_pretendida?: number | null
          rendimento_mensal?: number | null
          situacao_profissional?: string | null
          tem_arrumos?: boolean | null
          tem_arrumos_venda?: boolean | null
          tem_elevador?: boolean | null
          tem_elevador_venda?: boolean | null
          tem_estacionamento?: boolean | null
          tem_estacionamento_venda?: boolean | null
          tem_exterior?: boolean | null
          tem_exterior_venda?: boolean | null
          tem_fiador?: boolean | null
          tem_garagem?: boolean | null
          tem_garagem_venda?: boolean | null
          tem_piscina?: boolean | null
          tem_piscina_venda?: boolean | null
          tem_porteiro?: boolean | null
          tem_porteiro_venda?: boolean | null
          tem_varanda?: boolean | null
          tem_varanda_venda?: boolean | null
          tipo: string
          tipo_imovel?: string | null
          tipo_imovel_venda?: string | null
          total_divisoes?: number | null
          valor_credito?: number | null
        }
        Update: {
          aceita_animais?: boolean | null
          area_m2?: number | null
          area_min_m2?: number | null
          capital_proprio?: number | null
          casas_banho?: number | null
          caucao_rendas?: number | null
          classe_imovel?: string | null
          concelho?: string | null
          created_at?: string | null
          credito_pre_aprovado?: boolean | null
          distrito?: string | null
          duracao_minima_contrato?: string | null
          estado?: string | null
          estado_imovel?: string | null
          estado_imovel_venda?: string | null
          financiamento_necessario?: boolean | null
          freguesia?: string | null
          id?: string
          lead_id?: string
          localizacao?: string | null
          localizacao_venda?: string | null
          mobilado?: boolean | null
          motivacao_compra?: string | null
          num_wc?: number | null
          observacoes?: string | null
          orcamento?: number | null
          orcamento_max?: number | null
          prazo_compra?: string | null
          preco_venda?: number | null
          quartos?: number | null
          quartos_min?: number | null
          renda_max_mensal?: number | null
          renda_pretendida?: number | null
          rendimento_mensal?: number | null
          situacao_profissional?: string | null
          tem_arrumos?: boolean | null
          tem_arrumos_venda?: boolean | null
          tem_elevador?: boolean | null
          tem_elevador_venda?: boolean | null
          tem_estacionamento?: boolean | null
          tem_estacionamento_venda?: boolean | null
          tem_exterior?: boolean | null
          tem_exterior_venda?: boolean | null
          tem_fiador?: boolean | null
          tem_garagem?: boolean | null
          tem_garagem_venda?: boolean | null
          tem_piscina?: boolean | null
          tem_piscina_venda?: boolean | null
          tem_porteiro?: boolean | null
          tem_porteiro_venda?: boolean | null
          tem_varanda?: boolean | null
          tem_varanda_venda?: boolean | null
          tipo?: string
          tipo_imovel?: string | null
          tipo_imovel_venda?: string | null
          total_divisoes?: number | null
          valor_credito?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string
          body: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_read: boolean
          metadata: Json | null
          notification_type: string
          read_at: string | null
          recipient_id: string
          sender_id: string | null
          title: string
        }
        Insert: {
          action_url: string
          body?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string | null
          title: string
        }
        Update: {
          action_url?: string
          body?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_beneficiaries: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          id_doc_expiry: string | null
          id_doc_issued_by: string | null
          id_doc_number: string | null
          id_doc_type: string | null
          nif: string | null
          owner_id: string
          position: string | null
          share_percentage: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          id_doc_expiry?: string | null
          id_doc_issued_by?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          nif?: string | null
          owner_id: string
          position?: string | null
          share_percentage?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          id_doc_expiry?: string | null
          id_doc_issued_by?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          nif?: string | null
          owner_id?: string
          position?: string | null
          share_percentage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_beneficiaries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_role_types: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          order_index: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          order_index?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          order_index?: number | null
        }
        Relationships: []
      }
      owners: {
        Row: {
          address: string | null
          beneficiaries_json: Json | null
          birth_date: string | null
          cae_code: string | null
          city: string | null
          company_branches: string | null
          company_cert_url: string | null
          company_object: string | null
          country_of_incorporation: string | null
          created_at: string | null
          email: string | null
          funds_origin: string[] | null
          id: string
          id_doc_expiry: string | null
          id_doc_issued_by: string | null
          id_doc_number: string | null
          id_doc_type: string | null
          is_pep: boolean | null
          is_portugal_resident: boolean | null
          last_profession: string | null
          legal_nature: string | null
          legal_rep_id_doc: string | null
          legal_representative_name: string | null
          legal_representative_nif: string | null
          marital_regime: string | null
          marital_status: string | null
          name: string
          nationality: string | null
          naturality: string | null
          nif: string | null
          observations: string | null
          pep_position: string | null
          person_type: string
          phone: string | null
          postal_code: string | null
          profession: string | null
          rcbe_code: string | null
          residence_country: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          beneficiaries_json?: Json | null
          birth_date?: string | null
          cae_code?: string | null
          city?: string | null
          company_branches?: string | null
          company_cert_url?: string | null
          company_object?: string | null
          country_of_incorporation?: string | null
          created_at?: string | null
          email?: string | null
          funds_origin?: string[] | null
          id?: string
          id_doc_expiry?: string | null
          id_doc_issued_by?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          is_pep?: boolean | null
          is_portugal_resident?: boolean | null
          last_profession?: string | null
          legal_nature?: string | null
          legal_rep_id_doc?: string | null
          legal_representative_name?: string | null
          legal_representative_nif?: string | null
          marital_regime?: string | null
          marital_status?: string | null
          name: string
          nationality?: string | null
          naturality?: string | null
          nif?: string | null
          observations?: string | null
          pep_position?: string | null
          person_type: string
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          rcbe_code?: string | null
          residence_country?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          beneficiaries_json?: Json | null
          birth_date?: string | null
          cae_code?: string | null
          city?: string | null
          company_branches?: string | null
          company_cert_url?: string | null
          company_object?: string | null
          country_of_incorporation?: string | null
          created_at?: string | null
          email?: string | null
          funds_origin?: string[] | null
          id?: string
          id_doc_expiry?: string | null
          id_doc_issued_by?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          is_pep?: boolean | null
          is_portugal_resident?: boolean | null
          last_profession?: string | null
          legal_nature?: string | null
          legal_rep_id_doc?: string | null
          legal_representative_name?: string | null
          legal_representative_nif?: string | null
          marital_regime?: string | null
          marital_status?: string | null
          name?: string
          nationality?: string | null
          naturality?: string | null
          nif?: string | null
          observations?: string | null
          pep_position?: string | null
          person_type?: string
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          rcbe_code?: string | null
          residence_country?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proc_alert_log: {
        Row: {
          channel: string
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          proc_instance_id: string
          recipient_address: string | null
          recipient_id: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          proc_instance_id: string
          recipient_address?: string | null
          recipient_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          proc_instance_id?: string
          recipient_address?: string | null
          recipient_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_alert_log_proc_instance_id_fkey"
            columns: ["proc_instance_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_alert_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_chat_attachments: {
        Row: {
          attachment_type: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          message_id: string
          mime_type: string | null
          storage_key: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          message_id: string
          mime_type?: string | null
          storage_key: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          storage_key?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "proc_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          has_attachments: boolean | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          mentions: Json | null
          parent_message_id: string | null
          proc_instance_id: string
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          mentions?: Json | null
          parent_message_id?: string | null
          proc_instance_id: string
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          mentions?: Json | null
          parent_message_id?: string | null
          proc_instance_id?: string
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "proc_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_messages_proc_instance_id_fkey"
            columns: ["proc_instance_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_chat_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "proc_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_chat_read_receipts: {
        Row: {
          last_read_at: string | null
          last_read_message_id: string | null
          proc_instance_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          last_read_message_id?: string | null
          proc_instance_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          last_read_message_id?: string | null
          proc_instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_chat_read_receipts_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "proc_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_read_receipts_proc_instance_id_fkey"
            columns: ["proc_instance_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_instances: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          current_stage_id: string | null
          current_status: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_ref: string | null
          id: string
          last_completed_step: number | null
          negocio_id: string | null
          notes: string | null
          percent_complete: number | null
          process_type: string
          property_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          requested_by: string | null
          returned_at: string | null
          returned_by: string | null
          returned_reason: string | null
          started_at: string | null
          tpl_process_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          current_stage_id?: string | null
          current_status?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_ref?: string | null
          id?: string
          last_completed_step?: number | null
          negocio_id?: string | null
          notes?: string | null
          percent_complete?: number | null
          process_type?: string
          property_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_reason?: string | null
          started_at?: string | null
          tpl_process_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          current_stage_id?: string | null
          current_status?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_ref?: string | null
          id?: string
          last_completed_step?: number | null
          negocio_id?: string | null
          notes?: string | null
          percent_complete?: number | null
          process_type?: string
          property_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_reason?: string | null
          started_at?: string | null
          tpl_process_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_instances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "tpl_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
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
            foreignKeyName: "proc_instances_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_instances_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
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
      proc_subtasks: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          config: Json | null
          created_at: string | null
          dependency_proc_subtask_id: string | null
          dependency_proc_task_id: string | null
          dependency_type: string | null
          due_date: string | null
          id: string
          is_blocked: boolean
          is_completed: boolean | null
          is_mandatory: boolean | null
          order_index: number
          owner_id: string | null
          priority: string
          proc_task_id: string
          started_at: string | null
          title: string
          tpl_subtask_id: string | null
          unblocked_at: string | null
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_proc_subtask_id?: string | null
          dependency_proc_task_id?: string | null
          dependency_type?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          is_completed?: boolean | null
          is_mandatory?: boolean | null
          order_index?: number
          owner_id?: string | null
          priority?: string
          proc_task_id: string
          started_at?: string | null
          title: string
          tpl_subtask_id?: string | null
          unblocked_at?: string | null
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_proc_subtask_id?: string | null
          dependency_proc_task_id?: string | null
          dependency_type?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          is_completed?: boolean | null
          is_mandatory?: boolean | null
          order_index?: number
          owner_id?: string | null
          priority?: string
          proc_task_id?: string
          started_at?: string | null
          title?: string
          tpl_subtask_id?: string | null
          unblocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_subtasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_dependency_proc_subtask_id_fkey"
            columns: ["dependency_proc_subtask_id"]
            isOneToOne: false
            referencedRelation: "proc_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_dependency_proc_task_id_fkey"
            columns: ["dependency_proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_subtasks_tpl_subtask_id_fkey"
            columns: ["tpl_subtask_id"]
            isOneToOne: false
            referencedRelation: "tpl_subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_task_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          proc_task_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          proc_task_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          proc_task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_task_activities_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_task_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          mentions: Json | null
          proc_task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          mentions?: Json | null
          proc_task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          mentions?: Json | null
          proc_task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_task_comments_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_tasks: {
        Row: {
          action_type: string | null
          assigned_role: string | null
          assigned_to: string | null
          bypass_reason: string | null
          bypassed_by: string | null
          completed_at: string | null
          config: Json | null
          created_at: string | null
          dependency_proc_task_id: string | null
          due_date: string | null
          id: string
          is_blocked: boolean
          is_bypassed: boolean | null
          is_mandatory: boolean | null
          order_index: number | null
          owner_id: string | null
          priority: string
          proc_instance_id: string
          stage_name: string | null
          stage_order_index: number | null
          started_at: string | null
          status: string | null
          task_result: Json | null
          title: string
          tpl_task_id: string | null
          unblocked_at: string | null
        }
        Insert: {
          action_type?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          bypass_reason?: string | null
          bypassed_by?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_proc_task_id?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          is_bypassed?: boolean | null
          is_mandatory?: boolean | null
          order_index?: number | null
          owner_id?: string | null
          priority?: string
          proc_instance_id: string
          stage_name?: string | null
          stage_order_index?: number | null
          started_at?: string | null
          status?: string | null
          task_result?: Json | null
          title: string
          tpl_task_id?: string | null
          unblocked_at?: string | null
        }
        Update: {
          action_type?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          bypass_reason?: string | null
          bypassed_by?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_proc_task_id?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          is_bypassed?: boolean | null
          is_mandatory?: boolean | null
          order_index?: number | null
          owner_id?: string | null
          priority?: string
          proc_instance_id?: string
          stage_name?: string | null
          stage_order_index?: number | null
          started_at?: string | null
          status?: string | null
          task_result?: Json | null
          title?: string
          tpl_task_id?: string | null
          unblocked_at?: string | null
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
            foreignKeyName: "proc_tasks_dependency_proc_task_id_fkey"
            columns: ["dependency_proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
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
          owner_role_id: string
          ownership_percentage: number | null
          property_id: string
        }
        Insert: {
          is_main_contact?: boolean | null
          owner_id: string
          owner_role_id: string
          ownership_percentage?: number | null
          property_id: string
        }
        Update: {
          is_main_contact?: boolean | null
          owner_id?: string
          owner_role_id?: string
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
            foreignKeyName: "property_owners_owner_role_id_fkey"
            columns: ["owner_role_id"]
            isOneToOne: false
            referencedRelation: "owner_role_types"
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
      ref_counters: {
        Row: {
          counter: number
          prefix: string
          year: number
        }
        Insert: {
          counter?: number
          prefix: string
          year: number
        }
        Update: {
          counter?: number
          prefix?: string
          year?: number
        }
        Relationships: []
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
          letterhead_file_name: string | null
          letterhead_file_type: string | null
          letterhead_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          content_html: string
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          id?: string
          letterhead_file_name?: string | null
          letterhead_file_type?: string | null
          letterhead_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          id?: string
          letterhead_file_name?: string | null
          letterhead_file_type?: string | null
          letterhead_url?: string | null
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
          created_by: string | null
          description: string | null
          editor_state: Json | null
          id: string
          name: string
          subject: string
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          body_html: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          editor_state?: Json | null
          id?: string
          name: string
          subject: string
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          body_html?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          editor_state?: Json | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tpl_email_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_form_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sections: Json
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sections?: Json
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sections?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpl_form_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_processes: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          process_type: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          process_type?: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          process_type?: string
        }
        Relationships: []
      }
      tpl_stages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_index: number
          tpl_process_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_index: number
          tpl_process_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
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
      tpl_subtasks: {
        Row: {
          assigned_role: string | null
          config: Json | null
          created_at: string | null
          dependency_subtask_id: string | null
          dependency_task_id: string | null
          dependency_type: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          order_index: number
          priority: string
          sla_days: number | null
          title: string
          tpl_task_id: string
        }
        Insert: {
          assigned_role?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_subtask_id?: string | null
          dependency_task_id?: string | null
          dependency_type?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number
          priority?: string
          sla_days?: number | null
          title: string
          tpl_task_id: string
        }
        Update: {
          assigned_role?: string | null
          config?: Json | null
          created_at?: string | null
          dependency_subtask_id?: string | null
          dependency_task_id?: string | null
          dependency_type?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number
          priority?: string
          sla_days?: number | null
          title?: string
          tpl_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tpl_subtasks_dependency_subtask_id_fkey"
            columns: ["dependency_subtask_id"]
            isOneToOne: false
            referencedRelation: "tpl_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpl_subtasks_dependency_task_id_fkey"
            columns: ["dependency_task_id"]
            isOneToOne: false
            referencedRelation: "tpl_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpl_subtasks_tpl_task_id_fkey"
            columns: ["tpl_task_id"]
            isOneToOne: false
            referencedRelation: "tpl_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_tasks: {
        Row: {
          action_type: string
          assigned_role: string | null
          config: Json | null
          dependency_task_id: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          order_index: number
          priority: string
          sla_days: number | null
          title: string
          tpl_stage_id: string | null
        }
        Insert: {
          action_type: string
          assigned_role?: string | null
          config?: Json | null
          dependency_task_id?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index: number
          priority?: string
          sla_days?: number | null
          title: string
          tpl_stage_id?: string | null
        }
        Update: {
          action_type?: string
          assigned_role?: string | null
          config?: Json | null
          dependency_task_id?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          order_index?: number
          priority?: string
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
      tpl_variables: {
        Row: {
          category: string
          category_color: string | null
          created_at: string | null
          format_config: Json | null
          format_type: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          label: string
          order_index: number
          source_column: string | null
          source_entity: string
          source_table: string | null
          static_value: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          category_color?: string | null
          created_at?: string | null
          format_config?: Json | null
          format_type?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          label: string
          order_index?: number
          source_column?: string | null
          source_entity: string
          source_table?: string | null
          static_value?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          category_color?: string | null
          created_at?: string | null
          format_config?: Json | null
          format_type?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          label?: string
          order_index?: number
          source_column?: string | null
          source_entity?: string
          source_table?: string | null
          static_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_contracts: {
        Row: {
          created_at: string | null
          file_url: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          genero: string | null
          green_receipt: boolean | null
          hire_date: string | null
          iban: string | null
          id: string
          identity_card: string | null
          identity_card_url: string | null
          identity_card_validity: string | null
          instagram_handle: string | null
          is_active: boolean | null
          languages: string[] | null
          license_number: string | null
          linkedin_url: string | null
          monthly_salary: number | null
          nationality: string | null
          nif: string | null
          pais_emissor: string | null
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
          tipo_documento: string | null
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
          genero?: string | null
          green_receipt?: boolean | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          identity_card?: string | null
          identity_card_url?: string | null
          identity_card_validity?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          license_number?: string | null
          linkedin_url?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          pais_emissor?: string | null
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
          tipo_documento?: string | null
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
          genero?: string | null
          green_receipt?: boolean | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          identity_card?: string | null
          identity_card_url?: string | null
          identity_card_validity?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          license_number?: string | null
          linkedin_url?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          pais_emissor?: string | null
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
          tipo_documento?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _populate_subtasks: {
        Args: {
          p_parent_owner_id: string
          p_proc_task_id: string
          p_property_id: string
          p_tpl_task_id: string
        }
        Returns: undefined
      }
      auto_claim_steps: {
        Args: { batch_size?: number }
        Returns: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          flow_id: string
          id: string
          input_data: Json | null
          max_retries: number | null
          node_id: string
          node_label: string | null
          node_type: string
          output_data: Json | null
          priority: number | null
          retry_count: number | null
          run_id: string
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["auto_step_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "auto_step_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      auto_get_table_columns: {
        Args: { p_table: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      auto_reset_stuck_steps: { Args: never; Returns: number }
      auto_update_run_counts: { Args: { p_run_id: string }; Returns: undefined }
      check_overdue_and_unblock_alerts: { Args: never; Returns: undefined }
      populate_process_tasks: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      recalculate_process_progress: {
        Args: { p_proc_instance_id: string }
        Returns: undefined
      }
      resolve_process_dependencies: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      auto_channel_type: "whatsapp" | "email" | "notification"
      auto_delivery_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      auto_run_status:
        | "pending"
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "timed_out"
      auto_step_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
        | "cancelled"
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
    Enums: {
      auto_channel_type: ["whatsapp", "email", "notification"],
      auto_delivery_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      auto_run_status: [
        "pending",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        "timed_out",
      ],
      auto_step_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "skipped",
        "cancelled",
      ],
    },
  },
} as const
