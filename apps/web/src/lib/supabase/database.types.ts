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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_interactions: {
        Row: {
          case_id: string | null
          cost: number | null
          created_at: string | null
          id: string
          interaction_type: string | null
          model_used: string | null
          organization_id: string | null
          performance_metrics: Json | null
          prompt: string | null
          response: string | null
          tokens_used: number | null
        }
        Insert: {
          case_id?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          model_used?: string | null
          organization_id?: string | null
          performance_metrics?: Json | null
          prompt?: string | null
          response?: string | null
          tokens_used?: number | null
        }
        Update: {
          case_id?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          model_used?: string | null
          organization_id?: string | null
          performance_metrics?: Json | null
          prompt?: string | null
          response?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          organization_id: string | null
          properties: Json | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          properties?: Json | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          properties?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_cases: {
        Row: {
          ai_strategy: Json | null
          assigned_to: string | null
          created_at: string | null
          current_stage: number | null
          debtor_id: string | null
          escalation_date: string | null
          id: string
          invoice_ids: string[]
          last_contact_date: string | null
          metadata: Json | null
          next_action_date: string | null
          notes: string | null
          organization_id: string | null
          outstanding_amount: number
          payment_promise_date: string | null
          priority: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          ai_strategy?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          current_stage?: number | null
          debtor_id?: string | null
          escalation_date?: string | null
          id?: string
          invoice_ids: string[]
          last_contact_date?: string | null
          metadata?: Json | null
          next_action_date?: string | null
          notes?: string | null
          organization_id?: string | null
          outstanding_amount: number
          payment_promise_date?: string | null
          priority?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          ai_strategy?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          current_stage?: number | null
          debtor_id?: string | null
          escalation_date?: string | null
          id?: string
          invoice_ids?: string[]
          last_contact_date?: string | null
          metadata?: Json | null
          next_action_date?: string | null
          notes?: string | null
          organization_id?: string | null
          outstanding_amount?: number
          payment_promise_date?: string | null
          priority?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cases_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cases_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "collection_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_workflows: {
        Row: {
          created_at: string | null
          debtor_segment: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          stages: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          debtor_segment?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          stages: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          debtor_segment?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          stages?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          ai_generated: boolean | null
          case_id: string | null
          channel: string
          content: string | null
          created_at: string | null
          debtor_id: string | null
          direction: string
          id: string
          intent_classification: string | null
          metadata: Json | null
          organization_id: string | null
          response_required: boolean | null
          sentiment_score: number | null
          status: string | null
          subject: string | null
          updated_at: string | null
          zapier_task_id: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          case_id?: string | null
          channel: string
          content?: string | null
          created_at?: string | null
          debtor_id?: string | null
          direction: string
          id?: string
          intent_classification?: string | null
          metadata?: Json | null
          organization_id?: string | null
          response_required?: boolean | null
          sentiment_score?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          zapier_task_id?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          case_id?: string | null
          channel?: string
          content?: string | null
          created_at?: string | null
          debtor_id?: string | null
          direction?: string
          id?: string
          intent_classification?: string | null
          metadata?: Json | null
          organization_id?: string | null
          response_required?: boolean | null
          sentiment_score?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          zapier_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      debtors: {
        Row: {
          address: Json | null
          behavioral_score: number | null
          company_name: string
          company_type: string | null
          country: string | null
          created_at: string | null
          id: string
          language_preference: string | null
          metadata: Json | null
          organization_id: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          risk_profile: string | null
          secondary_contacts: Json | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          behavioral_score?: number | null
          company_name: string
          company_type?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          language_preference?: string | null
          metadata?: Json | null
          organization_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          risk_profile?: string | null
          secondary_contacts?: Json | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          behavioral_score?: number | null
          company_name?: string
          company_type?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          language_preference?: string | null
          metadata?: Json | null
          organization_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          risk_profile?: string | null
          secondary_contacts?: Json | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debtors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          debtor_id: string | null
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          line_items: Json | null
          organization_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          debtor_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          line_items?: Json | null
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          debtor_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          line_items?: Json | null
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          settings: Json | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          settings?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          settings?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          case_id: string | null
          created_at: string | null
          currency: string | null
          debtor_id: string | null
          id: string
          invoice_ids: string[] | null
          metadata: Json | null
          organization_id: string | null
          payment_method: string | null
          processed_at: string | null
          reference_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          case_id?: string | null
          created_at?: string | null
          currency?: string | null
          debtor_id?: string | null
          id?: string
          invoice_ids?: string[] | null
          metadata?: Json | null
          organization_id?: string | null
          payment_method?: string | null
          processed_at?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          case_id?: string | null
          created_at?: string | null
          currency?: string | null
          debtor_id?: string | null
          id?: string
          invoice_ids?: string[] | null
          metadata?: Json | null
          organization_id?: string | null
          payment_method?: string | null
          processed_at?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          preferences: Json | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
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
      [_ in never]: never
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