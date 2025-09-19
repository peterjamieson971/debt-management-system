export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          email: string
          settings: Record<string, any>
          subscription_tier: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          settings?: Record<string, any>
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          settings?: Record<string, any>
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: string
          full_name: string | null
          preferences: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: string
          full_name?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role?: string
          full_name?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      debtors: {
        Row: {
          id: string
          organization_id: string
          company_name: string
          company_type: string | null
          primary_contact_name: string | null
          primary_contact_email: string | null
          primary_contact_phone: string | null
          secondary_contacts: any[]
          address: Record<string, any> | null
          country: string | null
          language_preference: string
          risk_profile: string
          behavioral_score: number
          tags: string[]
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          company_name: string
          company_type?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          secondary_contacts?: any[]
          address?: Record<string, any> | null
          country?: string | null
          language_preference?: string
          risk_profile?: string
          behavioral_score?: number
          tags?: string[]
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          company_name?: string
          company_type?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          secondary_contacts?: any[]
          address?: Record<string, any> | null
          country?: string | null
          language_preference?: string
          risk_profile?: string
          behavioral_score?: number
          tags?: string[]
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          debtor_id: string
          invoice_number: string
          amount: number
          currency: string
          issue_date: string
          due_date: string
          description: string | null
          line_items: any[]
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          debtor_id: string
          invoice_number: string
          amount: number
          currency?: string
          issue_date: string
          due_date: string
          description?: string | null
          line_items?: any[]
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          debtor_id?: string
          invoice_number?: string
          amount?: number
          currency?: string
          issue_date?: string
          due_date?: string
          description?: string | null
          line_items?: any[]
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      collection_cases: {
        Row: {
          id: string
          organization_id: string
          debtor_id: string
          invoice_ids: string[]
          total_amount: number
          outstanding_amount: number
          status: string
          priority: string
          assigned_to: string | null
          workflow_id: string | null
          current_stage: number
          ai_strategy: Record<string, any>
          payment_promise_date: string | null
          last_contact_date: string | null
          next_action_date: string | null
          escalation_date: string | null
          notes: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          debtor_id: string
          invoice_ids: string[]
          total_amount: number
          outstanding_amount: number
          status?: string
          priority?: string
          assigned_to?: string | null
          workflow_id?: string | null
          current_stage?: number
          ai_strategy?: Record<string, any>
          payment_promise_date?: string | null
          last_contact_date?: string | null
          next_action_date?: string | null
          escalation_date?: string | null
          notes?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          debtor_id?: string
          invoice_ids?: string[]
          total_amount?: number
          outstanding_amount?: number
          status?: string
          priority?: string
          assigned_to?: string | null
          workflow_id?: string | null
          current_stage?: number
          ai_strategy?: Record<string, any>
          payment_promise_date?: string | null
          last_contact_date?: string | null
          next_action_date?: string | null
          escalation_date?: string | null
          notes?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      collection_workflows: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          debtor_segment: string | null
          stages: any[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          debtor_segment?: string | null
          stages: any[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          debtor_segment?: string | null
          stages?: any[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      communication_logs: {
        Row: {
          id: string
          organization_id: string
          case_id: string
          debtor_id: string
          channel: string
          direction: string
          status: string
          subject: string | null
          content: string | null
          ai_generated: boolean
          sentiment_score: number | null
          intent_classification: string | null
          response_required: boolean
          zapier_task_id: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          case_id: string
          debtor_id: string
          channel: string
          direction: string
          status?: string
          subject?: string | null
          content?: string | null
          ai_generated?: boolean
          sentiment_score?: number | null
          intent_classification?: string | null
          response_required?: boolean
          zapier_task_id?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          case_id?: string
          debtor_id?: string
          channel?: string
          direction?: string
          status?: string
          subject?: string | null
          content?: string | null
          ai_generated?: boolean
          sentiment_score?: number | null
          intent_classification?: string | null
          response_required?: boolean
          zapier_task_id?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          organization_id: string
          case_id: string | null
          debtor_id: string
          invoice_ids: string[] | null
          amount: number
          currency: string
          payment_method: string | null
          reference_number: string | null
          status: string
          processed_at: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          case_id?: string | null
          debtor_id: string
          invoice_ids?: string[] | null
          amount: number
          currency?: string
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          processed_at?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          case_id?: string | null
          debtor_id?: string
          invoice_ids?: string[] | null
          amount?: number
          currency?: string
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          processed_at?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      ai_interactions: {
        Row: {
          id: string
          organization_id: string
          case_id: string | null
          interaction_type: string | null
          prompt: string | null
          response: string | null
          model_used: string | null
          tokens_used: number | null
          cost: number | null
          performance_metrics: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          case_id?: string | null
          interaction_type?: string | null
          prompt?: string | null
          response?: string | null
          model_used?: string | null
          tokens_used?: number | null
          cost?: number | null
          performance_metrics?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          case_id?: string | null
          interaction_type?: string | null
          prompt?: string | null
          response?: string | null
          model_used?: string | null
          tokens_used?: number | null
          cost?: number | null
          performance_metrics?: Record<string, any>
          created_at?: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          organization_id: string
          event_type: string
          entity_type: string | null
          entity_id: string | null
          properties: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          event_type: string
          entity_type?: string | null
          entity_id?: string | null
          properties?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          event_type?: string
          entity_type?: string | null
          entity_id?: string | null
          properties?: Record<string, any>
          created_at?: string
        }
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
  }
}