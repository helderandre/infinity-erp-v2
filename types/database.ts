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
      _debug_wpp_payloads: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          instance_id: string | null
          payload: Json | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload?: Json | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      acessos_custom_sites: {
        Row: {
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_system: boolean
          owner_id: string | null
          scope: string
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          owner_id?: string | null
          scope: string
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          owner_id?: string | null
          scope?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "acessos_custom_sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessos_custom_sites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_materials: {
        Row: {
          agent_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          page_index: number
          template_id: string
          thumbnail_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          page_index?: number
          template_id: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          page_index?: number
          template_id?: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_materials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_materials_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_kit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_personal_designs: {
        Row: {
          agent_id: string
          canva_url: string | null
          category_id: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          sort_order: number
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          canva_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          sort_order?: number
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          canva_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          sort_order?: number
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_personal_designs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_personal_designs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketing_design_categories"
            referencedColumns: ["id"]
          },
        ]
      }
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
      auto_scheduler_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number
          error_detail: string | null
          evaluated_count: number
          id: string
          phase: string | null
          skipped_breakdown: Json | null
          skipped_count: number
          spawned_count: number
          tick_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_detail?: string | null
          evaluated_count?: number
          id?: string
          phase?: string | null
          skipped_breakdown?: Json | null
          skipped_count?: number
          spawned_count?: number
          tick_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_detail?: string | null
          evaluated_count?: number
          id?: string
          phase?: string | null
          skipped_breakdown?: Json | null
          skipped_count?: number
          spawned_count?: number
          tick_at?: string
        }
        Relationships: []
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
          node_data_snapshot: Json | null
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
          node_data_snapshot?: Json | null
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
          node_data_snapshot?: Json | null
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
          is_default: boolean
          name: string
          phone: string | null
          profile_name: string | null
          profile_pic_url: string | null
          status: string
          uazapi_instance_id: string | null
          uazapi_token: string
          updated_at: string | null
          user_id: string | null
          webhook_events: string[] | null
          webhook_registered_at: string | null
          webhook_url: string | null
        }
        Insert: {
          connection_status?: string
          created_at?: string | null
          id?: string
          is_business?: boolean | null
          is_default?: boolean
          name: string
          phone?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          status?: string
          uazapi_instance_id?: string | null
          uazapi_token: string
          updated_at?: string | null
          user_id?: string | null
          webhook_events?: string[] | null
          webhook_registered_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string | null
          id?: string
          is_business?: boolean | null
          is_default?: boolean
          name?: string
          phone?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          status?: string
          uazapi_instance_id?: string | null
          uazapi_token?: string
          updated_at?: string | null
          user_id?: string | null
          webhook_events?: string[] | null
          webhook_registered_at?: string | null
          webhook_url?: string | null
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
          is_system: boolean
          messages: Json
          name: string
          scope: string
          scope_id: string | null
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
          is_system?: boolean
          messages?: Json
          name: string
          scope?: string
          scope_id?: string | null
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
          is_system?: boolean
          messages?: Json
          name?: string
          scope?: string
          scope_id?: string | null
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
          {
            foreignKeyName: "auto_wpp_templates_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_attendees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_rsvp: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reason: string | null
          responded_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reason?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reason?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_rsvp_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_rsvp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          category: string
          color: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_recurring: boolean
          item_type: string
          lead_id: string | null
          links: Json | null
          livestream_url: string | null
          location: string | null
          owner_ids: string[] | null
          proc_subtask_id: string | null
          process_id: string | null
          property_id: string | null
          recurrence_rule: string | null
          registration_url: string | null
          reminders: Json | null
          requires_rsvp: boolean
          start_date: string
          title: string
          updated_at: string
          user_id: string | null
          visibility: string
          visibility_mode: string
          visibility_role_names: string[] | null
          visibility_user_ids: string[] | null
          wpp_message_id: string | null
        }
        Insert: {
          all_day?: boolean
          category?: string
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          item_type?: string
          lead_id?: string | null
          links?: Json | null
          livestream_url?: string | null
          location?: string | null
          owner_ids?: string[] | null
          proc_subtask_id?: string | null
          process_id?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          registration_url?: string | null
          reminders?: Json | null
          requires_rsvp?: boolean
          start_date: string
          title: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
          visibility_mode?: string
          visibility_role_names?: string[] | null
          visibility_user_ids?: string[] | null
          wpp_message_id?: string | null
        }
        Update: {
          all_day?: boolean
          category?: string
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          item_type?: string
          lead_id?: string | null
          links?: Json | null
          livestream_url?: string | null
          location?: string | null
          owner_ids?: string[] | null
          proc_subtask_id?: string | null
          process_id?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          registration_url?: string | null
          reminders?: Json | null
          requires_rsvp?: boolean
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
          visibility_mode?: string
          visibility_role_names?: string[] | null
          visibility_user_ids?: string[] | null
          wpp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_proc_subtask_id_fkey"
            columns: ["proc_subtask_id"]
            isOneToOne: false
            referencedRelation: "proc_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          order_index: number | null
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          order_index?: number | null
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          order_index?: number | null
          type?: string
        }
        Relationships: []
      }
      company_document_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_document_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          category: string
          category_id: string | null
          created_at: string
          description: string | null
          download_count: number
          file_extension: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          name: string
          sort_order: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_extension?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_extension?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_recurring_templates: {
        Row: {
          amount_net: number
          category: string
          created_at: string | null
          day_of_month: number | null
          description: string | null
          entity_name: string | null
          entity_nif: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_generated_at: string | null
          name: string
          subcategory: string | null
          updated_at: string | null
          vat_pct: number | null
        }
        Insert: {
          amount_net: number
          category: string
          created_at?: string | null
          day_of_month?: number | null
          description?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          name: string
          subcategory?: string | null
          updated_at?: string | null
          vat_pct?: number | null
        }
        Update: {
          amount_net?: number
          category?: string
          created_at?: string | null
          day_of_month?: number | null
          description?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          name?: string
          subcategory?: string | null
          updated_at?: string | null
          vat_pct?: number | null
        }
        Relationships: []
      }
      company_transaction_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_transaction_audit_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "company_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transaction_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_transactions: {
        Row: {
          ai_confidence: number | null
          ai_extracted: boolean | null
          amount_gross: number | null
          amount_net: number
          category: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          due_date: string | null
          entity_name: string | null
          entity_nif: string | null
          field_confidences: Json | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          is_recurring: boolean | null
          notes: string | null
          partner_id: string | null
          payment_date: string | null
          payment_method: string | null
          receipt_file_name: string | null
          receipt_url: string | null
          recurring_template_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          subcategory: string | null
          type: string
          updated_at: string | null
          vat_amount: number | null
          vat_pct: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted?: boolean | null
          amount_gross?: number | null
          amount_net: number
          category: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          due_date?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          field_confidences?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_recurring?: boolean | null
          notes?: string | null
          partner_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          recurring_template_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          subcategory?: string | null
          type: string
          updated_at?: string | null
          vat_amount?: number | null
          vat_pct?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted?: boolean | null
          amount_gross?: number | null
          amount_net?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          due_date?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          field_confidences?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_recurring?: boolean | null
          notes?: string | null
          partner_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          recurring_template_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          subcategory?: string | null
          type?: string
          updated_at?: string | null
          vat_amount?: number | null
          vat_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "temp_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "company_recurring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          display_name: string | null
          followers_count: number | null
          id: string
          last_synced_at: string | null
          media_count: number | null
          profile_pic_url: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          id?: string
          last_synced_at?: string | null
          media_count?: number | null
          profile_pic_url?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          id?: string
          last_synced_at?: string | null
          media_count?: number | null
          profile_pic_url?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      consultant_availability_rules: {
        Row: {
          active: boolean
          consultant_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          consultant_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          consultant_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_availability_rules_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_booking_settings: {
        Row: {
          advance_days: number
          buffer_minutes: number
          consultant_id: string
          created_at: string
          min_notice_hours: number
          public_booking_enabled: boolean
          slot_duration_minutes: number
          updated_at: string
        }
        Insert: {
          advance_days?: number
          buffer_minutes?: number
          consultant_id: string
          created_at?: string
          min_notice_hours?: number
          public_booking_enabled?: boolean
          slot_duration_minutes?: number
          updated_at?: string
        }
        Update: {
          advance_days?: number
          buffer_minutes?: number
          consultant_id?: string
          created_at?: string
          min_notice_hours?: number
          public_booking_enabled?: boolean
          slot_duration_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_booking_settings_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_booking_windows: {
        Row: {
          active: boolean
          consultant_id: string
          created_at: string
          end_date: string
          id: string
          note: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          consultant_id: string
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          consultant_id?: string
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_booking_windows_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_date_overrides: {
        Row: {
          blocked: boolean
          consultant_id: string
          created_at: string
          end_time: string | null
          id: string
          note: string | null
          override_date: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          consultant_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          override_date: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          consultant_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          override_date?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_date_overrides_consultant_id_fkey"
            columns: ["consultant_id"]
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
      consultant_email_accounts: {
        Row: {
          consultant_id: string
          created_at: string
          display_name: string
          email_address: string
          encrypted_password: string
          id: string
          imap_host: string
          imap_port: number
          imap_secure: boolean
          is_active: boolean
          is_default: boolean
          is_verified: boolean
          last_error: string | null
          last_sync_at: string | null
          smtp_host: string
          smtp_port: number
          smtp_secure: boolean
          updated_at: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          display_name: string
          email_address: string
          encrypted_password: string
          id?: string
          imap_host?: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          is_default?: boolean
          is_verified?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          display_name?: string
          email_address?: string
          encrypted_password?: string
          id?: string
          imap_host?: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          is_default?: boolean
          is_verified?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_email_accounts_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_payout_lines: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          line_type: string
          payout_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          line_type: string
          payout_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          line_type?: string
          payout_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_payout_lines_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "consultant_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_payout_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "conta_corrente_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_payouts: {
        Row: {
          agent_id: string
          consultant_invoice_date: string | null
          consultant_invoice_number: string | null
          consultant_invoice_type: string | null
          consultant_invoice_url: string | null
          created_at: string | null
          created_by: string | null
          gross_commission: number
          id: string
          net_amount: number
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          payment_method: string | null
          payment_reference: string | null
          reference: string | null
          status: string
          total_deductions: number
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_type?: string | null
          consultant_invoice_url?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_commission?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          reference?: string | null
          status?: string
          total_deductions?: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_type?: string | null
          consultant_invoice_url?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_commission?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          reference?: string | null
          status?: string
          total_deductions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_payouts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_template_defaults: {
        Row: {
          category: string
          channel: string
          consultant_id: string
          created_at: string
          id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          category: string
          channel: string
          consultant_id: string
          created_at?: string
          id?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          channel?: string
          consultant_id?: string
          created_at?: string
          id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_template_defaults_consultant_id_fkey"
            columns: ["consultant_id"]
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
          payout_id: string | null
          reference_id: string | null
          reference_type: string | null
          settled_at: string | null
          settlement_status: string
          type: string
          updated_at: string | null
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
          payout_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          settled_at?: string | null
          settlement_status?: string
          type: string
          updated_at?: string | null
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
          payout_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          settled_at?: string | null
          settlement_status?: string
          type?: string
          updated_at?: string | null
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
          {
            foreignKeyName: "conta_corrente_transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "consultant_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_automation_lead_settings: {
        Row: {
          created_at: string
          email_template_id: string | null
          event_type: string
          id: string
          lead_id: string
          send_hour: number | null
          smtp_account_id: string | null
          updated_at: string
          wpp_instance_id: string | null
          wpp_template_id: string | null
        }
        Insert: {
          created_at?: string
          email_template_id?: string | null
          event_type: string
          id?: string
          lead_id: string
          send_hour?: number | null
          smtp_account_id?: string | null
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Update: {
          created_at?: string
          email_template_id?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          send_hour?: number | null
          smtp_account_id?: string | null
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_automation_lead_settings_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "tpl_email_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_lead_settings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_lead_settings_smtp_account_id_fkey"
            columns: ["smtp_account_id"]
            isOneToOne: false
            referencedRelation: "consultant_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_lead_settings_wpp_instance_id_fkey"
            columns: ["wpp_instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_lead_settings_wpp_template_id_fkey"
            columns: ["wpp_template_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_automation_mutes: {
        Row: {
          channel: string | null
          consultant_id: string | null
          event_type: string | null
          id: string
          lead_id: string | null
          muted_at: string
          muted_by: string
        }
        Insert: {
          channel?: string | null
          consultant_id?: string | null
          event_type?: string | null
          id?: string
          lead_id?: string | null
          muted_at?: string
          muted_by: string
        }
        Update: {
          channel?: string | null
          consultant_id?: string | null
          event_type?: string | null
          id?: string
          lead_id?: string | null
          muted_at?: string
          muted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_automation_mutes_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_mutes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_mutes_muted_by_fkey"
            columns: ["muted_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_automation_runs: {
        Row: {
          auto_run_id: string | null
          contact_automation_id: string | null
          created_at: string
          custom_event_id: string | null
          delivery_log_ids: string[]
          error: string | null
          event_type: string | null
          id: string
          kind: string
          lead_id: string | null
          parent_run_id: string | null
          scheduled_for: string
          sent_at: string | null
          skip_reason: string | null
          status: string
        }
        Insert: {
          auto_run_id?: string | null
          contact_automation_id?: string | null
          created_at?: string
          custom_event_id?: string | null
          delivery_log_ids?: string[]
          error?: string | null
          event_type?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          parent_run_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
        }
        Update: {
          auto_run_id?: string | null
          contact_automation_id?: string | null
          created_at?: string
          custom_event_id?: string | null
          delivery_log_ids?: string[]
          error?: string | null
          event_type?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          parent_run_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_automation_runs_auto_run_id_fkey"
            columns: ["auto_run_id"]
            isOneToOne: false
            referencedRelation: "auto_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_runs_contact_automation_id_fkey"
            columns: ["contact_automation_id"]
            isOneToOne: false
            referencedRelation: "contact_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_runs_custom_event_id_fkey"
            columns: ["custom_event_id"]
            isOneToOne: false
            referencedRelation: "custom_commemorative_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automation_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "contact_automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_automations: {
        Row: {
          channels: string[]
          contact_id: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          email_template_id: string | null
          event_config: Json
          event_type: string
          id: string
          recurrence: string
          send_hour: number
          smtp_account_id: string | null
          status: string
          template_overrides: Json
          timezone: string
          trigger_at: string
          updated_at: string
          wpp_instance_id: string | null
          wpp_template_id: string | null
        }
        Insert: {
          channels: string[]
          contact_id: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          email_template_id?: string | null
          event_config?: Json
          event_type: string
          id?: string
          recurrence: string
          send_hour?: number
          smtp_account_id?: string | null
          status?: string
          template_overrides?: Json
          timezone?: string
          trigger_at: string
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Update: {
          channels?: string[]
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          email_template_id?: string | null
          event_config?: Json
          event_type?: string
          id?: string
          recurrence?: string
          send_hour?: number
          smtp_account_id?: string | null
          status?: string
          template_overrides?: Json
          timezone?: string
          trigger_at?: string
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_automations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "tpl_email_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_smtp_account_id_fkey"
            columns: ["smtp_account_id"]
            isOneToOne: false
            referencedRelation: "consultant_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_wpp_instance_id_fkey"
            columns: ["wpp_instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_automations_wpp_template_id_fkey"
            columns: ["wpp_template_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_templates"
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
      crm_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_commemorative_events: {
        Row: {
          channels: string[]
          consultant_id: string
          created_at: string
          description: string | null
          email_template_id: string | null
          event_date: string
          id: string
          is_recurring: boolean
          last_triggered_year: number | null
          name: string
          send_hour: number
          smtp_account_id: string | null
          status: string
          updated_at: string
          wpp_instance_id: string | null
          wpp_template_id: string | null
        }
        Insert: {
          channels?: string[]
          consultant_id: string
          created_at?: string
          description?: string | null
          email_template_id?: string | null
          event_date: string
          id?: string
          is_recurring?: boolean
          last_triggered_year?: number | null
          name: string
          send_hour?: number
          smtp_account_id?: string | null
          status?: string
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Update: {
          channels?: string[]
          consultant_id?: string
          created_at?: string
          description?: string | null
          email_template_id?: string | null
          event_date?: string
          id?: string
          is_recurring?: boolean
          last_triggered_year?: number | null
          name?: string
          send_hour?: number
          smtp_account_id?: string | null
          status?: string
          updated_at?: string
          wpp_instance_id?: string | null
          wpp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_commemorative_events_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_commemorative_events_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "tpl_email_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_commemorative_events_smtp_account_id_fkey"
            columns: ["smtp_account_id"]
            isOneToOne: false
            referencedRelation: "consultant_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_commemorative_events_wpp_template_id_fkey"
            columns: ["wpp_template_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_event_leads: {
        Row: {
          added_at: string
          event_id: string
          lead_id: string
        }
        Insert: {
          added_at?: string
          event_id: string
          lead_id: string
        }
        Update: {
          added_at?: string
          event_id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_event_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "custom_commemorative_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_event_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_clients: {
        Row: {
          created_at: string | null
          deal_id: string
          email: string | null
          id: string
          name: string
          order_index: number | null
          person_type: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          email?: string | null
          id?: string
          name: string
          order_index?: number | null
          person_type?: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          email?: string | null
          id?: string
          name?: string
          order_index?: number | null
          person_type?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_clients_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_compliance: {
        Row: {
          buyer_address: string | null
          buyer_address_proof_url: string | null
          buyer_cc_number: string | null
          buyer_docs_complete: boolean | null
          buyer_funds_declared: boolean | null
          buyer_funds_origin: string | null
          buyer_id_doc_url: string | null
          buyer_name: string | null
          buyer_nationality: string | null
          buyer_nif: string | null
          buyer_pep_check: boolean | null
          buyer_pep_result: string | null
          buyer_risk_level: string | null
          cash_amount: number | null
          created_at: string | null
          deal_id: string
          id: string
          impic_notes: string | null
          impic_quarter: string | null
          impic_reference: string | null
          impic_report_date: string | null
          impic_reported: boolean | null
          overall_risk_level: string | null
          payment_method: string | null
          risk_flags: Json | null
          seller_address: string | null
          seller_address_proof_url: string | null
          seller_beneficial_owner: string | null
          seller_cc_number: string | null
          seller_company_cert_url: string | null
          seller_docs_complete: boolean | null
          seller_id_doc_url: string | null
          seller_is_company: boolean | null
          seller_name: string | null
          seller_nationality: string | null
          seller_nif: string | null
          seller_pep_check: boolean | null
          seller_pep_result: string | null
          seller_risk_level: string | null
          status: string | null
          suspicious_activity_date: string | null
          suspicious_activity_ref: string | null
          suspicious_activity_reported: boolean | null
          updated_at: string | null
        }
        Insert: {
          buyer_address?: string | null
          buyer_address_proof_url?: string | null
          buyer_cc_number?: string | null
          buyer_docs_complete?: boolean | null
          buyer_funds_declared?: boolean | null
          buyer_funds_origin?: string | null
          buyer_id_doc_url?: string | null
          buyer_name?: string | null
          buyer_nationality?: string | null
          buyer_nif?: string | null
          buyer_pep_check?: boolean | null
          buyer_pep_result?: string | null
          buyer_risk_level?: string | null
          cash_amount?: number | null
          created_at?: string | null
          deal_id: string
          id?: string
          impic_notes?: string | null
          impic_quarter?: string | null
          impic_reference?: string | null
          impic_report_date?: string | null
          impic_reported?: boolean | null
          overall_risk_level?: string | null
          payment_method?: string | null
          risk_flags?: Json | null
          seller_address?: string | null
          seller_address_proof_url?: string | null
          seller_beneficial_owner?: string | null
          seller_cc_number?: string | null
          seller_company_cert_url?: string | null
          seller_docs_complete?: boolean | null
          seller_id_doc_url?: string | null
          seller_is_company?: boolean | null
          seller_name?: string | null
          seller_nationality?: string | null
          seller_nif?: string | null
          seller_pep_check?: boolean | null
          seller_pep_result?: string | null
          seller_risk_level?: string | null
          status?: string | null
          suspicious_activity_date?: string | null
          suspicious_activity_ref?: string | null
          suspicious_activity_reported?: boolean | null
          updated_at?: string | null
        }
        Update: {
          buyer_address?: string | null
          buyer_address_proof_url?: string | null
          buyer_cc_number?: string | null
          buyer_docs_complete?: boolean | null
          buyer_funds_declared?: boolean | null
          buyer_funds_origin?: string | null
          buyer_id_doc_url?: string | null
          buyer_name?: string | null
          buyer_nationality?: string | null
          buyer_nif?: string | null
          buyer_pep_check?: boolean | null
          buyer_pep_result?: string | null
          buyer_risk_level?: string | null
          cash_amount?: number | null
          created_at?: string | null
          deal_id?: string
          id?: string
          impic_notes?: string | null
          impic_quarter?: string | null
          impic_reference?: string | null
          impic_report_date?: string | null
          impic_reported?: boolean | null
          overall_risk_level?: string | null
          payment_method?: string | null
          risk_flags?: Json | null
          seller_address?: string | null
          seller_address_proof_url?: string | null
          seller_beneficial_owner?: string | null
          seller_cc_number?: string | null
          seller_company_cert_url?: string | null
          seller_docs_complete?: boolean | null
          seller_id_doc_url?: string | null
          seller_is_company?: boolean | null
          seller_name?: string | null
          seller_nationality?: string | null
          seller_nif?: string | null
          seller_pep_check?: boolean | null
          seller_pep_result?: string | null
          seller_risk_level?: string | null
          status?: string | null
          suspicious_activity_date?: string | null
          suspicious_activity_ref?: string | null
          suspicious_activity_reported?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_compliance_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_payment_splits: {
        Row: {
          agent_id: string
          amount: number
          consultant_invoice_date: string | null
          consultant_invoice_number: string | null
          consultant_invoice_type: string | null
          consultant_paid: boolean | null
          consultant_paid_date: string | null
          created_at: string | null
          deal_payment_id: string
          id: string
          notes: string | null
          role: string
          split_pct: number
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          amount?: number
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_type?: string | null
          consultant_paid?: boolean | null
          consultant_paid_date?: string | null
          created_at?: string | null
          deal_payment_id: string
          id?: string
          notes?: string | null
          role?: string
          split_pct?: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_type?: string | null
          consultant_paid?: boolean | null
          consultant_paid_date?: string | null
          created_at?: string | null
          deal_payment_id?: string
          id?: string
          notes?: string | null
          role?: string
          split_pct?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_payment_splits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_payment_splits_deal_payment_id_fkey"
            columns: ["deal_payment_id"]
            isOneToOne: false
            referencedRelation: "deal_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_payments: {
        Row: {
          agency_amount: number | null
          agency_invoice_amount_gross: number | null
          agency_invoice_amount_net: number | null
          agency_invoice_date: string | null
          agency_invoice_id: string | null
          agency_invoice_number: string | null
          agency_invoice_recipient: string | null
          agency_invoice_recipient_nif: string | null
          amount: number
          consultant_amount: number | null
          consultant_invoice_date: string | null
          consultant_invoice_number: string | null
          consultant_invoice_requested_at: string | null
          consultant_invoice_type: string | null
          consultant_paid: boolean | null
          consultant_paid_date: string | null
          created_at: string | null
          date_type: string
          deal_id: string
          id: string
          is_received: boolean | null
          is_reported: boolean | null
          is_signed: boolean | null
          network_amount: number | null
          network_invoice_date: string | null
          network_invoice_number: string | null
          notes: string | null
          partner_amount: number | null
          payment_moment: string
          payment_pct: number
          proc_task_id: string | null
          received_date: string | null
          reminder_sent_at: string | null
          reported_date: string | null
          signed_date: string | null
          updated_at: string | null
        }
        Insert: {
          agency_amount?: number | null
          agency_invoice_amount_gross?: number | null
          agency_invoice_amount_net?: number | null
          agency_invoice_date?: string | null
          agency_invoice_id?: string | null
          agency_invoice_number?: string | null
          agency_invoice_recipient?: string | null
          agency_invoice_recipient_nif?: string | null
          amount: number
          consultant_amount?: number | null
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_requested_at?: string | null
          consultant_invoice_type?: string | null
          consultant_paid?: boolean | null
          consultant_paid_date?: string | null
          created_at?: string | null
          date_type?: string
          deal_id: string
          id?: string
          is_received?: boolean | null
          is_reported?: boolean | null
          is_signed?: boolean | null
          network_amount?: number | null
          network_invoice_date?: string | null
          network_invoice_number?: string | null
          notes?: string | null
          partner_amount?: number | null
          payment_moment: string
          payment_pct: number
          proc_task_id?: string | null
          received_date?: string | null
          reminder_sent_at?: string | null
          reported_date?: string | null
          signed_date?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_amount?: number | null
          agency_invoice_amount_gross?: number | null
          agency_invoice_amount_net?: number | null
          agency_invoice_date?: string | null
          agency_invoice_id?: string | null
          agency_invoice_number?: string | null
          agency_invoice_recipient?: string | null
          agency_invoice_recipient_nif?: string | null
          amount?: number
          consultant_amount?: number | null
          consultant_invoice_date?: string | null
          consultant_invoice_number?: string | null
          consultant_invoice_requested_at?: string | null
          consultant_invoice_type?: string | null
          consultant_paid?: boolean | null
          consultant_paid_date?: string | null
          created_at?: string | null
          date_type?: string
          deal_id?: string
          id?: string
          is_received?: boolean | null
          is_reported?: boolean | null
          is_signed?: boolean | null
          network_amount?: number | null
          network_invoice_date?: string | null
          network_invoice_number?: string | null
          notes?: string | null
          partner_amount?: number | null
          payment_moment?: string
          payment_pct?: number
          proc_task_id?: string | null
          received_date?: string | null
          reminder_sent_at?: string | null
          reported_date?: string | null
          signed_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_payments_proc_task_id_fkey"
            columns: ["proc_task_id"]
            isOneToOne: false
            referencedRelation: "proc_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_referrals: {
        Row: {
          consultant_id: string | null
          created_at: string | null
          deal_id: string
          external_contact: string | null
          external_name: string | null
          id: string
          is_paid: boolean | null
          paid_date: string | null
          referral_info: string | null
          referral_pct: number
          referral_type: string
          side: string
        }
        Insert: {
          consultant_id?: string | null
          created_at?: string | null
          deal_id: string
          external_contact?: string | null
          external_name?: string | null
          id?: string
          is_paid?: boolean | null
          paid_date?: string | null
          referral_info?: string | null
          referral_pct: number
          referral_type: string
          side: string
        }
        Update: {
          consultant_id?: string | null
          created_at?: string | null
          deal_id?: string
          external_contact?: string | null
          external_name?: string | null
          id?: string
          is_paid?: boolean | null
          paid_date?: string | null
          referral_info?: string | null
          referral_pct?: number
          referral_type?: string
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_referrals_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_referrals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agency_margin: number | null
          agency_net: number | null
          business_type: string | null
          clients_notes: string | null
          commission_pct: number
          commission_total: number
          commission_type: string
          conditions_notes: string | null
          consultant_amount: number | null
          consultant_id: string | null
          consultant_pct: number | null
          contract_signing_date: string | null
          cpcv_pct: number | null
          created_at: string | null
          created_by: string | null
          deal_date: string
          deal_type: string
          deal_value: number
          deposit_value: string | null
          escritura_pct: number | null
          external_consultant_email: string | null
          external_consultant_name: string | null
          external_consultant_phone: string | null
          external_property_construction_year: string | null
          external_property_extra: string | null
          external_property_id: string | null
          external_property_link: string | null
          external_property_type: string | null
          external_property_typology: string | null
          external_property_zone: string | null
          extra_info: string | null
          has_financing: boolean | null
          has_financing_condition: boolean | null
          has_furniture: boolean | null
          has_guarantor: boolean | null
          has_referral: boolean | null
          has_share: boolean | null
          has_signature_recognition: boolean | null
          housing_regime: string | null
          id: string
          internal_colleague_id: string | null
          is_bilingual: boolean | null
          max_deadline: string | null
          negocio_id: string | null
          network_amount: number | null
          network_pct: number | null
          notes: string | null
          partner_agency_name: string | null
          partner_amount: number | null
          partner_contact: string | null
          payment_structure: string
          proc_instance_id: string | null
          property_id: string | null
          proposal_file_name: string | null
          proposal_file_url: string | null
          pv_number: string | null
          reference: string | null
          referral_info: string | null
          referral_pct: number | null
          referral_type: string | null
          share_amount: number | null
          share_network_type: string | null
          share_notes: string | null
          share_pct: number | null
          share_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_margin?: number | null
          agency_net?: number | null
          business_type?: string | null
          clients_notes?: string | null
          commission_pct: number
          commission_total: number
          commission_type?: string
          conditions_notes?: string | null
          consultant_amount?: number | null
          consultant_id?: string | null
          consultant_pct?: number | null
          contract_signing_date?: string | null
          cpcv_pct?: number | null
          created_at?: string | null
          created_by?: string | null
          deal_date: string
          deal_type: string
          deal_value: number
          deposit_value?: string | null
          escritura_pct?: number | null
          external_consultant_email?: string | null
          external_consultant_name?: string | null
          external_consultant_phone?: string | null
          external_property_construction_year?: string | null
          external_property_extra?: string | null
          external_property_id?: string | null
          external_property_link?: string | null
          external_property_type?: string | null
          external_property_typology?: string | null
          external_property_zone?: string | null
          extra_info?: string | null
          has_financing?: boolean | null
          has_financing_condition?: boolean | null
          has_furniture?: boolean | null
          has_guarantor?: boolean | null
          has_referral?: boolean | null
          has_share?: boolean | null
          has_signature_recognition?: boolean | null
          housing_regime?: string | null
          id?: string
          internal_colleague_id?: string | null
          is_bilingual?: boolean | null
          max_deadline?: string | null
          negocio_id?: string | null
          network_amount?: number | null
          network_pct?: number | null
          notes?: string | null
          partner_agency_name?: string | null
          partner_amount?: number | null
          partner_contact?: string | null
          payment_structure?: string
          proc_instance_id?: string | null
          property_id?: string | null
          proposal_file_name?: string | null
          proposal_file_url?: string | null
          pv_number?: string | null
          reference?: string | null
          referral_info?: string | null
          referral_pct?: number | null
          referral_type?: string | null
          share_amount?: number | null
          share_network_type?: string | null
          share_notes?: string | null
          share_pct?: number | null
          share_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_margin?: number | null
          agency_net?: number | null
          business_type?: string | null
          clients_notes?: string | null
          commission_pct?: number
          commission_total?: number
          commission_type?: string
          conditions_notes?: string | null
          consultant_amount?: number | null
          consultant_id?: string | null
          consultant_pct?: number | null
          contract_signing_date?: string | null
          cpcv_pct?: number | null
          created_at?: string | null
          created_by?: string | null
          deal_date?: string
          deal_type?: string
          deal_value?: number
          deposit_value?: string | null
          escritura_pct?: number | null
          external_consultant_email?: string | null
          external_consultant_name?: string | null
          external_consultant_phone?: string | null
          external_property_construction_year?: string | null
          external_property_extra?: string | null
          external_property_id?: string | null
          external_property_link?: string | null
          external_property_type?: string | null
          external_property_typology?: string | null
          external_property_zone?: string | null
          extra_info?: string | null
          has_financing?: boolean | null
          has_financing_condition?: boolean | null
          has_furniture?: boolean | null
          has_guarantor?: boolean | null
          has_referral?: boolean | null
          has_share?: boolean | null
          has_signature_recognition?: boolean | null
          housing_regime?: string | null
          id?: string
          internal_colleague_id?: string | null
          is_bilingual?: boolean | null
          max_deadline?: string | null
          negocio_id?: string | null
          network_amount?: number | null
          network_pct?: number | null
          notes?: string | null
          partner_agency_name?: string | null
          partner_amount?: number | null
          partner_contact?: string | null
          payment_structure?: string
          proc_instance_id?: string | null
          property_id?: string | null
          proposal_file_name?: string | null
          proposal_file_url?: string | null
          pv_number?: string | null
          reference?: string | null
          referral_info?: string | null
          referral_pct?: number | null
          referral_type?: string | null
          share_amount?: number | null
          share_network_type?: string | null
          share_notes?: string | null
          share_pct?: number | null
          share_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_internal_colleague_id_fkey"
            columns: ["internal_colleague_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_proc_instance_id_fkey"
            columns: ["proc_instance_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_consultant_private_data: {
        Row: {
          address_private: string | null
          birth_date: string | null
          city: string | null
          commission_rate: number | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_nipc: string | null
          company_phone: string | null
          company_website: string | null
          concelho: string | null
          contract_end_date: string | null
          contract_file_url: string | null
          contract_start_date: string | null
          contract_type: string | null
          country: string | null
          district: string | null
          documents_json: Json | null
          full_name: string | null
          gender: string | null
          has_company: boolean | null
          hiring_date: string | null
          iban: string | null
          id_doc_expiry: string | null
          id_doc_file_url: string | null
          id_doc_issuer: string | null
          id_doc_number: string | null
          id_doc_type: string | null
          monthly_salary: number | null
          nationality: string | null
          nif: string | null
          postal_code: string | null
          user_id: string
          zone: string | null
        }
        Insert: {
          address_private?: string | null
          birth_date?: string | null
          city?: string | null
          commission_rate?: number | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_nipc?: string | null
          company_phone?: string | null
          company_website?: string | null
          concelho?: string | null
          contract_end_date?: string | null
          contract_file_url?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          country?: string | null
          district?: string | null
          documents_json?: Json | null
          full_name?: string | null
          gender?: string | null
          has_company?: boolean | null
          hiring_date?: string | null
          iban?: string | null
          id_doc_expiry?: string | null
          id_doc_file_url?: string | null
          id_doc_issuer?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          postal_code?: string | null
          user_id: string
          zone?: string | null
        }
        Update: {
          address_private?: string | null
          birth_date?: string | null
          city?: string | null
          commission_rate?: number | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_nipc?: string | null
          company_phone?: string | null
          company_website?: string | null
          concelho?: string | null
          contract_end_date?: string | null
          contract_file_url?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          country?: string | null
          district?: string | null
          documents_json?: Json | null
          full_name?: string | null
          gender?: string | null
          has_company?: boolean | null
          hiring_date?: string | null
          iban?: string | null
          id_doc_expiry?: string | null
          id_doc_file_url?: string | null
          id_doc_issuer?: string | null
          id_doc_number?: string | null
          id_doc_type?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nif?: string | null
          postal_code?: string | null
          user_id?: string
          zone?: string | null
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
          email_signature_goodbye: string | null
          email_signature_html: string | null
          email_signature_url: string | null
          instagram_handle: string | null
          languages: string[] | null
          linkedin_url: string | null
          phone_commercial: string | null
          profile_photo_nobg_url: string | null
          profile_photo_url: string | null
          specializations: string[] | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          email_signature_goodbye?: string | null
          email_signature_html?: string | null
          email_signature_url?: string | null
          instagram_handle?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          phone_commercial?: string | null
          profile_photo_nobg_url?: string | null
          profile_photo_url?: string | null
          specializations?: string[] | null
          user_id: string
        }
        Update: {
          bio?: string | null
          email_signature_goodbye?: string | null
          email_signature_html?: string | null
          email_signature_url?: string | null
          instagram_handle?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          phone_commercial?: string | null
          profile_photo_nobg_url?: string | null
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
          link_portal_idealista: string | null
          link_portal_imovirtual: string | null
          link_portal_infinity: string | null
          link_portal_remax: string | null
          listing_price: number | null
          longitude: number | null
          notas_juridico_convictus: string | null
          postal_code: string | null
          presentation_overrides: Json | null
          property_condition: string | null
          property_type: string | null
          remax_draft_number: string | null
          remax_published_date: string | null
          show_on_website: boolean
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
          link_portal_idealista?: string | null
          link_portal_imovirtual?: string | null
          link_portal_infinity?: string | null
          link_portal_remax?: string | null
          listing_price?: number | null
          longitude?: number | null
          notas_juridico_convictus?: string | null
          postal_code?: string | null
          presentation_overrides?: Json | null
          property_condition?: string | null
          property_type?: string | null
          remax_draft_number?: string | null
          remax_published_date?: string | null
          show_on_website?: boolean
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
          link_portal_idealista?: string | null
          link_portal_imovirtual?: string | null
          link_portal_infinity?: string | null
          link_portal_remax?: string | null
          listing_price?: number | null
          longitude?: number | null
          notas_juridico_convictus?: string | null
          postal_code?: string | null
          presentation_overrides?: Json | null
          property_condition?: string | null
          property_type?: string | null
          remax_draft_number?: string | null
          remax_published_date?: string | null
          show_on_website?: boolean
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
          has_mortgage: boolean | null
          imi_value: number | null
          internal_notes: string | null
          listing_links: Json
          mortgage_owed: number | null
          postal_code: string | null
          property_id: string
          reference_internal: string | null
          use_license_date: string | null
          use_license_issuer: string | null
          use_license_number: string | null
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
          has_mortgage?: boolean | null
          imi_value?: number | null
          internal_notes?: string | null
          listing_links?: Json
          mortgage_owed?: number | null
          postal_code?: string | null
          property_id: string
          reference_internal?: string | null
          use_license_date?: string | null
          use_license_issuer?: string | null
          use_license_number?: string | null
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
          has_mortgage?: boolean | null
          imi_value?: number | null
          internal_notes?: string | null
          listing_links?: Json
          mortgage_owed?: number | null
          postal_code?: string | null
          property_id?: string
          reference_internal?: string | null
          use_license_date?: string | null
          use_license_issuer?: string | null
          use_license_number?: string | null
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
      dev_property_legal_data: {
        Row: {
          artigo_matricial: string | null
          artigo_matricial_tipo: string | null
          codigo_ine_freguesia: string | null
          concelho: string | null
          conservatoria_crp: string | null
          created_at: string
          descricao_ficha: string | null
          descricao_ficha_ano: number | null
          distrito: string | null
          extracted_at: string | null
          extracted_by: string | null
          extracted_from_document_id: string | null
          fracao_autonoma: string | null
          freguesia: string | null
          freguesia_fiscal: string | null
          property_id: string
          quota_parte: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          artigo_matricial?: string | null
          artigo_matricial_tipo?: string | null
          codigo_ine_freguesia?: string | null
          concelho?: string | null
          conservatoria_crp?: string | null
          created_at?: string
          descricao_ficha?: string | null
          descricao_ficha_ano?: number | null
          distrito?: string | null
          extracted_at?: string | null
          extracted_by?: string | null
          extracted_from_document_id?: string | null
          fracao_autonoma?: string | null
          freguesia?: string | null
          freguesia_fiscal?: string | null
          property_id: string
          quota_parte?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          artigo_matricial?: string | null
          artigo_matricial_tipo?: string | null
          codigo_ine_freguesia?: string | null
          concelho?: string | null
          conservatoria_crp?: string | null
          created_at?: string
          descricao_ficha?: string | null
          descricao_ficha_ano?: number | null
          distrito?: string | null
          extracted_at?: string | null
          extracted_by?: string | null
          extracted_from_document_id?: string | null
          fracao_autonoma?: string | null
          freguesia?: string | null
          freguesia_fiscal?: string | null
          property_id?: string
          quota_parte?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_property_legal_data_extracted_by_fkey"
            columns: ["extracted_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_property_legal_data_extracted_from_document_id_fkey"
            columns: ["extracted_from_document_id"]
            isOneToOne: false
            referencedRelation: "doc_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_property_legal_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_property_legal_data_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_property_media: {
        Row: {
          ai_classified_at: string | null
          ai_enhanced_url: string | null
          ai_room_confidence: number | null
          ai_room_label: string | null
          ai_staged_style: string | null
          ai_staged_url: string | null
          id: string
          is_cover: boolean | null
          media_type: string | null
          order_index: number | null
          property_id: string | null
          render_3d_style: string | null
          source_media_id: string | null
          url: string
        }
        Insert: {
          ai_classified_at?: string | null
          ai_enhanced_url?: string | null
          ai_room_confidence?: number | null
          ai_room_label?: string | null
          ai_staged_style?: string | null
          ai_staged_url?: string | null
          id?: string
          is_cover?: boolean | null
          media_type?: string | null
          order_index?: number | null
          property_id?: string | null
          render_3d_style?: string | null
          source_media_id?: string | null
          url: string
        }
        Update: {
          ai_classified_at?: string | null
          ai_enhanced_url?: string | null
          ai_room_confidence?: number | null
          ai_room_label?: string | null
          ai_staged_style?: string | null
          ai_staged_url?: string | null
          id?: string
          is_cover?: boolean | null
          media_type?: string | null
          order_index?: number | null
          property_id?: string | null
          render_3d_style?: string | null
          source_media_id?: string | null
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
          {
            foreignKeyName: "dev_property_media_source_media_id_fkey"
            columns: ["source_media_id"]
            isOneToOne: false
            referencedRelation: "dev_property_media"
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
          active_lead_count: number
          commercial_name: string
          created_at: string | null
          display_website: boolean | null
          id: string
          is_active: boolean | null
          professional_email: string | null
        }
        Insert: {
          active_lead_count?: number
          commercial_name: string
          created_at?: string | null
          display_website?: boolean | null
          id: string
          is_active?: boolean | null
          professional_email?: string | null
        }
        Update: {
          active_lead_count?: number
          commercial_name?: string
          created_at?: string | null
          display_website?: boolean | null
          id?: string
          is_active?: boolean | null
          professional_email?: string | null
        }
        Relationships: []
      }
      doc_pdf_field_mappings: {
        Row: {
          created_at: string | null
          default_value: string | null
          display_label: string | null
          display_order: number | null
          field_options: string[] | null
          field_type: string
          font_size: number | null
          id: string
          is_required: boolean | null
          page_number: number | null
          pdf_field_name: string
          template_id: string
          transform: string | null
          variable_key: string | null
        }
        Insert: {
          created_at?: string | null
          default_value?: string | null
          display_label?: string | null
          display_order?: number | null
          field_options?: string[] | null
          field_type?: string
          font_size?: number | null
          id?: string
          is_required?: boolean | null
          page_number?: number | null
          pdf_field_name: string
          template_id: string
          transform?: string | null
          variable_key?: string | null
        }
        Update: {
          created_at?: string | null
          default_value?: string | null
          display_label?: string | null
          display_order?: number | null
          field_options?: string[] | null
          field_type?: string
          font_size?: number | null
          id?: string
          is_required?: boolean | null
          page_number?: number | null
          pdf_field_name?: string
          template_id?: string
          transform?: string | null
          variable_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_pdf_field_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tpl_doc_library"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_registry: {
        Row: {
          created_at: string | null
          deal_id: string | null
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
          deal_id?: string | null
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
          deal_id?: string | null
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
            foreignKeyName: "doc_registry_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
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
          applies_to: string[]
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
          applies_to?: string[]
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
          applies_to?: string[]
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
      email_attachments: {
        Row: {
          cid: string | null
          content_type: string
          created_at: string
          filename: string
          id: string
          is_inline: boolean | null
          message_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          cid?: string | null
          content_type: string
          created_at?: string
          filename: string
          id?: string
          is_inline?: boolean | null
          message_id: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          cid?: string | null
          content_type?: string
          created_at?: string
          filename?: string
          id?: string
          is_inline?: boolean | null
          message_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          account_id: string
          bcc_addresses: string[] | null
          body_html: string | null
          body_text: string | null
          cc_addresses: string[] | null
          created_at: string
          direction: string
          error_message: string | null
          from_address: string
          from_name: string | null
          has_attachments: boolean | null
          id: string
          imap_folder: string | null
          imap_uid: number | null
          in_reply_to: string | null
          is_flagged: boolean | null
          is_read: boolean | null
          message_id: string | null
          process_id: string | null
          process_type: string | null
          received_at: string | null
          sent_at: string | null
          status: string
          subject: string
          thread_id: string | null
          to_addresses: string[]
        }
        Insert: {
          account_id: string
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction: string
          error_message?: string | null
          from_address: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          imap_folder?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          is_flagged?: boolean | null
          is_read?: boolean | null
          message_id?: string | null
          process_id?: string | null
          process_type?: string | null
          received_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          thread_id?: string | null
          to_addresses: string[]
        }
        Update: {
          account_id?: string
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_address?: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          imap_folder?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          is_flagged?: boolean | null
          is_read?: boolean | null
          message_id?: string | null
          process_id?: string | null
          process_type?: string | null
          received_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          thread_id?: string | null
          to_addresses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "consultant_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "proc_instances"
            referencedColumns: ["id"]
          },
        ]
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
      feedback_submissions: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          priority: number | null
          status: string
          submitted_by: string | null
          tech_notes: string | null
          title: string
          type: string
          updated_at: string
          voice_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          priority?: number | null
          status?: string
          submitted_by?: string | null
          tech_notes?: string | null
          title: string
          type: string
          updated_at?: string
          voice_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          priority?: number | null
          status?: string
          submitted_by?: string | null
          tech_notes?: string | null
          title?: string
          type?: string
          updated_at?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_bookmarks: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_bookmarks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_bookmarks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      forma_training_certificates: {
        Row: {
          certificate_code: string | null
          course_id: string | null
          created_at: string
          enrollment_id: string | null
          expires_at: string | null
          external_file_url: string | null
          external_provider: string | null
          external_title: string | null
          id: string
          is_external: boolean
          is_valid: boolean
          issued_at: string
          pdf_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          certificate_code?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          external_file_url?: string | null
          external_provider?: string | null
          external_title?: string | null
          id?: string
          is_external?: boolean
          is_valid?: boolean
          issued_at?: string
          pdf_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          certificate_code?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          external_file_url?: string | null
          external_provider?: string | null
          external_title?: string | null
          id?: string
          is_external?: boolean
          is_valid?: boolean
          issued_at?: string
          pdf_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "forma_training_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_resolved: boolean
          lesson_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          lesson_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          lesson_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forma_training_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_courses: {
        Row: {
          category_id: string
          certificate_validity_months: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          difficulty_level: string
          estimated_duration_minutes: number | null
          has_certificate: boolean
          id: string
          instructor_id: string | null
          instructor_name: string | null
          is_mandatory: boolean
          mandatory_for_roles: string[] | null
          passing_score: number | null
          prerequisite_course_ids: string[] | null
          published_at: string | null
          slug: string
          status: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          certificate_validity_months?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          difficulty_level?: string
          estimated_duration_minutes?: number | null
          has_certificate?: boolean
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_mandatory?: boolean
          mandatory_for_roles?: string[] | null
          passing_score?: number | null
          prerequisite_course_ids?: string[] | null
          published_at?: string | null
          slug: string
          status?: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          certificate_validity_months?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty_level?: string
          estimated_duration_minutes?: number | null
          has_certificate?: boolean
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_mandatory?: boolean
          mandatory_for_roles?: string[] | null
          passing_score?: number | null
          prerequisite_course_ids?: string[] | null
          published_at?: string | null
          slug?: string
          status?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forma_training_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_enrollments: {
        Row: {
          assigned_by: string | null
          certificate_expires_at: string | null
          certificate_issued: boolean
          certificate_url: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          deadline: string | null
          enrolled_at: string
          id: string
          progress_percent: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          certificate_expires_at?: string | null
          certificate_issued?: boolean
          certificate_url?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          deadline?: string | null
          enrolled_at?: string
          id?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          certificate_expires_at?: string | null
          certificate_issued?: boolean
          certificate_url?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          deadline?: string | null
          enrolled_at?: string
          id?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_enrollments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_learning_path_courses: {
        Row: {
          course_id: string
          id: string
          is_required: boolean
          learning_path_id: string
          order_index: number
        }
        Insert: {
          course_id: string
          id?: string
          is_required?: boolean
          learning_path_id: string
          order_index?: number
        }
        Update: {
          course_id?: string
          id?: string
          is_required?: boolean
          learning_path_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_learning_path_courses_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "forma_training_learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_learning_paths: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          is_mandatory: boolean
          mandatory_for_roles: string[] | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean
          mandatory_for_roles?: string[] | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean
          mandatory_for_roles?: string[] | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_learning_paths_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_lesson_materials: {
        Row: {
          created_at: string
          description: string | null
          file_extension: string | null
          file_mime_type: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          lesson_id: string
          link_title: string | null
          link_url: string | null
          material_type: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_extension?: string | null
          file_mime_type?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          lesson_id: string
          link_title?: string | null
          link_url?: string | null
          material_type: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_extension?: string | null
          file_mime_type?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          lesson_id?: string
          link_title?: string | null
          link_url?: string | null
          material_type?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          last_accessed_at: string | null
          lesson_id: string
          started_at: string | null
          status: string
          time_spent_seconds: number | null
          updated_at: string
          user_id: string
          video_watch_percent: number | null
          video_watched_seconds: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          last_accessed_at?: string | null
          lesson_id: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number | null
          updated_at?: string
          user_id: string
          video_watch_percent?: number | null
          video_watched_seconds?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          last_accessed_at?: string | null
          lesson_id?: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number | null
          updated_at?: string
          user_id?: string
          video_watch_percent?: number | null
          video_watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "forma_training_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_lesson_ratings: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_lesson_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_lesson_reports: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          lesson_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_lesson_reports_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_lesson_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_lesson_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_lessons: {
        Row: {
          content_type: string
          created_at: string
          description: string | null
          estimated_minutes: number | null
          external_url: string | null
          id: string
          is_active: boolean
          module_id: string
          order_index: number
          pdf_url: string | null
          text_content: string | null
          title: string
          updated_at: string
          video_duration_seconds: number | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          module_id: string
          order_index?: number
          pdf_url?: string | null
          text_content?: string | null
          title: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          module_id?: string
          order_index?: number
          pdf_url?: string | null
          text_content?: string | null
          title?: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "forma_training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_material_downloads: {
        Row: {
          course_id: string
          downloaded_at: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          lesson_id: string
          material_id: string
          material_name: string
          user_id: string
        }
        Insert: {
          course_id: string
          downloaded_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          lesson_id: string
          material_id: string
          material_name: string
          user_id: string
        }
        Update: {
          course_id?: string
          downloaded_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          lesson_id?: string
          material_id?: string
          material_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_material_downloads_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lesson_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_material_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_notifications: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          is_read: boolean
          lesson_id: string | null
          message: string
          notification_type: string
          quiz_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          lesson_id?: string | null
          message: string
          notification_type: string
          quiz_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          lesson_id?: string | null
          message?: string
          notification_type?: string
          quiz_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_notifications_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_notifications_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "forma_training_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_path_enrollments: {
        Row: {
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          enrolled_at: string
          id: string
          learning_path_id: string
          progress_percent: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          enrolled_at?: string
          id?: string
          learning_path_id: string
          progress_percent?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          enrolled_at?: string
          id?: string
          learning_path_id?: string
          progress_percent?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_path_enrollments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_path_enrollments_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "forma_training_learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_path_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_quiz_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          started_at: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          passed: boolean
          quiz_id: string
          score: number
          started_at?: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          started_at?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_quiz_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "forma_training_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "forma_training_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question_text: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "forma_training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_training_quizzes: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lesson_id: string | null
          max_attempts: number | null
          module_id: string | null
          passing_score: number
          show_correct_answers: boolean
          shuffle_questions: boolean
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lesson_id?: string | null
          max_attempts?: number | null
          module_id?: string | null
          passing_score?: number
          show_correct_answers?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lesson_id?: string | null
          max_attempts?: number | null
          module_id?: string | null
          passing_score?: number
          show_correct_answers?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_course_completion_stats"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "forma_training_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "forma_training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_training_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "forma_training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_ig_conversations: {
        Row: {
          conversation_id: string
          hidden_at: string
          hidden_by: string
          id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string
          hidden_by: string
          id?: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string
          hidden_by?: string
          id?: string
        }
        Relationships: []
      }
      internal_chat_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          message_id: string
          mime_type: string | null
          storage_key: string
          uploaded_by: string
        }
        Insert: {
          attachment_type?: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          message_id: string
          mime_type?: string | null
          storage_key: string
          uploaded_by: string
        }
        Update: {
          attachment_type?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          storage_key?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          has_attachments: boolean
          id: string
          is_deleted: boolean
          is_edited: boolean
          mentions: Json
          parent_message_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          channel_id?: string
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          mentions?: Json
          parent_message_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          mentions?: Json
          parent_message_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_read_receipts: {
        Row: {
          channel_id: string
          last_read_at: string
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_read_receipts_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
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
          doc_type_id: string | null
          file_size: number | null
          id: string
          lead_id: string
          mime_type: string | null
          name: string | null
          notes: string | null
          url: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type_id?: string | null
          file_size?: number | null
          id?: string
          lead_id: string
          mime_type?: string | null
          name?: string | null
          notes?: string | null
          url: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type_id?: string | null
          file_size?: number | null
          id?: string
          lead_id?: string
          mime_type?: string | null
          name?: string | null
          notes?: string | null
          url?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "doc_types"
            referencedColumns: ["id"]
          },
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
          ig_username: string | null
          lead_type: string | null
          lifecycle_stage_id: string | null
          localidade: string | null
          meio_contacto_preferencial: string | null
          meta_data: Json | null
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
          platform: string | null
          tags: string[]
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
          ig_username?: string | null
          lead_type?: string | null
          lifecycle_stage_id?: string | null
          localidade?: string | null
          meio_contacto_preferencial?: string | null
          meta_data?: Json | null
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
          platform?: string | null
          tags?: string[]
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
          ig_username?: string | null
          lead_type?: string | null
          lifecycle_stage_id?: string | null
          localidade?: string | null
          meio_contacto_preferencial?: string | null
          meta_data?: Json | null
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
          platform?: string | null
          tags?: string[]
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
          {
            foreignKeyName: "leads_lifecycle_stage_id_fkey"
            columns: ["lifecycle_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_contact_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: string | null
          id: string
          metadata: Json | null
          negocio_id: string | null
          subject: string | null
        }
        Insert: {
          activity_type: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          negocio_id?: string | null
          subject?: string | null
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          negocio_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_activities_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_assignment_rules: {
        Row: {
          campaign_id_match: string | null
          consultant_id: string | null
          created_at: string
          description: string | null
          fallback_action: string
          id: string
          is_active: boolean
          name: string
          overflow_threshold: number | null
          pipeline_type_match: string[] | null
          priority: number
          round_robin_index: number
          sector_match: string[] | null
          source_match: string[] | null
          team_consultant_ids: string[] | null
          updated_at: string
          zone_match: string[] | null
        }
        Insert: {
          campaign_id_match?: string | null
          consultant_id?: string | null
          created_at?: string
          description?: string | null
          fallback_action?: string
          id?: string
          is_active?: boolean
          name: string
          overflow_threshold?: number | null
          pipeline_type_match?: string[] | null
          priority?: number
          round_robin_index?: number
          sector_match?: string[] | null
          source_match?: string[] | null
          team_consultant_ids?: string[] | null
          updated_at?: string
          zone_match?: string[] | null
        }
        Update: {
          campaign_id_match?: string | null
          consultant_id?: string | null
          created_at?: string
          description?: string | null
          fallback_action?: string
          id?: string
          is_active?: boolean
          name?: string
          overflow_threshold?: number | null
          pipeline_type_match?: string[] | null
          priority?: number
          round_robin_index?: number
          sector_match?: string[] | null
          source_match?: string[] | null
          team_consultant_ids?: string[] | null
          updated_at?: string
          zone_match?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assignment_rules_campaign_id_match_fkey"
            columns: ["campaign_id_match"]
            isOneToOne: false
            referencedRelation: "leads_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assignment_rules_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_campaign_metrics: {
        Row: {
          campaign_id: string
          clicks: number | null
          cpl: number | null
          ctr: number | null
          date: string
          erp_contacted: number | null
          erp_converted: number | null
          erp_entries: number | null
          erp_qualified: number | null
          erp_revenue: number | null
          erp_won: number | null
          id: string
          impressions: number | null
          platform_leads: number | null
          spend: number | null
          synced_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          cpl?: number | null
          ctr?: number | null
          date: string
          erp_contacted?: number | null
          erp_converted?: number | null
          erp_entries?: number | null
          erp_qualified?: number | null
          erp_revenue?: number | null
          erp_won?: number | null
          id?: string
          impressions?: number | null
          platform_leads?: number | null
          spend?: number | null
          synced_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          cpl?: number | null
          ctr?: number | null
          date?: string
          erp_contacted?: number | null
          erp_converted?: number | null
          erp_entries?: number | null
          erp_qualified?: number | null
          erp_revenue?: number | null
          erp_won?: number | null
          id?: string
          impressions?: number | null
          platform_leads?: number | null
          spend?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "leads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_campaigns: {
        Row: {
          budget: number | null
          created_at: string
          description: string | null
          end_date: string | null
          external_ad_id: string | null
          external_adset_id: string | null
          external_campaign_id: string | null
          id: string
          name: string
          notes: string | null
          platform: string
          sector: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          id?: string
          name: string
          notes?: string | null
          platform: string
          sector?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: string
          sector?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads_contact_stages: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      leads_contacts: {
        Row: {
          address: string | null
          assigned_consultant_id: string | null
          city: string | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_nipc: string | null
          company_phone: string | null
          created_at: string
          date_of_birth: string | null
          document_back_url: string | null
          document_country: string | null
          document_expiry: string | null
          document_front_url: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          first_source: string | null
          full_name: string
          has_company: boolean
          id: string
          lifecycle_stage_id: string | null
          nationality: string | null
          nif: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          secondary_phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_consultant_id?: string | null
          city?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_nipc?: string | null
          company_phone?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_back_url?: string | null
          document_country?: string | null
          document_expiry?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_source?: string | null
          full_name: string
          has_company?: boolean
          id?: string
          lifecycle_stage_id?: string | null
          nationality?: string | null
          nif?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          secondary_phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_consultant_id?: string | null
          city?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_nipc?: string | null
          company_phone?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_back_url?: string | null
          document_country?: string | null
          document_expiry?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_source?: string | null
          full_name?: string
          has_company?: boolean
          id?: string
          lifecycle_stage_id?: string | null
          nationality?: string | null
          nif?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          secondary_phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contacts_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contacts_lifecycle_stage_id_fkey"
            columns: ["lifecycle_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_contact_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_entries: {
        Row: {
          assigned_agent_id: string | null
          assigned_consultant_id: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string
          first_contact_at: string | null
          form_data: Json | null
          form_url: string | null
          has_referral: boolean | null
          id: string
          is_reactivation: boolean
          match_details: Json | null
          match_type: string | null
          notes: string | null
          partner_id: string | null
          priority: string
          processed_at: string | null
          processed_by: string | null
          raw_email: string | null
          raw_name: string | null
          raw_phone: string | null
          referral_consultant_id: string | null
          referral_external_agency: string | null
          referral_external_email: string | null
          referral_external_name: string | null
          referral_external_phone: string | null
          referral_pct: number | null
          sector: string | null
          sla_deadline: string | null
          sla_status: string
          source: string
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_consultant_id?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          first_contact_at?: string | null
          form_data?: Json | null
          form_url?: string | null
          has_referral?: boolean | null
          id?: string
          is_reactivation?: boolean
          match_details?: Json | null
          match_type?: string | null
          notes?: string | null
          partner_id?: string | null
          priority?: string
          processed_at?: string | null
          processed_by?: string | null
          raw_email?: string | null
          raw_name?: string | null
          raw_phone?: string | null
          referral_consultant_id?: string | null
          referral_external_agency?: string | null
          referral_external_email?: string | null
          referral_external_name?: string | null
          referral_external_phone?: string | null
          referral_pct?: number | null
          sector?: string | null
          sla_deadline?: string | null
          sla_status?: string
          source: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_consultant_id?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          first_contact_at?: string | null
          form_data?: Json | null
          form_url?: string | null
          has_referral?: boolean | null
          id?: string
          is_reactivation?: boolean
          match_details?: Json | null
          match_type?: string | null
          notes?: string | null
          partner_id?: string | null
          priority?: string
          processed_at?: string | null
          processed_by?: string | null
          raw_email?: string | null
          raw_name?: string | null
          raw_phone?: string | null
          referral_consultant_id?: string | null
          referral_external_agency?: string | null
          referral_external_email?: string | null
          referral_external_name?: string | null
          referral_external_phone?: string | null
          referral_pct?: number | null
          sector?: string | null
          sla_deadline?: string | null
          sla_status?: string
          source?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_entries_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "leads_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "leads_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entries_referral_consultant_id_fkey"
            columns: ["referral_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_negocio_stage_history: {
        Row: {
          entered_at: string
          exited_at: string | null
          id: string
          moved_by: string | null
          negocio_id: string
          stage_id: string
        }
        Insert: {
          entered_at?: string
          exited_at?: string | null
          id?: string
          moved_by?: string | null
          negocio_id: string
          stage_id: string
        }
        Update: {
          entered_at?: string
          exited_at?: string | null
          id?: string
          moved_by?: string | null
          negocio_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_negocio_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocio_stage_history_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocio_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_negocios: {
        Row: {
          assigned_consultant_id: string | null
          contact_id: string
          created_at: string
          details: Json
          expected_close_date: string | null
          expected_value: number | null
          id: string
          lead_entry_id: string | null
          lost_date: string | null
          lost_notes: string | null
          lost_reason: string | null
          notes: string | null
          pipeline_stage_id: string
          pipeline_type: string
          probability_pct: number | null
          property_id: string | null
          stage_entered_at: string
          updated_at: string
          won_date: string | null
        }
        Insert: {
          assigned_consultant_id?: string | null
          contact_id: string
          created_at?: string
          details?: Json
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          lead_entry_id?: string | null
          lost_date?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          notes?: string | null
          pipeline_stage_id: string
          pipeline_type: string
          probability_pct?: number | null
          property_id?: string | null
          stage_entered_at?: string
          updated_at?: string
          won_date?: string | null
        }
        Update: {
          assigned_consultant_id?: string | null
          contact_id?: string
          created_at?: string
          details?: Json
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          lead_entry_id?: string | null
          lost_date?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          notes?: string | null
          pipeline_stage_id?: string
          pipeline_type?: string
          probability_pct?: number | null
          property_id?: string | null
          stage_entered_at?: string
          updated_at?: string
          won_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_negocios_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocios_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocios_lead_entry_id_fkey"
            columns: ["lead_entry_id"]
            isOneToOne: false
            referencedRelation: "leads_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocios_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_notifications: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          entry_id: string | null
          id: string
          is_email_sent: boolean
          is_push_sent: boolean
          is_read: boolean
          link: string | null
          negocio_id: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          is_email_sent?: boolean
          is_push_sent?: boolean
          is_read?: boolean
          link?: string | null
          negocio_id?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          is_email_sent?: boolean
          is_push_sent?: boolean
          is_read?: boolean
          link?: string | null
          negocio_id?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_notifications_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "leads_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_notifications_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_partners: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          last_portal_access: string | null
          magic_link_expires_at: string | null
          magic_link_token: string | null
          name: string
          notes: string | null
          partner_type: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_portal_access?: string | null
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          name: string
          notes?: string | null
          partner_type?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_portal_access?: string | null
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          name?: string
          notes?: string | null
          partner_type?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leads_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_terminal: boolean
          name: string
          order_index: number
          pipeline_type: string
          probability_pct: number
          sla_days: number | null
          terminal_type: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          name: string
          order_index?: number
          pipeline_type: string
          probability_pct?: number
          sla_days?: number | null
          terminal_type?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          name?: string
          order_index?: number
          pipeline_type?: string
          probability_pct?: number
          sla_days?: number | null
          terminal_type?: string | null
        }
        Relationships: []
      }
      leads_referrals: {
        Row: {
          contact_id: string
          created_at: string
          entry_id: string | null
          from_consultant_id: string | null
          id: string
          negocio_id: string | null
          notes: string | null
          partner_id: string | null
          referral_type: string
          status: string
          to_consultant_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          entry_id?: string | null
          from_consultant_id?: string | null
          id?: string
          negocio_id?: string | null
          notes?: string | null
          partner_id?: string | null
          referral_type: string
          status?: string
          to_consultant_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          entry_id?: string | null
          from_consultant_id?: string | null
          id?: string
          negocio_id?: string | null
          notes?: string | null
          partner_id?: string | null
          referral_type?: string
          status?: string
          to_consultant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_referrals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrals_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "leads_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrals_from_consultant_id_fkey"
            columns: ["from_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrals_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "leads_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrals_to_consultant_id_fkey"
            columns: ["to_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          label: string
          options: Json | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          key: string
          label: string
          options?: Json | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          options?: Json | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_sla_configs: {
        Row: {
          created_at: string
          critical_pct: number
          escalate_pct: number
          id: string
          is_active: boolean
          name: string
          priority: number
          priority_match: string[] | null
          sector_match: string[] | null
          sla_minutes: number
          source_match: string[] | null
          updated_at: string
          warning_pct: number
        }
        Insert: {
          created_at?: string
          critical_pct?: number
          escalate_pct?: number
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          priority_match?: string[] | null
          sector_match?: string[] | null
          sla_minutes?: number
          source_match?: string[] | null
          updated_at?: string
          warning_pct?: number
        }
        Update: {
          created_at?: string
          critical_pct?: number
          escalate_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          priority_match?: string[] | null
          sector_match?: string[] | null
          sla_minutes?: number
          source_match?: string[] | null
          updated_at?: string
          warning_pct?: number
        }
        Relationships: []
      }
      leads_tags: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
          email_message_id: string | null
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
          email_message_id?: string | null
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
          email_message_id?: string | null
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
            foreignKeyName: "log_emails_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
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
      marketing_agent_assets: {
        Row: {
          agent_id: string
          category: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          agent_id: string
          category?: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          agent_id?: string
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agent_assets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_agent_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agent_metrics: {
        Row: {
          agent_id: string
          avg_engagement: number | null
          avg_reach: number | null
          created_at: string
          followers_count: number | null
          id: string
          month: string
          notes: string | null
          platform: string
          posts_count: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          avg_engagement?: number | null
          avg_reach?: number | null
          created_at?: string
          followers_count?: number | null
          id?: string
          month: string
          notes?: string | null
          platform?: string
          posts_count?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          avg_engagement?: number | null
          avg_reach?: number | null
          created_at?: string
          followers_count?: number | null
          id?: string
          month?: string
          notes?: string | null
          platform?: string
          posts_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agent_profiles: {
        Row: {
          agent_id: string
          brand_voice_notes: string | null
          canva_workspace_url: string | null
          created_at: string
          facebook_url: string | null
          google_drive_url: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          notes: string | null
          other_links: Json | null
          tiktok_url: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          brand_voice_notes?: string | null
          canva_workspace_url?: string | null
          created_at?: string
          facebook_url?: string | null
          google_drive_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          notes?: string | null
          other_links?: Json | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          brand_voice_notes?: string | null
          canva_workspace_url?: string | null
          created_at?: string
          facebook_url?: string | null
          google_drive_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          notes?: string | null
          other_links?: Json | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agent_profiles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          agent_id: string
          budget_amount: number
          budget_type: string
          checkout_group_id: string | null
          created_at: string | null
          creative_notes: string | null
          duration_days: number
          id: string
          objective: string
          payment_method: string | null
          promote_url: string | null
          property_id: string | null
          rejection_reason: string | null
          status: string
          target_age_max: number | null
          target_age_min: number | null
          target_interests: string | null
          target_zone: string | null
          total_cost: number
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          budget_amount: number
          budget_type?: string
          checkout_group_id?: string | null
          created_at?: string | null
          creative_notes?: string | null
          duration_days: number
          id?: string
          objective: string
          payment_method?: string | null
          promote_url?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          status?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_interests?: string | null
          target_zone?: string | null
          total_cost: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          budget_amount?: number
          budget_type?: string
          checkout_group_id?: string | null
          created_at?: string | null
          creative_notes?: string | null
          duration_days?: number
          id?: string
          objective?: string
          payment_method?: string | null
          promote_url?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          status?: string
          target_age_max?: number | null
          target_age_min?: number | null
          target_interests?: string | null
          target_zone?: string | null
          total_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_catalog: {
        Row: {
          billing_cycle: string | null
          category: string
          created_at: string
          description: string
          estimated_delivery_days: number
          id: string
          is_active: boolean
          is_subscription: boolean
          name: string
          price: number
          requires_property: boolean
          requires_scheduling: boolean
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          category: string
          created_at?: string
          description?: string
          estimated_delivery_days?: number
          id?: string
          is_active?: boolean
          is_subscription?: boolean
          name: string
          price: number
          requires_property?: boolean
          requires_scheduling?: boolean
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          category?: string
          created_at?: string
          description?: string
          estimated_delivery_days?: number
          id?: string
          is_active?: boolean
          is_subscription?: boolean
          name?: string
          price?: number
          requires_property?: boolean
          requires_scheduling?: boolean
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_catalog_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_service_id: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_service_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_service_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_catalog_addons_parent_service_id_fkey"
            columns: ["parent_service_id"]
            isOneToOne: false
            referencedRelation: "marketing_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content_calendar: {
        Row: {
          agent_id: string
          content_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          platform: string
          post_url: string | null
          property_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          platform?: string
          post_url?: string | null
          property_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          platform?: string
          post_url?: string | null
          property_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_calendar_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_calendar_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_calendar_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content_requests: {
        Row: {
          agent_id: string
          approval_notes: string | null
          assigned_to: string | null
          completed_at: string | null
          content_type: string
          created_at: string
          deadline: string | null
          description: string | null
          draft_notes: string | null
          draft_url: string | null
          id: string
          platform: string
          property_id: string | null
          property_reference: string | null
          requested_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          approval_notes?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          content_type?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          draft_notes?: string | null
          draft_url?: string | null
          id?: string
          platform?: string
          property_id?: string | null
          property_reference?: string | null
          requested_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          approval_notes?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          content_type?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          draft_notes?: string | null
          draft_url?: string | null
          id?: string
          platform?: string
          property_id?: string | null
          property_reference?: string | null
          requested_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_design_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_design_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_design_templates: {
        Row: {
          canva_url: string | null
          category: string
          category_id: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          id: string
          is_active: boolean
          is_team_design: boolean
          name: string
          sort_order: number
          subcategory: string | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          canva_url?: string | null
          category: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          is_team_design?: boolean
          name: string
          sort_order?: number
          subcategory?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          canva_url?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          is_team_design?: boolean
          name?: string
          sort_order?: number
          subcategory?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_design_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketing_design_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_design_templates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_kit_templates: {
        Row: {
          canva_design_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          placeholders: string[]
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          canva_design_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          placeholders?: string[]
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          canva_design_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          placeholders?: string[]
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_kit_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
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
          cancelled_reason: string | null
          catalog_item_id: string | null
          confirmed_date: string | null
          confirmed_time: string | null
          id: string
          name: string
          notes: string | null
          order_id: string
          pack_id: string | null
          price: number
          proposed_dates: Json | null
          quantity: number
          status: string
          updated_at: string | null
          used_count: number
        }
        Insert: {
          cancelled_reason?: string | null
          catalog_item_id?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          id?: string
          name: string
          notes?: string | null
          order_id: string
          pack_id?: string | null
          price: number
          proposed_dates?: Json | null
          quantity?: number
          status?: string
          updated_at?: string | null
          used_count?: number
        }
        Update: {
          cancelled_reason?: string | null
          catalog_item_id?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          pack_id?: string | null
          price?: number
          proposed_dates?: Json | null
          quantity?: number
          status?: string
          updated_at?: string | null
          used_count?: number
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
          checkout_group_id: string | null
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
          payment_method: string | null
          postal_code: string | null
          preferred_date: string | null
          preferred_time: string | null
          property_bundle_data: Json | null
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
          checkout_group_id?: string | null
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
          payment_method?: string | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_bundle_data?: Json | null
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
          checkout_group_id?: string | null
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
          payment_method?: string | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_bundle_data?: Json | null
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
      marketing_publications: {
        Row: {
          agent_id: string
          comments: number | null
          content_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          impressions: number | null
          likes: number | null
          performance_notes: string | null
          platform: string
          post_url: string | null
          published_at: string
          reach: number | null
          shares: number | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          agent_id: string
          comments?: number | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          performance_notes?: string | null
          platform?: string
          post_url?: string | null
          published_at?: string
          reach?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          agent_id?: string
          comments?: number | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          performance_notes?: string | null
          platform?: string
          post_url?: string | null
          published_at?: string
          reach?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_publications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_publications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_requests: {
        Row: {
          access_instructions: string | null
          address: string | null
          agent_id: string
          alternative_date: string | null
          alternative_time: string | null
          area_m2: number | null
          assigned_to: string | null
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
          order_item_id: string
          parish: string | null
          parking_available: boolean | null
          postal_code: string | null
          preferred_date: string | null
          preferred_time: string | null
          property_id: string | null
          property_type: string | null
          status: string
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
          order_item_id: string
          parish?: string | null
          parking_available?: boolean | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          property_type?: string | null
          status?: string
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
          order_item_id?: string
          parish?: string | null
          parking_available?: boolean | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          property_type?: string | null
          status?: string
          typology?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "marketing_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_subscription_billing_log: {
        Row: {
          amount: number
          billing_date: string
          created_at: string | null
          error_message: string | null
          id: string
          status: string
          subscription_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          billing_date: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          status: string
          subscription_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          billing_date?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          status?: string
          subscription_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_subscription_billing_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "marketing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_subscription_billing_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "conta_corrente_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_subscriptions: {
        Row: {
          agent_id: string
          billing_cycle: string
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          catalog_item_id: string
          created_at: string | null
          current_period_end: string
          current_period_start: string
          failed_billing_count: number | null
          id: string
          last_billing_attempt: string | null
          last_billing_error: string | null
          next_billing_date: string
          order_item_id: string
          paused_at: string | null
          price_per_cycle: number
          started_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          catalog_item_id: string
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          failed_billing_count?: number | null
          id?: string
          last_billing_attempt?: string | null
          last_billing_error?: string | null
          next_billing_date: string
          order_item_id: string
          paused_at?: string | null
          price_per_cycle: number
          started_at?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          catalog_item_id?: string
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          failed_billing_count?: number | null
          id?: string
          last_billing_attempt?: string | null
          last_billing_error?: string | null
          next_billing_date?: string
          order_item_id?: string
          paused_at?: string | null
          price_per_cycle?: number
          started_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_subscriptions_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "marketing_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_subscriptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "marketing_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          canva_url: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          canva_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          canva_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      negocio_documents: {
        Row: {
          created_at: string
          doc_type_id: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          label: string | null
          mime_type: string | null
          negocio_id: string
          notes: string | null
          updated_at: string
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          doc_type_id?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          label?: string | null
          mime_type?: string | null
          negocio_id: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          doc_type_id?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          negocio_id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_documents_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_documents_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_properties: {
        Row: {
          created_at: string | null
          external_price: number | null
          external_source: string | null
          external_title: string | null
          external_url: string | null
          id: string
          negocio_id: string
          notes: string | null
          property_id: string | null
          sent_at: string | null
          status: string
          updated_at: string | null
          visited_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_price?: number | null
          external_source?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          negocio_id: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          visited_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_price?: number | null
          external_source?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          negocio_id?: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_properties_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          aceita_animais: boolean | null
          area_m2: number | null
          area_min_m2: number | null
          assigned_consultant_id: string | null
          capital_proprio: number | null
          casas_banho: number | null
          caucao_rendas: number | null
          classe_imovel: string | null
          concelho: string | null
          created_at: string | null
          credit_entity: string | null
          credit_intermediation: boolean | null
          credit_notes: string | null
          credito_pre_aprovado: boolean | null
          distrito: string | null
          duracao_minima_contrato: string | null
          entry_id: string | null
          estado: string | null
          estado_imovel: string | null
          estado_imovel_venda: string | null
          expected_close_date: string | null
          expected_value: number | null
          financiamento_necessario: boolean | null
          freguesia: string | null
          has_referral: boolean | null
          id: string
          lead_id: string
          localizacao: string | null
          localizacao_venda: string | null
          lost_date: string | null
          lost_notes: string | null
          lost_reason: string | null
          mobilado: boolean | null
          motivacao_compra: string | null
          num_wc: number | null
          observacoes: string | null
          orcamento: number | null
          orcamento_max: number | null
          origem: string | null
          origem_detalhe: string | null
          origem_mensagem: string | null
          pipeline_stage_id: string | null
          prazo_compra: string | null
          preco_venda: number | null
          probability_pct: number | null
          property_id: string | null
          quartos: number | null
          quartos_min: number | null
          referral_consultant_id: string | null
          referral_external_agency: string | null
          referral_external_email: string | null
          referral_external_name: string | null
          referral_external_phone: string | null
          referral_info: string | null
          referral_pct: number | null
          referral_side: string | null
          referral_type: string | null
          renda_max_mensal: number | null
          renda_pretendida: number | null
          rendimento_mensal: number | null
          situacao_profissional: string | null
          stage_entered_at: string | null
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
          temperatura: string | null
          tipo: string
          tipo_imovel: string | null
          tipo_imovel_venda: string | null
          total_divisoes: number | null
          updated_at: string | null
          valor_credito: number | null
          won_date: string | null
        }
        Insert: {
          aceita_animais?: boolean | null
          area_m2?: number | null
          area_min_m2?: number | null
          assigned_consultant_id?: string | null
          capital_proprio?: number | null
          casas_banho?: number | null
          caucao_rendas?: number | null
          classe_imovel?: string | null
          concelho?: string | null
          created_at?: string | null
          credit_entity?: string | null
          credit_intermediation?: boolean | null
          credit_notes?: string | null
          credito_pre_aprovado?: boolean | null
          distrito?: string | null
          duracao_minima_contrato?: string | null
          entry_id?: string | null
          estado?: string | null
          estado_imovel?: string | null
          estado_imovel_venda?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          financiamento_necessario?: boolean | null
          freguesia?: string | null
          has_referral?: boolean | null
          id?: string
          lead_id: string
          localizacao?: string | null
          localizacao_venda?: string | null
          lost_date?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          mobilado?: boolean | null
          motivacao_compra?: string | null
          num_wc?: number | null
          observacoes?: string | null
          orcamento?: number | null
          orcamento_max?: number | null
          origem?: string | null
          origem_detalhe?: string | null
          origem_mensagem?: string | null
          pipeline_stage_id?: string | null
          prazo_compra?: string | null
          preco_venda?: number | null
          probability_pct?: number | null
          property_id?: string | null
          quartos?: number | null
          quartos_min?: number | null
          referral_consultant_id?: string | null
          referral_external_agency?: string | null
          referral_external_email?: string | null
          referral_external_name?: string | null
          referral_external_phone?: string | null
          referral_info?: string | null
          referral_pct?: number | null
          referral_side?: string | null
          referral_type?: string | null
          renda_max_mensal?: number | null
          renda_pretendida?: number | null
          rendimento_mensal?: number | null
          situacao_profissional?: string | null
          stage_entered_at?: string | null
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
          temperatura?: string | null
          tipo: string
          tipo_imovel?: string | null
          tipo_imovel_venda?: string | null
          total_divisoes?: number | null
          updated_at?: string | null
          valor_credito?: number | null
          won_date?: string | null
        }
        Update: {
          aceita_animais?: boolean | null
          area_m2?: number | null
          area_min_m2?: number | null
          assigned_consultant_id?: string | null
          capital_proprio?: number | null
          casas_banho?: number | null
          caucao_rendas?: number | null
          classe_imovel?: string | null
          concelho?: string | null
          created_at?: string | null
          credit_entity?: string | null
          credit_intermediation?: boolean | null
          credit_notes?: string | null
          credito_pre_aprovado?: boolean | null
          distrito?: string | null
          duracao_minima_contrato?: string | null
          entry_id?: string | null
          estado?: string | null
          estado_imovel?: string | null
          estado_imovel_venda?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          financiamento_necessario?: boolean | null
          freguesia?: string | null
          has_referral?: boolean | null
          id?: string
          lead_id?: string
          localizacao?: string | null
          localizacao_venda?: string | null
          lost_date?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          mobilado?: boolean | null
          motivacao_compra?: string | null
          num_wc?: number | null
          observacoes?: string | null
          orcamento?: number | null
          orcamento_max?: number | null
          origem?: string | null
          origem_detalhe?: string | null
          origem_mensagem?: string | null
          pipeline_stage_id?: string | null
          prazo_compra?: string | null
          preco_venda?: number | null
          probability_pct?: number | null
          property_id?: string | null
          quartos?: number | null
          quartos_min?: number | null
          referral_consultant_id?: string | null
          referral_external_agency?: string | null
          referral_external_email?: string | null
          referral_external_name?: string | null
          referral_external_phone?: string | null
          referral_info?: string | null
          referral_pct?: number | null
          referral_side?: string | null
          referral_type?: string | null
          renda_max_mensal?: number | null
          renda_pretendida?: number | null
          rendimento_mensal?: number | null
          situacao_profissional?: string | null
          stage_entered_at?: string | null
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
          temperatura?: string | null
          tipo?: string
          tipo_imovel?: string | null
          tipo_imovel_venda?: string | null
          total_divisoes?: number | null
          updated_at?: string | null
          valor_credito?: number | null
          won_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "leads_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_referral_consultant_id_fkey"
            columns: ["referral_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_routing_rules: {
        Row: {
          channel_email: boolean
          channel_in_app: boolean
          channel_whatsapp: boolean
          created_at: string
          created_by: string | null
          description: string | null
          event_key: string
          id: string
          is_active: boolean
          label: string
          module: string
          priority: number
          recipient_role_id: string | null
          recipient_type: string
          recipient_user_id: string | null
          updated_at: string
        }
        Insert: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_key: string
          id?: string
          is_active?: boolean
          label: string
          module: string
          priority?: number
          recipient_role_id?: string | null
          recipient_type: string
          recipient_user_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_key?: string
          id?: string
          is_active?: boolean
          label?: string
          module?: string
          priority?: number
          recipient_role_id?: string | null
          recipient_type?: string
          recipient_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_routing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_routing_rules_recipient_role_id_fkey"
            columns: ["recipient_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_routing_rules_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
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
      portal_visit_requests: {
        Row: {
          alternative_date: string | null
          alternative_time: string | null
          client_user_id: string
          consultant_response: string | null
          created_at: string | null
          id: string
          message: string | null
          preferred_date: string
          preferred_time: string
          property_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          alternative_date?: string | null
          alternative_time?: string | null
          client_user_id: string
          consultant_response?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          preferred_date: string
          preferred_time: string
          property_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          alternative_date?: string | null
          alternative_time?: string | null
          client_user_id?: string
          consultant_response?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          preferred_date?: string
          preferred_time?: string
          property_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_visit_requests_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_visit_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
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
          completed_stage_ids: string[] | null
          current_stage_id: string | null
          current_stage_ids: string[] | null
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
          completed_stage_ids?: string[] | null
          current_stage_id?: string | null
          current_stage_ids?: string[] | null
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
          completed_stage_ids?: string[] | null
          current_stage_id?: string | null
          current_stage_ids?: string[] | null
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
      property_availability_rules: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          note: string | null
          property_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          note?: string | null
          property_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          note?: string | null
          property_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_availability_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_booking_windows: {
        Row: {
          active: boolean
          created_at: string
          end_date: string
          id: string
          note: string | null
          property_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          property_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          property_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_booking_windows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_date_overrides: {
        Row: {
          blocked: boolean
          created_at: string
          end_time: string | null
          id: string
          note: string | null
          override_date: string
          property_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          override_date: string
          property_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          override_date?: string
          property_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_date_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
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
      property_owner_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          note: string | null
          property_id: string
          status: string
          submission_metadata: Json | null
          submitted_at: string | null
          submitted_owner_ids: string[]
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          note?: string | null
          property_id: string
          status?: string
          submission_metadata?: Json | null
          submitted_at?: string | null
          submitted_owner_ids?: string[]
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          note?: string | null
          property_id?: string
          status?: string
          submission_metadata?: Json | null
          submitted_at?: string | null
          submitted_owner_ids?: string[]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owner_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owner_invites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
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
      property_presentations: {
        Row: {
          format: string
          generated_at: string
          generated_by: string | null
          id: string
          pdf_url: string
          property_id: string
          sections: string[] | null
          share_url: string | null
          summary_override: string | null
          updated_at: string
        }
        Insert: {
          format: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_url: string
          property_id: string
          sections?: string[] | null
          share_url?: string | null
          summary_override?: string | null
          updated_at?: string
        }
        Update: {
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string
          property_id?: string
          sections?: string[] | null
          share_url?: string | null
          summary_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_presentations_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_presentations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_propostas: {
        Row: {
          condicoes_complementares: string | null
          consultant_id: string | null
          created_at: string | null
          data_reforco_1: string | null
          data_reforco_2: string | null
          id: string
          lead_id: string | null
          natureza: string
          notes: string | null
          pdf_url: string | null
          preco: number
          property_id: string
          proponente_nome: string | null
          status: string
          tem_financiamento: boolean | null
          updated_at: string | null
          valor_conclusao: number | null
          valor_contrato: number | null
          valor_financiamento: number | null
          valor_reforco_1: number | null
          valor_reforco_2: number | null
        }
        Insert: {
          condicoes_complementares?: string | null
          consultant_id?: string | null
          created_at?: string | null
          data_reforco_1?: string | null
          data_reforco_2?: string | null
          id?: string
          lead_id?: string | null
          natureza?: string
          notes?: string | null
          pdf_url?: string | null
          preco: number
          property_id: string
          proponente_nome?: string | null
          status?: string
          tem_financiamento?: boolean | null
          updated_at?: string | null
          valor_conclusao?: number | null
          valor_contrato?: number | null
          valor_financiamento?: number | null
          valor_reforco_1?: number | null
          valor_reforco_2?: number | null
        }
        Update: {
          condicoes_complementares?: string | null
          consultant_id?: string | null
          created_at?: string | null
          data_reforco_1?: string | null
          data_reforco_2?: string | null
          id?: string
          lead_id?: string | null
          natureza?: string
          notes?: string | null
          pdf_url?: string | null
          preco?: number
          property_id?: string
          proponente_nome?: string | null
          status?: string
          tem_financiamento?: boolean | null
          updated_at?: string | null
          valor_conclusao?: number | null
          valor_contrato?: number | null
          valor_financiamento?: number | null
          valor_reforco_1?: number | null
          valor_reforco_2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_propostas_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_propostas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_propostas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_budget: {
        Row: {
          campaign_platform: string | null
          candidate_id: string
          created_at: string
          estimated_cost: number | null
          id: string
          paid_campaign_used: boolean | null
          resources_used: string | null
          updated_at: string
        }
        Insert: {
          campaign_platform?: string | null
          candidate_id: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          paid_campaign_used?: boolean | null
          resources_used?: string | null
          updated_at?: string
        }
        Update: {
          campaign_platform?: string | null
          candidate_id?: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          paid_campaign_used?: boolean | null
          resources_used?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_budget_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          assigned_recruiter_id: string | null
          consultant_user_id: string | null
          created_at: string
          cv_url: string | null
          decision: string | null
          decision_date: string | null
          email: string | null
          first_contact_date: string | null
          full_name: string
          id: string
          last_interaction_date: string | null
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          reason_no: string | null
          reason_yes: string | null
          source: string
          source_detail: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_recruiter_id?: string | null
          consultant_user_id?: string | null
          created_at?: string
          cv_url?: string | null
          decision?: string | null
          decision_date?: string | null
          email?: string | null
          first_contact_date?: string | null
          full_name: string
          id?: string
          last_interaction_date?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          reason_no?: string | null
          reason_yes?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_recruiter_id?: string | null
          consultant_user_id?: string | null
          created_at?: string
          cv_url?: string | null
          decision?: string | null
          decision_date?: string | null
          email?: string | null
          first_contact_date?: string | null
          full_name?: string
          id?: string
          last_interaction_date?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          reason_no?: string | null
          reason_yes?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_consultant_user_id_fkey"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_contract_templates: {
        Row: {
          content_html: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content_html: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content_html?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      recruitment_contracts: {
        Row: {
          candidate_id: string
          contract_data: Json
          created_at: string | null
          generated_html: string | null
          id: string
          pdf_url: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          contract_data?: Json
          created_at?: string | null
          generated_html?: string | null
          id?: string
          pdf_url?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          contract_data?: Json
          created_at?: string | null
          generated_html?: string | null
          id?: string
          pdf_url?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_contracts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recruitment_contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_entry_submissions: {
        Row: {
          candidate_id: string | null
          cc_expiry: string | null
          cc_issue_date: string | null
          cc_number: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          document_type: string | null
          email_suggestion_1: string | null
          email_suggestion_2: string | null
          email_suggestion_3: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          estado_civil: string | null
          facebook_page: string | null
          full_address: string | null
          full_name: string
          has_real_estate_experience: boolean | null
          has_sales_experience: boolean | null
          iban: string | null
          id: string
          id_document_back_url: string | null
          id_document_front_url: string | null
          instagram_handle: string | null
          naturalidade: string | null
          nif: string | null
          niss: string | null
          notes: string | null
          personal_email: string | null
          previous_agency: string | null
          professional_phone: string | null
          professional_photo_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          cc_expiry?: string | null
          cc_issue_date?: string | null
          cc_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          document_type?: string | null
          email_suggestion_1?: string | null
          email_suggestion_2?: string | null
          email_suggestion_3?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estado_civil?: string | null
          facebook_page?: string | null
          full_address?: string | null
          full_name: string
          has_real_estate_experience?: boolean | null
          has_sales_experience?: boolean | null
          iban?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          instagram_handle?: string | null
          naturalidade?: string | null
          nif?: string | null
          niss?: string | null
          notes?: string | null
          personal_email?: string | null
          previous_agency?: string | null
          professional_phone?: string | null
          professional_photo_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          cc_expiry?: string | null
          cc_issue_date?: string | null
          cc_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          document_type?: string | null
          email_suggestion_1?: string | null
          email_suggestion_2?: string | null
          email_suggestion_3?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estado_civil?: string | null
          facebook_page?: string | null
          full_address?: string | null
          full_name?: string
          has_real_estate_experience?: boolean | null
          has_sales_experience?: boolean | null
          iban?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          instagram_handle?: string | null
          naturalidade?: string | null
          nif?: string | null
          niss?: string | null
          notes?: string | null
          personal_email?: string | null
          previous_agency?: string | null
          professional_phone?: string | null
          professional_photo_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_entry_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_entry_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_financial_evolution: {
        Row: {
          billing_month_1: number | null
          billing_month_12: number | null
          billing_month_2: number | null
          billing_month_3: number | null
          billing_month_6: number | null
          candidate_id: string
          created_at: string
          id: string
          months_to_match_previous: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          billing_month_1?: number | null
          billing_month_12?: number | null
          billing_month_2?: number | null
          billing_month_3?: number | null
          billing_month_6?: number | null
          candidate_id: string
          created_at?: string
          id?: string
          months_to_match_previous?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          billing_month_1?: number | null
          billing_month_12?: number | null
          billing_month_2?: number | null
          billing_month_3?: number | null
          billing_month_6?: number | null
          candidate_id?: string
          created_at?: string
          id?: string
          months_to_match_previous?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_financial_evolution_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_form_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          is_ai_extractable: boolean
          is_required: boolean
          is_visible: boolean
          label: string
          options: Json | null
          order_index: number
          placeholder: string | null
          section: string
          section_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          is_ai_extractable?: boolean
          is_required?: boolean
          is_visible?: boolean
          label: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          section: string
          section_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          is_ai_extractable?: boolean
          is_required?: boolean
          is_visible?: boolean
          label?: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          section?: string
          section_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_interviews: {
        Row: {
          candidate_id: string
          conducted_by: string | null
          created_at: string
          follow_up_date: string | null
          format: string
          id: string
          interview_date: string
          interview_number: number
          next_step: string | null
          notes: string | null
        }
        Insert: {
          candidate_id: string
          conducted_by?: string | null
          created_at?: string
          follow_up_date?: string | null
          format?: string
          id?: string
          interview_date: string
          interview_number?: number
          next_step?: string | null
          notes?: string | null
        }
        Update: {
          candidate_id?: string
          conducted_by?: string | null
          created_at?: string
          follow_up_date?: string | null
          format?: string
          id?: string
          interview_date?: string
          interview_number?: number
          next_step?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_onboarding: {
        Row: {
          access_created: boolean | null
          accesses_created: boolean | null
          app_access_created: boolean | null
          candidate_id: string
          contract_ours_generated_at: string | null
          contract_ours_signed_at: string | null
          contract_ours_status: string | null
          contract_ours_url: string | null
          contract_sede_requested_at: string | null
          contract_sede_signed_at: string | null
          contract_sede_status: string | null
          contract_sede_url: string | null
          contract_sent: boolean | null
          contract_sent_by: string | null
          created_at: string
          current_stage: string | null
          email_address: string | null
          email_created: boolean | null
          email_signature_generated: boolean | null
          form_sent: boolean | null
          id: string
          initial_training_completed: boolean | null
          initial_training_date: string | null
          materials_ready: boolean | null
          onboarding_start_date: string | null
          plan_66_start_date: string | null
          plan_66_started: boolean | null
          remax_access_granted: boolean | null
          remax_access_requested: boolean | null
          updated_at: string
        }
        Insert: {
          access_created?: boolean | null
          accesses_created?: boolean | null
          app_access_created?: boolean | null
          candidate_id: string
          contract_ours_generated_at?: string | null
          contract_ours_signed_at?: string | null
          contract_ours_status?: string | null
          contract_ours_url?: string | null
          contract_sede_requested_at?: string | null
          contract_sede_signed_at?: string | null
          contract_sede_status?: string | null
          contract_sede_url?: string | null
          contract_sent?: boolean | null
          contract_sent_by?: string | null
          created_at?: string
          current_stage?: string | null
          email_address?: string | null
          email_created?: boolean | null
          email_signature_generated?: boolean | null
          form_sent?: boolean | null
          id?: string
          initial_training_completed?: boolean | null
          initial_training_date?: string | null
          materials_ready?: boolean | null
          onboarding_start_date?: string | null
          plan_66_start_date?: string | null
          plan_66_started?: boolean | null
          remax_access_granted?: boolean | null
          remax_access_requested?: boolean | null
          updated_at?: string
        }
        Update: {
          access_created?: boolean | null
          accesses_created?: boolean | null
          app_access_created?: boolean | null
          candidate_id?: string
          contract_ours_generated_at?: string | null
          contract_ours_signed_at?: string | null
          contract_ours_status?: string | null
          contract_ours_url?: string | null
          contract_sede_requested_at?: string | null
          contract_sede_signed_at?: string | null
          contract_sede_status?: string | null
          contract_sede_url?: string | null
          contract_sent?: boolean | null
          contract_sent_by?: string | null
          created_at?: string
          current_stage?: string | null
          email_address?: string | null
          email_created?: boolean | null
          email_signature_generated?: boolean | null
          form_sent?: boolean | null
          id?: string
          initial_training_completed?: boolean | null
          initial_training_date?: string | null
          materials_ready?: boolean | null
          onboarding_start_date?: string | null
          plan_66_start_date?: string | null
          plan_66_started?: boolean | null
          remax_access_granted?: boolean | null
          remax_access_requested?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_onboarding_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_onboarding_contract_sent_by_fkey"
            columns: ["contract_sent_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_origin_profiles: {
        Row: {
          billing_avg_month: number | null
          billing_avg_year: number | null
          candidate_id: string
          created_at: string
          currently_active_real_estate: boolean | null
          id: string
          origin_brand: string | null
          origin_brand_custom: string | null
          reason_for_leaving: string | null
          time_at_origin_months: number | null
          updated_at: string
        }
        Insert: {
          billing_avg_month?: number | null
          billing_avg_year?: number | null
          candidate_id: string
          created_at?: string
          currently_active_real_estate?: boolean | null
          id?: string
          origin_brand?: string | null
          origin_brand_custom?: string | null
          reason_for_leaving?: string | null
          time_at_origin_months?: number | null
          updated_at?: string
        }
        Update: {
          billing_avg_month?: number | null
          billing_avg_year?: number | null
          candidate_id?: string
          created_at?: string
          currently_active_real_estate?: boolean | null
          id?: string
          origin_brand?: string | null
          origin_brand_custom?: string | null
          reason_for_leaving?: string | null
          time_at_origin_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_origin_profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_pain_pitch: {
        Row: {
          candidate_id: string
          candidate_objections: string | null
          created_at: string
          fit_score: number | null
          id: string
          identified_pains: string | null
          solutions_presented: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          candidate_objections?: string | null
          created_at?: string
          fit_score?: number | null
          id?: string
          identified_pains?: string | null
          solutions_presented?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          candidate_objections?: string | null
          created_at?: string
          fit_score?: number | null
          id?: string
          identified_pains?: string | null
          solutions_presented?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_pain_pitch_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_stage_log: {
        Row: {
          candidate_id: string
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          candidate_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          candidate_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_stage_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_stage_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
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
      scheduled_posts: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          ig_container_id: string | null
          media_type: string | null
          media_url: string | null
          platform: string | null
          published_at: string | null
          published_post_id: string | null
          scheduled_for: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          ig_container_id?: string | null
          media_type?: string | null
          media_url?: string | null
          platform?: string | null
          published_at?: string | null
          published_post_id?: string | null
          scheduled_for: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          ig_container_id?: string | null
          media_type?: string | null
          media_url?: string | null
          platform?: string | null
          published_at?: string | null
          published_post_id?: string | null
          scheduled_for?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_order_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          is_anonymous: boolean
          is_public: boolean
          order_id: string
          rating: number
          user_id: string
          would_recommend: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_public?: boolean
          order_id: string
          rating: number
          user_id: string
          would_recommend?: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_public?: boolean
          order_id?: string
          rating?: number
          user_id?: string
          would_recommend?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "temp_supplier_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_order_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_list_shares: {
        Row: {
          added_by: string | null
          created_at: string
          task_list_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          task_list_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          task_list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_list_shares_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_list_shares_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_list_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_completed: boolean
          is_recurring: boolean
          order_index: number
          parent_task_id: string | null
          priority: number
          recurrence_rule: string | null
          section: string | null
          task_list_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          order_index?: number
          parent_task_id?: string | null
          priority?: number
          recurrence_rule?: string | null
          section?: string | null
          task_list_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          order_index?: number
          parent_task_id?: string | null
          priority?: number
          recurrence_rule?: string | null
          section?: string | null
          task_list_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_acompanhamento_properties: {
        Row: {
          acompanhamento_id: string
          created_at: string | null
          external_price: number | null
          external_source: string | null
          external_title: string | null
          external_url: string | null
          id: string
          notes: string | null
          property_id: string | null
          sent_at: string | null
          status: string
          visited_at: string | null
        }
        Insert: {
          acompanhamento_id: string
          created_at?: string | null
          external_price?: number | null
          external_source?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          visited_at?: string | null
        }
        Update: {
          acompanhamento_id?: string
          created_at?: string | null
          external_price?: number | null
          external_source?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_acompanhamento_properties_acompanhamento_id_fkey"
            columns: ["acompanhamento_id"]
            isOneToOne: false
            referencedRelation: "temp_acompanhamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_acompanhamento_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_acompanhamentos: {
        Row: {
          consultant_id: string
          created_at: string | null
          created_by: string | null
          credit_entity: string | null
          credit_intermediation: boolean | null
          credit_notes: string | null
          id: string
          lead_id: string
          lost_reason: string | null
          negocio_id: string
          notes: string | null
          pre_approval_amount: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          created_by?: string | null
          credit_entity?: string | null
          credit_intermediation?: boolean | null
          credit_notes?: string | null
          id?: string
          lead_id: string
          lost_reason?: string | null
          negocio_id: string
          notes?: string | null
          pre_approval_amount?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          created_by?: string | null
          credit_entity?: string | null
          credit_intermediation?: boolean | null
          credit_notes?: string | null
          id?: string
          lead_id?: string
          lost_reason?: string | null
          negocio_id?: string
          notes?: string | null
          pre_approval_amount?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_acompanhamentos_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_acompanhamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_acompanhamentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_acompanhamentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_agency_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      temp_commission_tiers: {
        Row: {
          agency_rate: number
          business_type: string
          consultant_rate: number
          created_at: string | null
          id: string
          is_active: boolean | null
          max_value: number | null
          min_value: number
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          agency_rate?: number
          business_type: string
          consultant_rate?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_value?: number | null
          min_value?: number
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_rate?: number
          business_type?: string
          consultant_rate?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_value?: number | null
          min_value?: number
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      temp_consultant_goals: {
        Row: {
          annual_revenue_target: number
          buyers_avg_calls_per_lead: number | null
          buyers_avg_commission_pct: number | null
          buyers_avg_purchase_value: number | null
          buyers_close_rate: number | null
          buyers_pct_lead_to_qualified: number | null
          consultant_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          pct_buyers: number
          pct_sellers: number
          sellers_avg_calls_per_lead: number | null
          sellers_avg_commission_pct: number | null
          sellers_avg_sale_value: number | null
          sellers_pct_lead_to_visit: number | null
          sellers_pct_listings_sold: number | null
          sellers_pct_visit_to_listing: number | null
          updated_at: string | null
          working_days_week: number
          working_weeks_year: number
          year: number
        }
        Insert: {
          annual_revenue_target: number
          buyers_avg_calls_per_lead?: number | null
          buyers_avg_commission_pct?: number | null
          buyers_avg_purchase_value?: number | null
          buyers_close_rate?: number | null
          buyers_pct_lead_to_qualified?: number | null
          consultant_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pct_buyers?: number
          pct_sellers?: number
          sellers_avg_calls_per_lead?: number | null
          sellers_avg_commission_pct?: number | null
          sellers_avg_sale_value?: number | null
          sellers_pct_lead_to_visit?: number | null
          sellers_pct_listings_sold?: number | null
          sellers_pct_visit_to_listing?: number | null
          updated_at?: string | null
          working_days_week?: number
          working_weeks_year?: number
          year: number
        }
        Update: {
          annual_revenue_target?: number
          buyers_avg_calls_per_lead?: number | null
          buyers_avg_commission_pct?: number | null
          buyers_avg_purchase_value?: number | null
          buyers_close_rate?: number | null
          buyers_pct_lead_to_qualified?: number | null
          consultant_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pct_buyers?: number
          pct_sellers?: number
          sellers_avg_calls_per_lead?: number | null
          sellers_avg_commission_pct?: number | null
          sellers_avg_sale_value?: number | null
          sellers_pct_lead_to_visit?: number | null
          sellers_pct_listings_sold?: number | null
          sellers_pct_visit_to_listing?: number | null
          updated_at?: string | null
          working_days_week?: number
          working_weeks_year?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "temp_consultant_goals_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_credito_actividades: {
        Row: {
          created_at: string
          descricao: string
          id: string
          metadata: Json | null
          pedido_credito_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          metadata?: Json | null
          pedido_credito_id: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          pedido_credito_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_credito_actividades_pedido_credito_id_fkey"
            columns: ["pedido_credito_id"]
            isOneToOne: false
            referencedRelation: "temp_pedidos_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_credito_actividades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_credito_bancos: {
        Row: {
          agencia: string | null
          comissao_maxima: number | null
          comissao_minima: number | null
          comissao_percentagem: number | null
          created_at: string
          documentos_exigidos: Json | null
          gestor_email: string | null
          gestor_nome: string | null
          gestor_telefone: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          nome: string
          nome_completo: string | null
          notas: string | null
          protocolo_ref: string | null
          protocolo_validade: string | null
          spread_protocolo: number | null
          tem_protocolo: boolean | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          comissao_maxima?: number | null
          comissao_minima?: number | null
          comissao_percentagem?: number | null
          created_at?: string
          documentos_exigidos?: Json | null
          gestor_email?: string | null
          gestor_nome?: string | null
          gestor_telefone?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          nome: string
          nome_completo?: string | null
          notas?: string | null
          protocolo_ref?: string | null
          protocolo_validade?: string | null
          spread_protocolo?: number | null
          tem_protocolo?: boolean | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          comissao_maxima?: number | null
          comissao_minima?: number | null
          comissao_percentagem?: number | null
          created_at?: string
          documentos_exigidos?: Json | null
          gestor_email?: string | null
          gestor_nome?: string | null
          gestor_telefone?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          nome?: string
          nome_completo?: string | null
          notas?: string | null
          protocolo_ref?: string | null
          protocolo_validade?: string | null
          spread_protocolo?: number | null
          tem_protocolo?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      temp_credito_documentos: {
        Row: {
          bancos_requeridos: string[] | null
          categoria: string
          created_at: string
          data_recebido: string | null
          data_solicitado: string | null
          data_validade: string | null
          doc_registry_id: string | null
          file_mimetype: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          motivo_rejeicao: string | null
          nome: string
          notas: string | null
          obrigatorio: boolean | null
          order_index: number | null
          pedido_credito_id: string
          status: string
          titular: string | null
          updated_at: string
        }
        Insert: {
          bancos_requeridos?: string[] | null
          categoria?: string
          created_at?: string
          data_recebido?: string | null
          data_solicitado?: string | null
          data_validade?: string | null
          doc_registry_id?: string | null
          file_mimetype?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          motivo_rejeicao?: string | null
          nome: string
          notas?: string | null
          obrigatorio?: boolean | null
          order_index?: number | null
          pedido_credito_id: string
          status?: string
          titular?: string | null
          updated_at?: string
        }
        Update: {
          bancos_requeridos?: string[] | null
          categoria?: string
          created_at?: string
          data_recebido?: string | null
          data_solicitado?: string | null
          data_validade?: string | null
          doc_registry_id?: string | null
          file_mimetype?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          motivo_rejeicao?: string | null
          nome?: string
          notas?: string | null
          obrigatorio?: boolean | null
          order_index?: number | null
          pedido_credito_id?: string
          status?: string
          titular?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_credito_documentos_doc_registry_id_fkey"
            columns: ["doc_registry_id"]
            isOneToOne: false
            referencedRelation: "doc_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_credito_documentos_pedido_credito_id_fkey"
            columns: ["pedido_credito_id"]
            isOneToOne: false
            referencedRelation: "temp_pedidos_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_credito_simulacoes: {
        Row: {
          capital_proprio: number
          created_at: string
          created_by: string
          encargo_credito_mensal: number | null
          euribor: number
          id: string
          imposto_selo_credito: number | null
          label: string | null
          ltv: number
          montante_credito: number
          mtic: number
          notas: string | null
          pedido_credito_id: string | null
          periodo_revisao_meses: number | null
          prazo_anos: number
          prestacao_mensal: number
          rendimento_mensal_liquido: number | null
          seguro_multirriscos_anual_estimado: number | null
          seguro_vida_mensal_estimado: number | null
          spread: number
          taxa_esforco: number | null
          taxa_juro: number
          tipo_taxa: string
          total_imposto_selo_juros: number | null
          total_juros: number
          valor_imovel: number
        }
        Insert: {
          capital_proprio: number
          created_at?: string
          created_by: string
          encargo_credito_mensal?: number | null
          euribor: number
          id?: string
          imposto_selo_credito?: number | null
          label?: string | null
          ltv: number
          montante_credito: number
          mtic: number
          notas?: string | null
          pedido_credito_id?: string | null
          periodo_revisao_meses?: number | null
          prazo_anos: number
          prestacao_mensal: number
          rendimento_mensal_liquido?: number | null
          seguro_multirriscos_anual_estimado?: number | null
          seguro_vida_mensal_estimado?: number | null
          spread: number
          taxa_esforco?: number | null
          taxa_juro: number
          tipo_taxa?: string
          total_imposto_selo_juros?: number | null
          total_juros: number
          valor_imovel: number
        }
        Update: {
          capital_proprio?: number
          created_at?: string
          created_by?: string
          encargo_credito_mensal?: number | null
          euribor?: number
          id?: string
          imposto_selo_credito?: number | null
          label?: string | null
          ltv?: number
          montante_credito?: number
          mtic?: number
          notas?: string | null
          pedido_credito_id?: string | null
          periodo_revisao_meses?: number | null
          prazo_anos?: number
          prestacao_mensal?: number
          rendimento_mensal_liquido?: number | null
          seguro_multirriscos_anual_estimado?: number | null
          seguro_vida_mensal_estimado?: number | null
          spread?: number
          taxa_esforco?: number | null
          taxa_juro?: number
          tipo_taxa?: string
          total_imposto_selo_juros?: number | null
          total_juros?: number
          valor_imovel?: number
        }
        Relationships: [
          {
            foreignKeyName: "temp_credito_simulacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_credito_simulacoes_pedido_credito_id_fkey"
            columns: ["pedido_credito_id"]
            isOneToOne: false
            referencedRelation: "temp_pedidos_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_financial_transactions: {
        Row: {
          agency_commission_amount: number | null
          agency_commission_pct: number | null
          approved_at: string | null
          approved_by: string | null
          category: string | null
          consultant_commission_amount: number | null
          consultant_id: string | null
          consultant_split_pct: number | null
          created_at: string | null
          deal_value: number | null
          description: string | null
          id: string
          is_shared_deal: boolean | null
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          proc_instance_id: string | null
          property_id: string | null
          reporting_month: string | null
          share_agency_name: string | null
          share_amount: number | null
          share_pct: number | null
          share_type: string | null
          status: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          agency_commission_amount?: number | null
          agency_commission_pct?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          consultant_commission_amount?: number | null
          consultant_id?: string | null
          consultant_split_pct?: number | null
          created_at?: string | null
          deal_value?: number | null
          description?: string | null
          id?: string
          is_shared_deal?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          proc_instance_id?: string | null
          property_id?: string | null
          reporting_month?: string | null
          share_agency_name?: string | null
          share_amount?: number | null
          share_pct?: number | null
          share_type?: string | null
          status?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          agency_commission_amount?: number | null
          agency_commission_pct?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          consultant_commission_amount?: number | null
          consultant_id?: string | null
          consultant_split_pct?: number | null
          created_at?: string | null
          deal_value?: number | null
          description?: string | null
          id?: string
          is_shared_deal?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          proc_instance_id?: string | null
          property_id?: string | null
          reporting_month?: string | null
          share_agency_name?: string | null
          share_amount?: number | null
          share_pct?: number | null
          share_type?: string | null
          status?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_financial_transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_financial_transactions_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_financial_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_goal_activity_log: {
        Row: {
          activity_date: string
          activity_type: string
          consultant_id: string
          created_at: string | null
          created_by: string | null
          direction: string | null
          id: string
          notes: string | null
          origin: string
          origin_type: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          revenue_amount: number | null
        }
        Insert: {
          activity_date?: string
          activity_type: string
          consultant_id: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          id?: string
          notes?: string | null
          origin: string
          origin_type?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          revenue_amount?: number | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          consultant_id?: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          id?: string
          notes?: string | null
          origin?: string
          origin_type?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          revenue_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_goal_activity_log_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_goal_activity_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_goal_snapshots: {
        Row: {
          buyers_calls_count: number | null
          buyers_closes_count: number | null
          buyers_leads_count: number | null
          buyers_qualified_count: number | null
          buyers_revenue: number | null
          created_at: string | null
          goal_id: string
          id: string
          period_type: string
          sellers_calls_count: number | null
          sellers_leads_count: number | null
          sellers_listings_count: number | null
          sellers_revenue: number | null
          sellers_sales_count: number | null
          sellers_visits_count: number | null
          snapshot_date: string
        }
        Insert: {
          buyers_calls_count?: number | null
          buyers_closes_count?: number | null
          buyers_leads_count?: number | null
          buyers_qualified_count?: number | null
          buyers_revenue?: number | null
          created_at?: string | null
          goal_id: string
          id?: string
          period_type: string
          sellers_calls_count?: number | null
          sellers_leads_count?: number | null
          sellers_listings_count?: number | null
          sellers_revenue?: number | null
          sellers_sales_count?: number | null
          sellers_visits_count?: number | null
          snapshot_date: string
        }
        Update: {
          buyers_calls_count?: number | null
          buyers_closes_count?: number | null
          buyers_leads_count?: number | null
          buyers_qualified_count?: number | null
          buyers_revenue?: number | null
          created_at?: string | null
          goal_id?: string
          id?: string
          period_type?: string
          sellers_calls_count?: number | null
          sellers_leads_count?: number | null
          sellers_listings_count?: number | null
          sellers_revenue?: number | null
          sellers_sales_count?: number | null
          sellers_visits_count?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_goal_snapshots_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "temp_consultant_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_partner_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          partner_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          partner_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          partner_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_partner_ratings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "temp_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_partner_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_partners: {
        Row: {
          address: string | null
          average_delivery_days: number | null
          category: string
          city: string | null
          commercial_conditions: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          internal_notes: string | null
          is_active: boolean | null
          is_recommended: boolean | null
          name: string
          nif: string | null
          payment_method: string | null
          payment_terms: string | null
          person_type: string
          phone: string | null
          phone_secondary: string | null
          postal_code: string | null
          rating_avg: number | null
          rating_count: number | null
          service_areas: string[] | null
          specialties: string[] | null
          updated_at: string | null
          visibility: string
          website: string | null
        }
        Insert: {
          address?: string | null
          average_delivery_days?: number | null
          category?: string
          city?: string | null
          commercial_conditions?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          is_recommended?: boolean | null
          name: string
          nif?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          person_type?: string
          phone?: string | null
          phone_secondary?: string | null
          postal_code?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          service_areas?: string[] | null
          specialties?: string[] | null
          updated_at?: string | null
          visibility?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          average_delivery_days?: number | null
          category?: string
          city?: string | null
          commercial_conditions?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          is_recommended?: boolean | null
          name?: string
          nif?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          person_type?: string
          phone?: string | null
          phone_secondary?: string | null
          postal_code?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          service_areas?: string[] | null
          specialties?: string[] | null
          updated_at?: string | null
          visibility?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_pedidos_credito: {
        Row: {
          antiguidade_emprego_meses: number | null
          assigned_to: string
          capital_proprio: number | null
          created_at: string
          data_aprovacao_final: string | null
          data_conclusao: string | null
          data_escritura_prevista: string | null
          data_escritura_real: string | null
          data_nascimento_titular: string | null
          data_pre_aprovacao: string | null
          data_submissao_bancos: string | null
          despesas_fixas_mensais: number | null
          encargos_cartoes: number | null
          encargos_creditos_existentes: number | null
          encargos_pensao_alimentos: number | null
          entidade_patronal: string | null
          estado_civil: string | null
          fonte_outros_rendimentos: string | null
          id: string
          imovel_finalidade: string | null
          imovel_tipo: string | null
          imovel_valor_avaliacao: number | null
          imovel_valor_escritura: number | null
          lead_id: string
          ltv_calculado: number | null
          montante_solicitado: number | null
          motivo_desistencia: string | null
          motivo_recusa: string | null
          negocio_id: string | null
          notas: string | null
          numero_dependentes: number | null
          origem_capital: string | null
          outros_encargos: number | null
          outros_rendimentos: number | null
          prazo_anos: number | null
          property_id: string | null
          reference: string | null
          rendimento_anual_bruto: number | null
          rendimento_disponivel: number | null
          rendimento_mensal_liquido: number | null
          rgpd_consentimento: boolean
          rgpd_consentimento_data: string | null
          rgpd_consentimento_ip: string | null
          segundo_titular_data_nascimento: string | null
          segundo_titular_encargos: number | null
          segundo_titular_entidade_patronal: string | null
          segundo_titular_nif: string | null
          segundo_titular_nome: string | null
          segundo_titular_rendimento_liquido: number | null
          segundo_titular_tipo_contrato: string | null
          status: string
          taxa_esforco: number | null
          tem_fiador: boolean | null
          tem_segundo_titular: boolean | null
          tipo_contrato_trabalho: string | null
          tipo_taxa: string | null
          updated_at: string
        }
        Insert: {
          antiguidade_emprego_meses?: number | null
          assigned_to: string
          capital_proprio?: number | null
          created_at?: string
          data_aprovacao_final?: string | null
          data_conclusao?: string | null
          data_escritura_prevista?: string | null
          data_escritura_real?: string | null
          data_nascimento_titular?: string | null
          data_pre_aprovacao?: string | null
          data_submissao_bancos?: string | null
          despesas_fixas_mensais?: number | null
          encargos_cartoes?: number | null
          encargos_creditos_existentes?: number | null
          encargos_pensao_alimentos?: number | null
          entidade_patronal?: string | null
          estado_civil?: string | null
          fonte_outros_rendimentos?: string | null
          id?: string
          imovel_finalidade?: string | null
          imovel_tipo?: string | null
          imovel_valor_avaliacao?: number | null
          imovel_valor_escritura?: number | null
          lead_id: string
          ltv_calculado?: number | null
          montante_solicitado?: number | null
          motivo_desistencia?: string | null
          motivo_recusa?: string | null
          negocio_id?: string | null
          notas?: string | null
          numero_dependentes?: number | null
          origem_capital?: string | null
          outros_encargos?: number | null
          outros_rendimentos?: number | null
          prazo_anos?: number | null
          property_id?: string | null
          reference?: string | null
          rendimento_anual_bruto?: number | null
          rendimento_disponivel?: number | null
          rendimento_mensal_liquido?: number | null
          rgpd_consentimento?: boolean
          rgpd_consentimento_data?: string | null
          rgpd_consentimento_ip?: string | null
          segundo_titular_data_nascimento?: string | null
          segundo_titular_encargos?: number | null
          segundo_titular_entidade_patronal?: string | null
          segundo_titular_nif?: string | null
          segundo_titular_nome?: string | null
          segundo_titular_rendimento_liquido?: number | null
          segundo_titular_tipo_contrato?: string | null
          status?: string
          taxa_esforco?: number | null
          tem_fiador?: boolean | null
          tem_segundo_titular?: boolean | null
          tipo_contrato_trabalho?: string | null
          tipo_taxa?: string | null
          updated_at?: string
        }
        Update: {
          antiguidade_emprego_meses?: number | null
          assigned_to?: string
          capital_proprio?: number | null
          created_at?: string
          data_aprovacao_final?: string | null
          data_conclusao?: string | null
          data_escritura_prevista?: string | null
          data_escritura_real?: string | null
          data_nascimento_titular?: string | null
          data_pre_aprovacao?: string | null
          data_submissao_bancos?: string | null
          despesas_fixas_mensais?: number | null
          encargos_cartoes?: number | null
          encargos_creditos_existentes?: number | null
          encargos_pensao_alimentos?: number | null
          entidade_patronal?: string | null
          estado_civil?: string | null
          fonte_outros_rendimentos?: string | null
          id?: string
          imovel_finalidade?: string | null
          imovel_tipo?: string | null
          imovel_valor_avaliacao?: number | null
          imovel_valor_escritura?: number | null
          lead_id?: string
          ltv_calculado?: number | null
          montante_solicitado?: number | null
          motivo_desistencia?: string | null
          motivo_recusa?: string | null
          negocio_id?: string | null
          notas?: string | null
          numero_dependentes?: number | null
          origem_capital?: string | null
          outros_encargos?: number | null
          outros_rendimentos?: number | null
          prazo_anos?: number | null
          property_id?: string | null
          reference?: string | null
          rendimento_anual_bruto?: number | null
          rendimento_disponivel?: number | null
          rendimento_mensal_liquido?: number | null
          rgpd_consentimento?: boolean
          rgpd_consentimento_data?: string | null
          rgpd_consentimento_ip?: string | null
          segundo_titular_data_nascimento?: string | null
          segundo_titular_encargos?: number | null
          segundo_titular_entidade_patronal?: string | null
          segundo_titular_nif?: string | null
          segundo_titular_nome?: string | null
          segundo_titular_rendimento_liquido?: number | null
          segundo_titular_tipo_contrato?: string | null
          status?: string
          taxa_esforco?: number | null
          tem_fiador?: boolean | null
          tem_segundo_titular?: boolean | null
          tipo_contrato_trabalho?: string | null
          tipo_taxa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_pedidos_credito_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_pedidos_credito_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_pedidos_credito_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_pedidos_credito_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_portal_favorites: {
        Row: {
          client_user_id: string
          created_at: string | null
          id: string
          property_id: string
        }
        Insert: {
          client_user_id: string
          created_at?: string | null
          id?: string
          property_id: string
        }
        Update: {
          client_user_id?: string
          created_at?: string | null
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_portal_favorites_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_portal_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_portal_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: []
      }
      temp_product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      temp_product_templates: {
        Row: {
          created_at: string | null
          file_type: string | null
          file_url: string
          id: string
          is_current: boolean | null
          name: string
          notes: string | null
          product_id: string
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          is_current?: boolean | null
          name: string
          notes?: string | null
          product_id: string
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          name?: string
          notes?: string | null
          product_id?: string
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_product_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_product_templates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_product_variants: {
        Row: {
          additional_cost: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          product_id: string
          sku_suffix: string | null
          sort_order: number | null
          thumbnail_url: string | null
        }
        Insert: {
          additional_cost?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          product_id: string
          sku_suffix?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          additional_cost?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          product_id?: string
          sku_suffix?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_products: {
        Row: {
          approval_threshold: number | null
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_personalizable: boolean | null
          is_property_linked: boolean | null
          is_returnable: boolean | null
          min_stock_alert: number | null
          name: string
          personalization_fields: Json | null
          requires_approval: boolean | null
          sell_price: number
          sku: string | null
          supplier_id: string | null
          thumbnail_url: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          approval_threshold?: number | null
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_personalizable?: boolean | null
          is_property_linked?: boolean | null
          is_returnable?: boolean | null
          min_stock_alert?: number | null
          name: string
          personalization_fields?: Json | null
          requires_approval?: boolean | null
          sell_price: number
          sku?: string | null
          supplier_id?: string | null
          thumbnail_url?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          approval_threshold?: number | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_personalizable?: boolean | null
          is_property_linked?: boolean | null
          is_returnable?: boolean | null
          min_stock_alert?: number | null
          name?: string
          personalization_fields?: Json | null
          requires_approval?: boolean | null
          sell_price?: number
          sku?: string | null
          supplier_id?: string | null
          thumbnail_url?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "temp_product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "temp_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_propostas_banco: {
        Row: {
          banco: string
          banco_contacto: string | null
          banco_email: string | null
          banco_telefone: string | null
          comissao_avaliacao: number | null
          comissao_dossier: number | null
          comissao_formalizacao: number | null
          condicoes_especiais: string | null
          created_at: string
          data_aprovacao: string | null
          data_contratacao: string | null
          data_resposta: string | null
          data_submissao: string | null
          data_validade_aprovacao: string | null
          euribor_referencia: string | null
          exige_cartao_credito: boolean | null
          exige_domiciliacao_salario: boolean | null
          exige_seguros_banco: boolean | null
          financiamento_percentagem: number | null
          id: string
          imposto_selo_comissoes: number | null
          imposto_selo_credito: number | null
          is_selected: boolean | null
          ltv_aprovado: number | null
          montante_aprovado: number | null
          motivo_recusa: string | null
          mtic: number | null
          notas: string | null
          outros_produtos_obrigatorios: string | null
          pedido_credito_id: string
          prazo_aprovado_anos: number | null
          prestacao_mensal: number | null
          protocolo_ref: string | null
          seguro_incluido_prestacao: boolean | null
          seguro_multirriscos_anual: number | null
          seguro_vida_mensal: number | null
          spread: number | null
          status: string
          taeg: number | null
          taxa_fixa_periodo_anos: number | null
          taxa_fixa_valor: number | null
          tem_protocolo: boolean | null
          tipo_taxa: string | null
          updated_at: string
        }
        Insert: {
          banco: string
          banco_contacto?: string | null
          banco_email?: string | null
          banco_telefone?: string | null
          comissao_avaliacao?: number | null
          comissao_dossier?: number | null
          comissao_formalizacao?: number | null
          condicoes_especiais?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_contratacao?: string | null
          data_resposta?: string | null
          data_submissao?: string | null
          data_validade_aprovacao?: string | null
          euribor_referencia?: string | null
          exige_cartao_credito?: boolean | null
          exige_domiciliacao_salario?: boolean | null
          exige_seguros_banco?: boolean | null
          financiamento_percentagem?: number | null
          id?: string
          imposto_selo_comissoes?: number | null
          imposto_selo_credito?: number | null
          is_selected?: boolean | null
          ltv_aprovado?: number | null
          montante_aprovado?: number | null
          motivo_recusa?: string | null
          mtic?: number | null
          notas?: string | null
          outros_produtos_obrigatorios?: string | null
          pedido_credito_id: string
          prazo_aprovado_anos?: number | null
          prestacao_mensal?: number | null
          protocolo_ref?: string | null
          seguro_incluido_prestacao?: boolean | null
          seguro_multirriscos_anual?: number | null
          seguro_vida_mensal?: number | null
          spread?: number | null
          status?: string
          taeg?: number | null
          taxa_fixa_periodo_anos?: number | null
          taxa_fixa_valor?: number | null
          tem_protocolo?: boolean | null
          tipo_taxa?: string | null
          updated_at?: string
        }
        Update: {
          banco?: string
          banco_contacto?: string | null
          banco_email?: string | null
          banco_telefone?: string | null
          comissao_avaliacao?: number | null
          comissao_dossier?: number | null
          comissao_formalizacao?: number | null
          condicoes_especiais?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_contratacao?: string | null
          data_resposta?: string | null
          data_submissao?: string | null
          data_validade_aprovacao?: string | null
          euribor_referencia?: string | null
          exige_cartao_credito?: boolean | null
          exige_domiciliacao_salario?: boolean | null
          exige_seguros_banco?: boolean | null
          financiamento_percentagem?: number | null
          id?: string
          imposto_selo_comissoes?: number | null
          imposto_selo_credito?: number | null
          is_selected?: boolean | null
          ltv_aprovado?: number | null
          montante_aprovado?: number | null
          motivo_recusa?: string | null
          mtic?: number | null
          notas?: string | null
          outros_produtos_obrigatorios?: string | null
          pedido_credito_id?: string
          prazo_aprovado_anos?: number | null
          prestacao_mensal?: number | null
          protocolo_ref?: string | null
          seguro_incluido_prestacao?: boolean | null
          seguro_multirriscos_anual?: number | null
          seguro_vida_mensal?: number | null
          spread?: number | null
          status?: string
          taeg?: number | null
          taxa_fixa_periodo_anos?: number | null
          taxa_fixa_valor?: number | null
          tem_protocolo?: boolean | null
          tipo_taxa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_propostas_banco_pedido_credito_id_fkey"
            columns: ["pedido_credito_id"]
            isOneToOne: false
            referencedRelation: "temp_pedidos_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_report_snapshots: {
        Row: {
          consultant_id: string | null
          data: Json
          generated_at: string | null
          generated_by: string | null
          id: string
          parameters: Json | null
          pdf_url: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Insert: {
          consultant_id?: string | null
          data: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Update: {
          consultant_id?: string | null
          data?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          parameters?: Json | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_report_snapshots_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_report_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_requisition_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          personalization_data: Json | null
          product_id: string
          quantity: number
          requisition_id: string
          status: string | null
          subtotal: number
          supplier_order_id: string | null
          supplier_order_ref: string | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          personalization_data?: Json | null
          product_id: string
          quantity?: number
          requisition_id: string
          status?: string | null
          subtotal: number
          supplier_order_id?: string | null
          supplier_order_ref?: string | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          personalization_data?: Json | null
          product_id?: string
          quantity?: number
          requisition_id?: string
          status?: string | null
          subtotal?: number
          supplier_order_id?: string | null
          supplier_order_ref?: string | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "temp_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisition_items_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "temp_supplier_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisition_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "temp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_requisitions: {
        Row: {
          actual_delivery_date: string | null
          agent_id: string
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          checkout_group_id: string | null
          conta_corrente_tx_id: string | null
          created_at: string | null
          delivered_by: string | null
          delivery_address: string | null
          delivery_notes: string | null
          delivery_type: string | null
          id: string
          internal_notes: string | null
          payment_method: string | null
          priority: string | null
          property_id: string | null
          reference: string | null
          rejection_reason: string | null
          requested_delivery_date: string | null
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          agent_id: string
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          checkout_group_id?: string | null
          conta_corrente_tx_id?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          delivery_type?: string | null
          id?: string
          internal_notes?: string | null
          payment_method?: string | null
          priority?: string | null
          property_id?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requested_delivery_date?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          agent_id?: string
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          checkout_group_id?: string | null
          conta_corrente_tx_id?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          delivery_type?: string | null
          id?: string
          internal_notes?: string | null
          payment_method?: string | null
          priority?: string | null
          property_id?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requested_delivery_date?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_requisitions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisitions_conta_corrente_tx_id_fkey"
            columns: ["conta_corrente_tx_id"]
            isOneToOne: false
            referencedRelation: "conta_corrente_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisitions_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_requisitions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_returns: {
        Row: {
          agent_id: string
          condition: string
          conta_corrente_tx_id: string | null
          created_at: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          product_id: string
          quantity: number
          reason: string | null
          refund_amount: number | null
          requisition_item_id: string | null
          variant_id: string | null
        }
        Insert: {
          agent_id: string
          condition?: string
          conta_corrente_tx_id?: string | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          product_id: string
          quantity?: number
          reason?: string | null
          refund_amount?: number | null
          requisition_item_id?: string | null
          variant_id?: string | null
        }
        Update: {
          agent_id?: string
          condition?: string
          conta_corrente_tx_id?: string | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          refund_amount?: number | null
          requisition_item_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_returns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_returns_conta_corrente_tx_id_fkey"
            columns: ["conta_corrente_tx_id"]
            isOneToOne: false
            referencedRelation: "conta_corrente_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_returns_requisition_item_id_fkey"
            columns: ["requisition_item_id"]
            isOneToOne: false
            referencedRelation: "temp_requisition_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_returns_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "temp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_stock: {
        Row: {
          created_at: string | null
          id: string
          last_restock_at: string | null
          location: string | null
          product_id: string
          quantity_available: number
          quantity_on_order: number
          quantity_reserved: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_restock_at?: string | null
          location?: string | null
          product_id: string
          quantity_available?: number
          quantity_on_order?: number
          quantity_reserved?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_restock_at?: string | null
          location?: string | null
          product_id?: string
          quantity_available?: number
          quantity_on_order?: number
          quantity_reserved?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "temp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_stock_movements: {
        Row: {
          created_at: string | null
          id: string
          movement_type: string
          notes: string | null
          performed_by: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          stock_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          performed_by: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          stock_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          performed_by?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_stock_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_stock_movements_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "temp_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_supplier_order_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          product_id: string
          quantity_ordered: number
          quantity_received: number | null
          subtotal: number
          supplier_order_id: string
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity_ordered: number
          quantity_received?: number | null
          subtotal: number
          supplier_order_id: string
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          subtotal?: number
          supplier_order_id?: string
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_supplier_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "temp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_supplier_order_items_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "temp_supplier_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_supplier_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "temp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_supplier_orders: {
        Row: {
          actual_delivery_date: string | null
          agent_id: string | null
          at_store_at: string | null
          billing_address: string | null
          billing_email: string | null
          billing_entity: string | null
          billing_name: string | null
          billing_nif: string | null
          created_at: string | null
          delivered_at: string | null
          expected_delivery_date: string | null
          id: string
          invoice_reference: string | null
          invoice_url: string | null
          notes: string | null
          ordered_at: string | null
          ordered_by: string
          received_by: string | null
          reference: string | null
          requisition_item_ids: string[] | null
          status: string
          supplier_id: string
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          agent_id?: string | null
          at_store_at?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_entity?: string | null
          billing_name?: string | null
          billing_nif?: string | null
          created_at?: string | null
          delivered_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_reference?: string | null
          invoice_url?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by: string
          received_by?: string | null
          reference?: string | null
          requisition_item_ids?: string[] | null
          status?: string
          supplier_id: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          agent_id?: string | null
          at_store_at?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_entity?: string | null
          billing_name?: string | null
          billing_nif?: string | null
          created_at?: string | null
          delivered_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_reference?: string | null
          invoice_url?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by?: string
          received_by?: string | null
          reference?: string | null
          requisition_item_ids?: string[] | null
          status?: string
          supplier_id?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_supplier_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_supplier_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_supplier_orders_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "temp_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      tpl_doc_library: {
        Row: {
          content_html: string | null
          created_at: string | null
          description: string | null
          doc_type_id: string | null
          file_key: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          font_path: string | null
          id: string
          letterhead_file_name: string | null
          letterhead_file_type: string | null
          letterhead_url: string | null
          name: string
          template_type: string
          total_fields: number | null
          updated_at: string | null
        }
        Insert: {
          content_html?: string | null
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          file_key?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          font_path?: string | null
          id?: string
          letterhead_file_name?: string | null
          letterhead_file_type?: string | null
          letterhead_url?: string | null
          name: string
          template_type?: string
          total_fields?: number | null
          updated_at?: string | null
        }
        Update: {
          content_html?: string | null
          created_at?: string | null
          description?: string | null
          doc_type_id?: string | null
          file_key?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          font_path?: string | null
          id?: string
          letterhead_file_name?: string | null
          letterhead_file_type?: string | null
          letterhead_url?: string | null
          name?: string
          template_type?: string
          total_fields?: number | null
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
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          editor_state: Json | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          scope: string
          scope_id: string | null
          signature_mode: string
          slug: string | null
          subject: string
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          body_html: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          editor_state?: Json | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          scope?: string
          scope_id?: string | null
          signature_mode?: string
          slug?: string | null
          subject: string
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          body_html?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          editor_state?: Json | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          scope?: string
          scope_id?: string | null
          signature_mode?: string
          slug?: string | null
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
          {
            foreignKeyName: "tpl_email_library_scope_id_fkey"
            columns: ["scope_id"]
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
          depends_on_stages: string[] | null
          description: string | null
          id: string
          name: string
          order_index: number
          tpl_process_id: string | null
        }
        Insert: {
          created_at?: string | null
          depends_on_stages?: string[] | null
          description?: string | null
          id?: string
          name: string
          order_index: number
          tpl_process_id?: string | null
        }
        Update: {
          created_at?: string | null
          depends_on_stages?: string[] | null
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
      user_links: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          title: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          title: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
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
      visit_fichas: {
        Row: {
          client_email: string | null
          client_id_number: string | null
          client_name: string | null
          client_phone: string | null
          consent_share_with_owner: boolean | null
          created_at: string | null
          created_by: string | null
          discovery_source: string | null
          has_property_to_sell: boolean | null
          id: string
          liked_least: string | null
          liked_most: string | null
          perceived_value: number | null
          property_id: string
          rating_agent_service: number | null
          rating_construction: number | null
          rating_finishes: number | null
          rating_floorplan: number | null
          rating_location: number | null
          rating_overall: number | null
          rating_sun_exposition: number | null
          rating_value: number | null
          scan_image_url: string | null
          signature_url: string | null
          source: string
          updated_at: string | null
          visit_date: string | null
          visit_id: string | null
          visit_time: string | null
          would_buy: boolean | null
          would_buy_reason: string | null
        }
        Insert: {
          client_email?: string | null
          client_id_number?: string | null
          client_name?: string | null
          client_phone?: string | null
          consent_share_with_owner?: boolean | null
          created_at?: string | null
          created_by?: string | null
          discovery_source?: string | null
          has_property_to_sell?: boolean | null
          id?: string
          liked_least?: string | null
          liked_most?: string | null
          perceived_value?: number | null
          property_id: string
          rating_agent_service?: number | null
          rating_construction?: number | null
          rating_finishes?: number | null
          rating_floorplan?: number | null
          rating_location?: number | null
          rating_overall?: number | null
          rating_sun_exposition?: number | null
          rating_value?: number | null
          scan_image_url?: string | null
          signature_url?: string | null
          source?: string
          updated_at?: string | null
          visit_date?: string | null
          visit_id?: string | null
          visit_time?: string | null
          would_buy?: boolean | null
          would_buy_reason?: string | null
        }
        Update: {
          client_email?: string | null
          client_id_number?: string | null
          client_name?: string | null
          client_phone?: string | null
          consent_share_with_owner?: boolean | null
          created_at?: string | null
          created_by?: string | null
          discovery_source?: string | null
          has_property_to_sell?: boolean | null
          id?: string
          liked_least?: string | null
          liked_most?: string | null
          perceived_value?: number | null
          property_id?: string
          rating_agent_service?: number | null
          rating_construction?: number | null
          rating_finishes?: number | null
          rating_floorplan?: number | null
          rating_location?: number | null
          rating_overall?: number | null
          rating_sun_exposition?: number | null
          rating_value?: number | null
          scan_image_url?: string | null
          signature_url?: string | null
          source?: string
          updated_at?: string | null
          visit_date?: string | null
          visit_id?: string | null
          visit_time?: string | null
          would_buy?: boolean | null
          would_buy_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_fichas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_fichas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_fichas_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          booking_source: string
          cancelled_by: string | null
          cancelled_reason: string | null
          client_agency: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_type: string
          confirmation_method: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          consultant_id: string
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          feedback_interest: string | null
          feedback_next_step: string | null
          feedback_notes: string | null
          feedback_rating: number | null
          feedback_submitted_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          outcome_prompt_fallback_sent_at: string | null
          outcome_set_at: string | null
          outcome_set_by: string | null
          property_id: string
          proposal_responded_at: string | null
          proposal_responded_by: string | null
          public_token: string | null
          rejected_reason: string | null
          seller_consultant_id: string | null
          status: string
          updated_at: string | null
          visit_date: string
          visit_time: string
        }
        Insert: {
          booking_source?: string
          cancelled_by?: string | null
          cancelled_reason?: string | null
          client_agency?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_type?: string
          confirmation_method?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          consultant_id: string
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          feedback_interest?: string | null
          feedback_next_step?: string | null
          feedback_notes?: string | null
          feedback_rating?: number | null
          feedback_submitted_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome_prompt_fallback_sent_at?: string | null
          outcome_set_at?: string | null
          outcome_set_by?: string | null
          property_id: string
          proposal_responded_at?: string | null
          proposal_responded_by?: string | null
          public_token?: string | null
          rejected_reason?: string | null
          seller_consultant_id?: string | null
          status?: string
          updated_at?: string | null
          visit_date: string
          visit_time: string
        }
        Update: {
          booking_source?: string
          cancelled_by?: string | null
          cancelled_reason?: string | null
          client_agency?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_type?: string
          confirmation_method?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          consultant_id?: string
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          feedback_interest?: string | null
          feedback_next_step?: string | null
          feedback_notes?: string | null
          feedback_rating?: number | null
          feedback_submitted_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome_prompt_fallback_sent_at?: string | null
          outcome_set_at?: string | null
          outcome_set_by?: string | null
          property_id?: string
          proposal_responded_at?: string | null
          proposal_responded_by?: string | null
          public_token?: string | null
          rejected_reason?: string | null
          seller_consultant_id?: string | null
          status?: string
          updated_at?: string | null
          visit_date?: string
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_outcome_set_by_fkey"
            columns: ["outcome_set_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "dev_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_proposal_responded_by_fkey"
            columns: ["proposal_responded_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_seller_consultant_id_fkey"
            columns: ["seller_consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          ai_advice: string | null
          ai_summary: string | null
          consultant_id: string
          created_at: string
          goal_id: string | null
          id: string
          manager_feedback: string | null
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          notes_challenges: string | null
          notes_next_week: string | null
          notes_wins: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          ai_advice?: string | null
          ai_summary?: string | null
          consultant_id: string
          created_at?: string
          goal_id?: string | null
          id?: string
          manager_feedback?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          notes_challenges?: string | null
          notes_next_week?: string | null
          notes_wins?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          ai_advice?: string | null
          ai_summary?: string | null
          consultant_id?: string
          created_at?: string
          goal_id?: string | null
          id?: string
          manager_feedback?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          notes_challenges?: string | null
          notes_next_week?: string | null
          notes_wins?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "temp_consultant_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_manager_reviewed_by_fkey"
            columns: ["manager_reviewed_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_activity_sessions: {
        Row: {
          agent_id: string | null
          chat_id: string
          contact_id: string
          created_at: string
          direction: string
          ended_at: string | null
          id: string
          instance_id: string
          lead_id: string
          message_count: number
          started_at: string
        }
        Insert: {
          agent_id?: string | null
          chat_id: string
          contact_id: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          id?: string
          instance_id: string
          lead_id: string
          message_count?: number
          started_at?: string
        }
        Update: {
          agent_id?: string | null
          chat_id?: string
          contact_id?: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          id?: string
          instance_id?: string
          lead_id?: string
          message_count?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_activity_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_activity_sessions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "wpp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_activity_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wpp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_activity_sessions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_activity_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_chat_labels: {
        Row: {
          chat_id: string
          label_id: string
        }
        Insert: {
          chat_id: string
          label_id: string
        }
        Update: {
          chat_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_chat_labels_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "wpp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_chat_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "wpp_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_chats: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          image: string | null
          instance_id: string
          is_archived: boolean | null
          is_group: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          last_message_from_me: boolean | null
          last_message_text: string | null
          last_message_timestamp: number | null
          last_message_type: string | null
          mute_until: string | null
          name: string | null
          phone: string | null
          raw_data: Json | null
          unread_count: number | null
          updated_at: string | null
          wa_chat_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          instance_id: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          last_message_from_me?: boolean | null
          last_message_text?: string | null
          last_message_timestamp?: number | null
          last_message_type?: string | null
          mute_until?: string | null
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          unread_count?: number | null
          updated_at?: string | null
          wa_chat_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          instance_id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          last_message_from_me?: boolean | null
          last_message_text?: string | null
          last_message_timestamp?: number | null
          last_message_type?: string | null
          mute_until?: string | null
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          unread_count?: number | null
          updated_at?: string | null
          wa_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_chats_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wpp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_chats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_contacts: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          is_blocked: boolean | null
          is_business: boolean | null
          is_group: boolean | null
          lead_id: string | null
          name: string | null
          owner_id: string | null
          phone: string | null
          profile_pic_url: string | null
          raw_data: Json | null
          short_name: string | null
          updated_at: string | null
          wa_contact_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          is_group?: boolean | null
          lead_id?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          short_name?: string | null
          updated_at?: string | null
          wa_contact_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          is_group?: boolean | null
          lead_id?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          short_name?: string | null
          updated_at?: string | null
          wa_contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_debug_log: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          instance_id: string
          items_count: number | null
          notes: string | null
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          instance_id: string
          items_count?: number | null
          notes?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          instance_id?: string
          items_count?: number | null
          notes?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wpp_debug_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_labels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          instance_id: string
          name: string
          predefined_id: string | null
          wa_label_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          instance_id: string
          name: string
          predefined_id?: string | null
          wa_label_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string
          name?: string
          predefined_id?: string | null
          wa_label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_labels_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_message_media: {
        Row: {
          created_at: string | null
          duration: number | null
          file_name: string | null
          file_size: number | null
          height: number | null
          id: string
          instance_id: string
          message_id: string
          mime_type: string | null
          original_url: string | null
          r2_key: string
          r2_url: string
          thumbnail_r2_key: string | null
          thumbnail_r2_url: string | null
          transcription: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          instance_id: string
          message_id: string
          mime_type?: string | null
          original_url?: string | null
          r2_key: string
          r2_url: string
          thumbnail_r2_key?: string | null
          thumbnail_r2_url?: string | null
          transcription?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          instance_id?: string
          message_id?: string
          mime_type?: string | null
          original_url?: string | null
          r2_key?: string
          r2_url?: string
          thumbnail_r2_key?: string | null
          thumbnail_r2_url?: string | null
          transcription?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wpp_message_media_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "wpp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_messages: {
        Row: {
          chat_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          event_data: Json | null
          from_me: boolean | null
          id: string
          instance_id: string
          is_deleted: boolean | null
          is_forwarded: boolean | null
          is_group: boolean | null
          is_starred: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          media_duration: number | null
          media_file_name: string | null
          media_file_size: number | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          poll_data: Json | null
          quoted_message_id: string | null
          raw_data: Json | null
          reactions: Json | null
          sender: string | null
          sender_name: string | null
          status: string | null
          text: string | null
          timestamp: number
          vcard: string | null
          wa_message_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_data?: Json | null
          from_me?: boolean | null
          id?: string
          instance_id: string
          is_deleted?: boolean | null
          is_forwarded?: boolean | null
          is_group?: boolean | null
          is_starred?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          media_duration?: number | null
          media_file_name?: string | null
          media_file_size?: number | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          poll_data?: Json | null
          quoted_message_id?: string | null
          raw_data?: Json | null
          reactions?: Json | null
          sender?: string | null
          sender_name?: string | null
          status?: string | null
          text?: string | null
          timestamp: number
          vcard?: string | null
          wa_message_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_data?: Json | null
          from_me?: boolean | null
          id?: string
          instance_id?: string
          is_deleted?: boolean | null
          is_forwarded?: boolean | null
          is_group?: boolean | null
          is_starred?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          media_duration?: number | null
          media_file_name?: string | null
          media_file_size?: number | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          poll_data?: Json | null
          quoted_message_id?: string | null
          raw_data?: Json | null
          reactions?: Json | null
          sender?: string | null
          sender_name?: string | null
          status?: string | null
          text?: string | null
          timestamp?: number
          vcard?: string | null
          wa_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "wpp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wpp_scheduled_messages: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          instance_id: string
          media_file_name: string | null
          media_url: string | null
          message_type: string
          scheduled_at: string
          sent_at: string | null
          status: string
          text: string | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          instance_id: string
          media_file_name?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          instance_id?: string
          media_file_name?: string | null
          media_url?: string | null
          message_type?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpp_scheduled_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "wpp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_scheduled_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpp_scheduled_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "auto_wpp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      forma_course_completion_stats: {
        Row: {
          avg_progress: number | null
          completion_rate: number | null
          course_id: string | null
          status: string | null
          title: string | null
          total_completed: number | null
          total_enrolled: number | null
        }
        Relationships: []
      }
      forma_material_download_stats: {
        Row: {
          course_id: string | null
          last_download: string | null
          lesson_id: string | null
          material_id: string | null
          material_name: string | null
          total_downloads: number | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_material_downloads_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "forma_training_lesson_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_user_completion_stats: {
        Row: {
          avg_progress: number | null
          commercial_name: string | null
          courses_completed: number | null
          courses_enrolled: number | null
          last_activity: string | null
          profile_photo_url: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_training_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_agent_balances: {
        Row: {
          agent_id: string | null
          available_credits: number | null
          commercial_name: string | null
          debit_limit: number | null
          outstanding_debits: number | null
          total_balance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conta_corrente_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "dev_users"
            referencedColumns: ["id"]
          },
        ]
      }
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
          node_data_snapshot: Json | null
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
      check_overdue_and_create_alerts: { Args: never; Returns: undefined }
      check_overdue_and_unblock_alerts: { Args: never; Returns: undefined }
      decrypt_email_password: {
        Args: { p_encrypted: string; p_key: string }
        Returns: string
      }
      encrypt_email_password: {
        Args: { p_key: string; p_password: string }
        Returns: string
      }
      increment_download_count: { Args: { doc_id: string }; Returns: undefined }
      is_active_dev_user: { Args: never; Returns: boolean }
      populate_process_tasks: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      process_scheduled_wpp_messages: { Args: never; Returns: undefined }
      recalc_agent_lead_count: {
        Args: { agent_uuid: string }
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
