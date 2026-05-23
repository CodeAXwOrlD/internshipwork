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
      admin_pricing: {
        Row: {
          admin_id: string
          created_at: string
          custom_price_per_unit: number | null
          id: string
          is_custom_pricing: boolean | null
          markup_percentage: number | null
          service_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          custom_price_per_unit?: number | null
          id?: string
          is_custom_pricing?: boolean | null
          markup_percentage?: number | null
          service_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          custom_price_per_unit?: number | null
          id?: string
          is_custom_pricing?: boolean | null
          markup_percentage?: number | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_pricing_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_pricing_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_service_assignments: {
        Row: {
          admin_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          is_enabled: boolean
          service_id: string
        }
        Insert: {
          admin_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_enabled?: boolean
          service_id: string
        }
        Update: {
          admin_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_enabled?: boolean
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_service_assignments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_service_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          commission_rate: number | null
          company_name: string
          company_website: string | null
          created_at: string
          created_by: string | null
          custom_domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          monthly_revenue: number | null
          primary_color: string | null
          secondary_color: string | null
          total_clients: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          company_name: string
          company_website?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          monthly_revenue?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          total_clients?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          company_name?: string
          company_website?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          monthly_revenue?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          total_clients?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          ai_summary: string | null
          call_type: Database["public"]["Enums"]["call_type"] | null
          caller_id: string | null
          client_id: string
          completed_at: string | null
          cost: number | null
          duration_seconds: number | null
          executed_at: string | null
          id: string
          metadata: Json | null
          phone_number: string
          recording_url: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["call_status"] | null
          transcript: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          call_type?: Database["public"]["Enums"]["call_type"] | null
          caller_id?: string | null
          client_id: string
          completed_at?: string | null
          cost?: number | null
          duration_seconds?: number | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          phone_number: string
          recording_url?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
          transcript?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          call_type?: Database["public"]["Enums"]["call_type"] | null
          caller_id?: string | null
          client_id?: string
          completed_at?: string | null
          cost?: number | null
          duration_seconds?: number | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string
          recording_url?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
          transcript?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "client_workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          call_log_id: string | null
          call_status: Database["public"]["Enums"]["contact_call_status"] | null
          campaign_id: string
          contact_data: Json | null
          contact_name: string | null
          created_at: string
          id: string
          phone_number: string
        }
        Insert: {
          call_log_id?: string | null
          call_status?:
          | Database["public"]["Enums"]["contact_call_status"]
          | null
          campaign_id: string
          contact_data?: Json | null
          contact_name?: string | null
          created_at?: string
          id?: string
          phone_number: string
        }
        Update: {
          call_log_id?: string | null
          call_status?:
          | Database["public"]["Enums"]["contact_call_status"]
          | null
          campaign_id?: string
          contact_data?: Json | null
          contact_name?: string | null
          created_at?: string
          id?: string
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      client_services: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_coming_soon_unlocked: boolean
          last_reset_at: string | null
          plan_id: string | null
          reset_period: Database["public"]["Enums"]["reset_period"] | null
          service_id: string
          updated_at: string
          usage_consumed: number | null
          usage_limit: number
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_coming_soon_unlocked?: boolean
          is_active?: boolean | null
          last_reset_at?: string | null
          plan_id?: string | null
          reset_period?: Database["public"]["Enums"]["reset_period"] | null
          service_id: string
          updated_at?: string
          usage_consumed?: number | null
          usage_limit?: number
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string | null
          is_coming_soon_unlocked?: boolean
          id?: string
          is_active?: boolean | null
          last_reset_at?: string | null
          plan_id?: string | null
          reset_period?: Database["public"]["Enums"]["reset_period"] | null
          service_id?: string
          updated_at?: string
          usage_consumed?: number | null
          usage_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_services_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workflow_credentials: {
        Row: {
          client_workflow_instance_id: string
          configured_at: string | null
          created_at: string
          credential_name: string
          credential_status:
          | Database["public"]["Enums"]["credential_status"]
          | null
          credential_type: string
          expires_at: string | null
          id: string
          last_validated_at: string | null
          n8n_credential_id: string | null
          updated_at: string
        }
        Insert: {
          client_workflow_instance_id: string
          configured_at?: string | null
          created_at?: string
          credential_name: string
          credential_status?:
          | Database["public"]["Enums"]["credential_status"]
          | null
          credential_type: string
          expires_at?: string | null
          id?: string
          last_validated_at?: string | null
          n8n_credential_id?: string | null
          updated_at?: string
        }
        Update: {
          client_workflow_instance_id?: string
          configured_at?: string | null
          created_at?: string
          credential_name?: string
          credential_status?:
          | Database["public"]["Enums"]["credential_status"]
          | null
          credential_type?: string
          expires_at?: string | null
          id?: string
          last_validated_at?: string | null
          n8n_credential_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_workflow_credentials_client_workflow_instance_id_fkey"
            columns: ["client_workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "client_workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workflow_instances: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          custom_config: Json | null
          error_message: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          n8n_workflow_id: string
          service_id: string
          status: Database["public"]["Enums"]["workflow_status"] | null
          test_webhook_url: string | null
          updated_at: string
          webhook_url: string | null
          workflow_name: string
          workflow_template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          custom_config?: Json | null
          error_message?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          n8n_workflow_id: string
          service_id: string
          status?: Database["public"]["Enums"]["workflow_status"] | null
          test_webhook_url?: string | null
          updated_at?: string
          webhook_url?: string | null
          workflow_name: string
          workflow_template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          custom_config?: Json | null
          error_message?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          n8n_workflow_id?: string
          service_id?: string
          status?: Database["public"]["Enums"]["workflow_status"] | null
          test_webhook_url?: string | null
          updated_at?: string
          webhook_url?: string | null
          workflow_name?: string
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workflow_instances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workflow_instances_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          admin_id: string
          allow_admin_raw_access: boolean | null
          company_name: string
          company_size: Database["public"]["Enums"]["company_size"] | null
          created_at: string
          id: string
          industry: string | null
          is_active: boolean
          notification_preferences: Json | null
          onboarded_at: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          admin_id: string
          allow_admin_raw_access?: boolean | null
          company_name: string
          company_size?: Database["public"]["Enums"]["company_size"] | null
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          notification_preferences?: Json | null
          onboarded_at?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          admin_id?: string
          allow_admin_raw_access?: boolean | null
          company_name?: string
          company_size?: Database["public"]["Enums"]["company_size"] | null
          created_at?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          notification_preferences?: Json | null
          onboarded_at?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          admin_id: string
          client_id: string
          created_at: string
          id: string
          is_archived: boolean | null
        }
        Insert: {
          admin_id: string
          client_id: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
        }
        Update: {
          admin_id?: string
          client_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string | null
          id: string
          level: string
          message: string
          meta: Json | null
          timestamp: string
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: string
          message: string
          meta?: Json | null
          timestamp: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          meta?: Json | null
          timestamp?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          service_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          service_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          service_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          admin_id: string | null
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
        }
        Insert: {
          admin_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Update: {
          admin_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          call_log_id: string | null
          campaign_id: string | null
          client_id: string
          company: string | null
          created_at: string
          designation: string | null
          email: string | null
          follow_up_date: string | null
          id: string
          interest_level: number | null
          lead_score: number | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          metadata: Json | null
          name: string | null
          notes: string | null
          phone: string
          status: Database["public"]["Enums"]["lead_status"] | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          call_log_id?: string | null
          campaign_id?: string | null
          client_id: string
          company?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          interest_level?: number | null
          lead_score?: number | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone: string
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          call_log_id?: string | null
          campaign_id?: string | null
          client_id?: string
          company?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          interest_level?: number | null
          lead_score?: number | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          file_url: string | null
          id: string
          is_read: boolean | null
          message_content: string
          message_type: Database["public"]["Enums"]["message_type"]
          read_at: string | null
          receiver_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          conversation_id: string
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_content: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          receiver_id: string
          sender_id: string
          sent_at?: string
        }
        Update: {
          conversation_id?: string
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_content?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_plans: {
        Row: {
          created_at: string
          features_included: Json | null
          id: string
          is_active: boolean
          monthly_price: number | null
          plan_name: string
          plan_tier: Database["public"]["Enums"]["plan_tier"] | null
          price_per_unit: number | null
          service_id: string
          usage_limit: number | null
        }
        Insert: {
          created_at?: string
          features_included?: Json | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          plan_name: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          price_per_unit?: number | null
          service_id: string
          usage_limit?: number | null
        }
        Update: {
          created_at?: string
          features_included?: Json | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          plan_name?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          price_per_unit?: number | null
          service_id?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_purchase_requests: {
        Row: {
          admin_id: string
          client_id: string
          created_at: string
          id: string
          message: string | null
          plan_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          plan_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          plan_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_purchase_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          base_pricing_model: Database["public"]["Enums"]["pricing_model"]
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          created_by: string | null
          description: string | null
          features: Json | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          setup_instructions: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          base_price: number
          base_pricing_model: Database["public"]["Enums"]["pricing_model"]
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          setup_instructions?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          base_pricing_model?: Database["public"]["Enums"]["pricing_model"]
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          setup_instructions?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          client_id: string
          content: string
          created_at: string
          engagement_stats: Json | null
          error_message: string | null
          hashtags: string[] | null
          id: string
          media_urls: string[] | null
          platform: Database["public"]["Enums"]["social_platform"]
          platform_post_ids: Json | null
          post_type: Database["public"]["Enums"]["social_post_type"] | null
          posted_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["social_post_status"] | null
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          engagement_stats?: Json | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          platform: Database["public"]["Enums"]["social_platform"]
          platform_post_ids?: Json | null
          post_type?: Database["public"]["Enums"]["social_post_type"] | null
          posted_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"] | null
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          engagement_stats?: Json | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          platform?: Database["public"]["Enums"]["social_platform"]
          platform_post_ids?: Json | null
          post_type?: Database["public"]["Enums"]["social_post_type"] | null
          posted_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"] | null
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_posts_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "client_workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          client_id: string
          id: string
          metadata: Json | null
          quantity: number | null
          recorded_at: string | null
          service_id: string | null
          total_cost: number | null
          unit_cost: number | null
          usage_type: string
        }
        Insert: {
          client_id: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          recorded_at?: string | null
          service_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          usage_type: string
        }
        Update: {
          client_id?: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          recorded_at?: string | null
          service_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_tracking_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_campaigns: {
        Row: {
          campaign_name: string
          campaign_type: Database["public"]["Enums"]["campaign_type"] | null
          client_id: string
          completed_at: string | null
          contacts_answered: number | null
          contacts_called: number | null
          created_at: string
          id: string
          scheduled_at: string | null
          script: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          total_contacts: number | null
          updated_at: string
        }
        Insert: {
          campaign_name: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"] | null
          client_id: string
          completed_at?: string | null
          contacts_answered?: number | null
          contacts_called?: number | null
          created_at?: string
          id?: string
          scheduled_at?: string | null
          script?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          total_contacts?: number | null
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"] | null
          client_id?: string
          completed_at?: string | null
          contacts_answered?: number | null
          contacts_called?: number | null
          created_at?: string
          id?: string
          scheduled_at?: string | null
          script?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          total_contacts?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          campaign_name: string
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          message_template: string
          messages_delivered: number | null
          messages_sent: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["wa_campaign_status"] | null
          total_contacts: number | null
        }
        Insert: {
          campaign_name: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message_template: string
          messages_delivered?: number | null
          messages_sent?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["wa_campaign_status"] | null
          total_contacts?: number | null
        }
        Update: {
          campaign_name?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message_template?: string
          messages_delivered?: number | null
          messages_sent?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["wa_campaign_status"] | null
          total_contacts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          campaign_id: string | null
          client_id: string
          cost: number | null
          delivered_at: string | null
          error_message: string | null
          id: string
          media_url: string | null
          message_content: string
          message_type: Database["public"]["Enums"]["wa_message_type"] | null
          metadata: Json | null
          phone_number: string
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_message_status"] | null
          template_name: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          client_id: string
          cost?: number | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_content: string
          message_type?: Database["public"]["Enums"]["wa_message_type"] | null
          metadata?: Json | null
          phone_number: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"] | null
          template_name?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          client_id?: string
          cost?: number | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_content?: string
          message_type?: Database["public"]["Enums"]["wa_message_type"] | null
          metadata?: Json | null
          phone_number?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"] | null
          template_name?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "client_workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          client_id: string | null
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          error_stack: string | null
          executed_at: string | null
          execution_mode: Database["public"]["Enums"]["execution_mode"] | null
          id: string
          input_data: Json | null
          n8n_execution_id: string | null
          output_data: Json | null
          service_id: string | null
          status: Database["public"]["Enums"]["execution_status"] | null
          workflow_instance_id: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          executed_at?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"] | null
          id?: string
          input_data?: Json | null
          n8n_execution_id?: string | null
          output_data?: Json | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["execution_status"] | null
          workflow_instance_id: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          executed_at?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"] | null
          id?: string
          input_data?: Json | null
          n8n_execution_id?: string | null
          output_data?: Json | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["execution_status"] | null
          workflow_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "client_workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          credential_instructions: Json | null
          default_config: Json | null
          id: string
          is_active: boolean | null
          master_prompt: string | null
          n8n_template_workflow_id: string | null
          required_credentials: string[] | null
          service_id: string
          template_description: string | null
          template_name: string
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          credential_instructions?: Json | null
          default_config?: Json | null
          id?: string
          is_active?: boolean | null
          master_prompt?: string | null
          n8n_template_workflow_id?: string | null
          required_credentials?: string[] | null
          service_id: string
          template_description?: string | null
          template_name: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          credential_instructions?: Json | null
          default_config?: Json | null
          id?: string
          is_active?: boolean | null
          master_prompt?: string | null
          n8n_template_workflow_id?: string | null
          required_credentials?: string[] | null
          service_id?: string
          template_description?: string | null
          template_name?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campaign_stats: {
        Row: {
          avg_duration: number | null
          calls_answered_logs: number | null
          calls_failed: number | null
          calls_made: number | null
          campaign_id: string | null
          campaign_name: string | null
          client_id: string | null
          completed_at: string | null
          contacts_answered: number | null
          contacts_called: number | null
          created_at: string | null
          leads_generated: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          total_contacts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_old_notifications: { Args: never; Returns: undefined }
      get_admin_id_for_user: { Args: never; Returns: string }
      get_client_admin_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { p_amount: number; p_client_id: string; p_service_slug: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      reset_usage_if_needed: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "client"
      call_status:
      | "initiated"
      | "ringing"
      | "answered"
      | "busy"
      | "no_answer"
      | "failed"
      | "completed"
      call_type: "inbound" | "outbound"
      campaign_status:
      | "draft"
      | "scheduled"
      | "running"
      | "paused"
      | "completed"
      | "cancelled"
      campaign_type: "telecaller" | "receptionist" | "voice_agent"
      company_size: "1-10" | "11-50" | "51-200" | "201-500" | "500+"
      contact_call_status:
      | "pending"
      | "calling"
      | "answered"
      | "busy"
      | "failed"
      | "completed"
      credential_status: "pending" | "configured" | "expired" | "invalid"
      execution_mode: "manual" | "webhook" | "scheduled" | "trigger"
      execution_status:
      | "running"
      | "success"
      | "error"
      | "waiting"
      | "cancelled"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      lead_source: "voice_agent" | "telecaller" | "receptionist" | "manual"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      message_type: "text" | "file" | "system"
      notification_type: "info" | "success" | "warning" | "error"
      plan_tier: "basic" | "standard" | "premium" | "enterprise"
      pricing_model: "per_minute" | "per_call" | "per_message" | "monthly"
      reset_period: "daily" | "weekly" | "monthly" | "never"
      service_category: "voice" | "messaging" | "social_media"
      social_platform: "facebook" | "instagram" | "linkedin" | "twitter" | "all"
      social_post_status:
      | "draft"
      | "scheduled"
      | "publishing"
      | "posted"
      | "failed"
      social_post_type: "text" | "image" | "video" | "carousel" | "story"
      wa_campaign_status:
      | "draft"
      | "scheduled"
      | "sending"
      | "completed"
      | "cancelled"
      wa_message_status: "queued" | "sent" | "delivered" | "read" | "failed"
      wa_message_type:
      | "text"
      | "template"
      | "image"
      | "video"
      | "document"
      | "audio"
      workflow_status:
      | "pending"
      | "configured"
      | "active"
      | "error"
      | "suspended"
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
      app_role: ["super_admin", "admin", "client"],
      call_status: [
        "initiated",
        "ringing",
        "answered",
        "busy",
        "no_answer",
        "failed",
        "completed",
      ],
      call_type: ["inbound", "outbound"],
      campaign_status: [
        "draft",
        "scheduled",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
      campaign_type: ["telecaller", "receptionist", "voice_agent"],
      company_size: ["1-10", "11-50", "51-200", "201-500", "500+"],
      contact_call_status: [
        "pending",
        "calling",
        "answered",
        "busy",
        "failed",
        "completed",
      ],
      credential_status: ["pending", "configured", "expired", "invalid"],
      execution_mode: ["manual", "webhook", "scheduled", "trigger"],
      execution_status: ["running", "success", "error", "waiting", "cancelled"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      lead_source: ["voice_agent", "telecaller", "receptionist", "manual"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      message_type: ["text", "file", "system"],
      notification_type: ["info", "success", "warning", "error"],
      plan_tier: ["basic", "standard", "premium", "enterprise"],
      pricing_model: ["per_minute", "per_call", "per_message", "monthly"],
      reset_period: ["daily", "weekly", "monthly", "never"],
      service_category: ["voice", "messaging", "social_media"],
      social_platform: ["facebook", "instagram", "linkedin", "twitter", "all"],
      social_post_status: [
        "draft",
        "scheduled",
        "publishing",
        "posted",
        "failed",
      ],
      social_post_type: ["text", "image", "video", "carousel", "story"],
      wa_campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "completed",
        "cancelled",
      ],
      wa_message_status: ["queued", "sent", "delivered", "read", "failed"],
      wa_message_type: [
        "text",
        "template",
        "image",
        "video",
        "document",
        "audio",
      ],
      workflow_status: [
        "pending",
        "configured",
        "active",
        "error",
        "suspended",
      ],
    },
  },
} as const
