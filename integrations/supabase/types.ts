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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_programs: {
        Row: {
          activity_id: string
          created_at: string
          organization_id: string
          program_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          organization_id: string
          program_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          organization_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_programs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "service_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_logs: {
        Row: {
          case_note_id: string | null
          created_at: string
          department_id: string | null
          error_message: string | null
          id: string
          model: string | null
          operation: string
          organization_id: string | null
          provider: string
          status: string
          user_id: string | null
        }
        Insert: {
          case_note_id?: string | null
          created_at?: string
          department_id?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          operation: string
          organization_id?: string | null
          provider: string
          status: string
          user_id?: string | null
        }
        Update: {
          case_note_id?: string | null
          created_at?: string
          department_id?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          operation?: string
          organization_id?: string | null
          provider?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_logs_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: false
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string
          client_id: string
          client_note: string | null
          created_at: string
          department_id: string | null
          ends_at: string
          id: string
          location: string | null
          meeting_link: string | null
          organization_id: string
          outlook_event_id: string | null
          outlook_sync_error: string | null
          starts_at: string
          status: string
          updated_at: string
          worker_id: string | null
          worker_note: string | null
        }
        Insert: {
          appointment_type?: string
          client_id: string
          client_note?: string | null
          created_at?: string
          department_id?: string | null
          ends_at: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          organization_id: string
          outlook_event_id?: string | null
          outlook_sync_error?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          worker_id?: string | null
          worker_note?: string | null
        }
        Update: {
          appointment_type?: string
          client_id?: string
          client_note?: string | null
          created_at?: string
          department_id?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          organization_id?: string
          outlook_event_id?: string | null
          outlook_sync_error?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          worker_id?: string | null
          worker_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          department_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          department_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          department_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_note_versions: {
        Row: {
          case_note_id: string
          change_type: string
          changed_by: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          version_number: number
        }
        Insert: {
          case_note_id: string
          change_type: string
          changed_by?: string | null
          content: string
          created_at?: string
          id?: string
          organization_id: string
          version_number: number
        }
        Update: {
          case_note_id?: string
          change_type?: string
          changed_by?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_note_versions_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: false
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_note_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          appearance_note: string | null
          author_id: string
          bus_tokens: number | null
          child_client_ids: string[]
          childminding_count: number | null
          client_appearance: string | null
          client_date_of_birth: string | null
          client_id: string | null
          client_language: string | null
          created_at: string
          deleted_at: string | null
          department_id: string | null
          emergency_food: boolean | null
          final_note: string | null
          generated_note: string | null
          id: string
          interaction_date: string
          interaction_type: string
          interpretation_needed: boolean | null
          meal_provided: boolean | null
          note_format: string
          organization_id: string
          pr_info: string | null
          raw_input: string
          reviewed: boolean
          services_note: string | null
          status: Database["public"]["Enums"]["note_status"]
          time_spent_seconds: number | null
          transcription: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          appearance_note?: string | null
          author_id: string
          bus_tokens?: number | null
          child_client_ids?: string[]
          childminding_count?: number | null
          client_appearance?: string | null
          client_date_of_birth?: string | null
          client_id?: string | null
          client_language?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          emergency_food?: boolean | null
          final_note?: string | null
          generated_note?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          interpretation_needed?: boolean | null
          meal_provided?: boolean | null
          note_format?: string
          organization_id: string
          pr_info?: string | null
          raw_input?: string
          reviewed?: boolean
          services_note?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          time_spent_seconds?: number | null
          transcription?: string | null
          updated_at?: string
          version_number?: number
        }
        Update: {
          appearance_note?: string | null
          author_id?: string
          bus_tokens?: number | null
          child_client_ids?: string[]
          childminding_count?: number | null
          client_appearance?: string | null
          client_date_of_birth?: string | null
          client_id?: string | null
          client_language?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          emergency_food?: boolean | null
          final_note?: string | null
          generated_note?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          interpretation_needed?: boolean | null
          meal_provided?: boolean | null
          note_format?: string
          organization_id?: string
          pr_info?: string | null
          raw_input?: string
          reviewed?: boolean
          services_note?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          time_spent_seconds?: number | null
          transcription?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          document_type: string
          expiry_date: string | null
          id: string
          mime_type: string | null
          name: string
          organization_id: string
          review_notes: string | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          id?: string
          mime_type?: string | null
          name: string
          organization_id: string
          review_notes?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          review_notes?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          organization_id: string
          read_at: string | null
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          organization_id: string
          read_at?: string | null
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          read_at?: string | null
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          kind: string
          organization_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          organization_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrals: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          follow_up_date: string | null
          id: string
          notes: string | null
          organization_id: string
          reason: string
          referral_date: string
          referred_to: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          reason: string
          referral_date?: string
          referred_to: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          reason?: string
          referral_date?: string
          referred_to?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          accessibility_needs: string | null
          address: string | null
          arrival_date: string | null
          auth_user_id: string | null
          client_identifier: string
          communication_preferences: Json
          confidentiality_level: string
          consent_accepted_at: string | null
          consent_to_share: boolean
          contact_information: Json
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          emergency_contact: Json
          enrolled_program: string | null
          enrollment_date: string | null
          family_relationship: string | null
          first_name: string
          household: Json
          id: string
          immigration_status: string | null
          intake_data: Json
          intake_date: string | null
          last_name: string
          organization_id: string
          parent_client_id: string | null
          phone: string | null
          preferred_language: string
          preferred_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accessibility_needs?: string | null
          address?: string | null
          arrival_date?: string | null
          auth_user_id?: string | null
          client_identifier: string
          communication_preferences?: Json
          confidentiality_level?: string
          consent_accepted_at?: string | null
          consent_to_share?: boolean
          contact_information?: Json
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact?: Json
          enrolled_program?: string | null
          enrollment_date?: string | null
          family_relationship?: string | null
          first_name: string
          household?: Json
          id?: string
          immigration_status?: string | null
          intake_data?: Json
          intake_date?: string | null
          last_name: string
          organization_id: string
          parent_client_id?: string | null
          phone?: string | null
          preferred_language?: string
          preferred_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accessibility_needs?: string | null
          address?: string | null
          arrival_date?: string | null
          auth_user_id?: string | null
          client_identifier?: string
          communication_preferences?: Json
          confidentiality_level?: string
          consent_accepted_at?: string | null
          consent_to_share?: boolean
          contact_information?: Json
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact?: Json
          enrolled_program?: string | null
          enrollment_date?: string | null
          family_relationship?: string | null
          first_name?: string
          household?: Json
          id?: string
          immigration_status?: string | null
          intake_data?: Json
          intake_date?: string | null
          last_name?: string
          organization_id?: string
          parent_client_id?: string | null
          phone?: string | null
          preferred_language?: string
          preferred_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      counselling_monthly_reports: {
        Row: {
          answers: Json
          author_id: string
          client_id: string | null
          created_at: string
          department_id: string | null
          id: string
          interaction_date: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          author_id: string
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          interaction_date: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          author_id?: string
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          interaction_date?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselling_monthly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselling_monthly_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselling_monthly_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      counselling_reports: {
        Row: {
          answers: Json
          author_id: string
          case_note_id: string | null
          client_id: string | null
          created_at: string
          department_id: string | null
          id: string
          interaction_date: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          author_id: string
          case_note_id?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          interaction_date: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          author_id?: string
          case_note_id?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          interaction_date?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselling_reports_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: true
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselling_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselling_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselling_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          agency: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          role_title: string | null
          status: string
          team_size: string | null
        }
        Insert: {
          agency: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          role_title?: string | null
          status?: string
          team_size?: string | null
        }
        Update: {
          agency?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          role_title?: string | null
          status?: string
          team_size?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          author_id: string
          case_note_id: string | null
          client_id: string | null
          created_at: string
          department_id: string | null
          draft_data: Json
          id: string
          last_saved_at: string
          organization_id: string
          status: string
        }
        Insert: {
          author_id: string
          case_note_id?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          draft_data?: Json
          id?: string
          last_saved_at?: string
          organization_id: string
          status?: string
        }
        Update: {
          author_id?: string
          case_note_id?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          draft_data?: Json
          id?: string
          last_saved_at?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: false
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_tasks: {
        Row: {
          assigned_to: string
          case_note_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          due_date: string
          id: string
          organization_id: string
          recurrence: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          case_note_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          organization_id: string
          recurrence?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          case_note_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          organization_id?: string
          recurrence?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_tasks_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: false
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_attendees: {
        Row: {
          attendance: string
          bus_tokens: number | null
          child_client_ids: string[]
          childminding_count: number | null
          client_id: string
          client_language: string | null
          created_at: string
          date_of_birth: string | null
          emergency_food: boolean | null
          id: string
          interpretation_needed: boolean | null
          meal_provided: boolean | null
          note: string | null
          organization_id: string
          pr_info: string | null
          session_id: string
        }
        Insert: {
          attendance?: string
          bus_tokens?: number | null
          child_client_ids?: string[]
          childminding_count?: number | null
          client_id: string
          client_language?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_food?: boolean | null
          id?: string
          interpretation_needed?: boolean | null
          meal_provided?: boolean | null
          note?: string | null
          organization_id: string
          pr_info?: string | null
          session_id: string
        }
        Update: {
          attendance?: string
          bus_tokens?: number | null
          child_client_ids?: string[]
          childminding_count?: number | null
          client_id?: string
          client_language?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_food?: boolean | null
          id?: string
          interpretation_needed?: boolean | null
          meal_provided?: boolean | null
          note?: string | null
          organization_id?: string
          pr_info?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_session_attendees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_attendees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          co_facilitators: string | null
          created_at: string
          created_by: string | null
          delivery_mode: string
          department_id: string | null
          duration_minutes: number | null
          facilitator_id: string | null
          facilitator_name: string | null
          id: string
          language: string | null
          location: string | null
          organization_id: string
          partner_organization: string | null
          session_date: string
          session_note: string | null
          session_type: string
          start_time: string | null
          status: string
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          co_facilitators?: string | null
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          department_id?: string | null
          duration_minutes?: number | null
          facilitator_id?: string | null
          facilitator_name?: string | null
          id?: string
          language?: string | null
          location?: string | null
          organization_id: string
          partner_organization?: string | null
          session_date: string
          session_note?: string | null
          session_type?: string
          start_time?: string | null
          status?: string
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          co_facilitators?: string | null
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          department_id?: string | null
          duration_minutes?: number | null
          facilitator_id?: string | null
          facilitator_name?: string | null
          id?: string
          language?: string | null
          location?: string | null
          organization_id?: string
          partner_organization?: string | null
          session_date?: string
          session_note?: string | null
          session_type?: string
          start_time?: string | null
          status?: string
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      immigration_status_options: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          system_defined: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          system_defined?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          system_defined?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "immigration_status_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_verification_codes: {
        Row: {
          attempts: number
          channel: string
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          active: boolean
          ai_instructions: string
          created_at: string
          department_id: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          sections: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_instructions?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_instructions?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_funders: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          reporting_designation: string | null
          submits_funder_report: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          reporting_designation?: string | null
          submits_funder_report?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          reporting_designation?: string | null
          submits_funder_report?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_funders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_code: string
          legal_name: string | null
          logo_url: string | null
          name: string
          primary_color: string
          secondary_color: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string
          secondary_color?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string
          secondary_color?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_owners: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          organization_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          job_title?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_funders: {
        Row: {
          created_at: string
          funder_id: string
          organization_id: string
          program_id: string
        }
        Insert: {
          created_at?: string
          funder_id: string
          organization_id: string
          program_id: string
        }
        Update: {
          created_at?: string
          funder_id?: string
          organization_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_funders_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "organization_funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_funders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_funders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_registrations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          program_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          program_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          program_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_registrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          capacity: number | null
          category: string
          contact_information: string | null
          created_at: string
          default_roles: string[]
          department_id: string | null
          description: string
          eligibility: string | null
          id: string
          languages: string[]
          location: string | null
          name: string
          note_type: string
          organization_id: string
          registration_required: boolean
          schedule: string | null
          updated_at: string
          visible_roles: string[]
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          category?: string
          contact_information?: string | null
          created_at?: string
          default_roles?: string[]
          department_id?: string | null
          description?: string
          eligibility?: string | null
          id?: string
          languages?: string[]
          location?: string | null
          name: string
          note_type?: string
          organization_id: string
          registration_required?: boolean
          schedule?: string | null
          updated_at?: string
          visible_roles?: string[]
        }
        Update: {
          active?: boolean
          capacity?: number | null
          category?: string
          contact_information?: string | null
          created_at?: string
          default_roles?: string[]
          department_id?: string | null
          description?: string
          eligibility?: string | null
          id?: string
          languages?: string[]
          location?: string | null
          name?: string
          note_type?: string
          organization_id?: string
          registration_required?: boolean
          schedule?: string | null
          updated_at?: string
          visible_roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          active: boolean
          contact_information: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          partner_type: string
          program_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_information?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          partner_type?: string
          program_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_information?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          partner_type?: string
          program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_partners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_partners_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_requests: {
        Row: {
          category: string
          client_id: string
          created_at: string
          department_id: string | null
          details: string
          id: string
          organization_id: string
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          client_id: string
          created_at?: string
          department_id?: string | null
          details?: string
          id?: string
          organization_id: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          department_id?: string | null
          details?: string
          id?: string
          organization_id?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_activities: {
        Row: {
          active: boolean
          applicable_to: string
          client_facing: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applicable_to?: string
          client_facing?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applicable_to?: string
          client_facing?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_feedback: {
        Row: {
          appointment_id: string | null
          client_id: string
          comments: string | null
          created_at: string
          id: string
          organization_id: string
          program_id: string | null
          rating: number
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          comments?: string | null
          created_at?: string
          id?: string
          organization_id: string
          program_id?: string | null
          rating: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          program_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_feedback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_feedback_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_monthly_reports: {
        Row: {
          author_id: string
          department_id: string
          id: string
          narrative: Json
          organization_id: string
          period_from: string
          period_to: string
          report_data: Json
          staff_name: string
          submitted_at: string
        }
        Insert: {
          author_id: string
          department_id: string
          id?: string
          narrative?: Json
          organization_id: string
          period_from: string
          period_to: string
          report_data?: Json
          staff_name: string
          submitted_at?: string
        }
        Update: {
          author_id?: string
          department_id?: string
          id?: string
          narrative?: Json
          organization_id?: string
          period_from?: string
          period_to?: string
          report_data?: Json
          staff_name?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_monthly_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_monthly_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_monthly_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcription_provider_blocks: {
        Row: {
          blocked_at: string
          message: string
          model: string
          status: number
        }
        Insert: {
          blocked_at?: string
          message: string
          model: string
          status?: number
        }
        Update: {
          blocked_at?: string
          message?: string
          model?: string
          status?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_client: { Args: { _client: string }; Returns: boolean }
      can_access_department: { Args: { _dept: string }; Returns: boolean }
      can_access_group_session: { Args: { _session: string }; Returns: boolean }
      can_access_shared_client: { Args: { _client: string }; Returns: boolean }
      can_access_shared_client_path: {
        Args: { _path: string }
        Returns: boolean
      }
      client_registration_identity_matches: {
        Args: {
          dob_a: string
          dob_b: string
          first_a: string
          first_b: string
          last_a: string
          last_b: string
        }
        Returns: boolean
      }
      current_client_id: { Args: never; Returns: string }
      current_client_org: { Args: never; Returns: string }
      current_department_id: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_manager: { Args: { _user_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      register_shared_client: { Args: { _data: Json }; Returns: Json }
      shared_client_directory: { Args: never; Returns: Json }
      shared_client_update: {
        Args: { _id: string; _patch: Json }
        Returns: undefined
      }
      user_department: { Args: { _uid: string }; Returns: string }
    }
    Enums: {
      app_role: "worker" | "manager" | "org_admin" | "system_admin"
      note_status: "draft" | "generated" | "final" | "deleted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["worker", "manager", "org_admin", "system_admin"],
      note_status: ["draft", "generated", "final", "deleted"],
    },
  },
} as const
