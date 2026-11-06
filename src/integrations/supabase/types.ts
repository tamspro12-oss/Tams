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
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          target_id: string
          target_name: string
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id: string
          target_name: string
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string
          target_name?: string
          target_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      agencies: {
        Row: {
          contact_email: string | null
          contact_info: string | null
          created_at: string | null
          email: string | null
          email_cleanup_enabled: boolean | null
          email_cleanup_frequency: string | null
          email_cleanup_keep_days: number | null
          email_password: string | null
          id: string
          license_active: boolean | null
          license_expiry: string | null
          license_key: string
          license_status: string | null
          max_storage_bytes: number | null
          name: string
          phone_number: string | null
          subscription_plan: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_info?: string | null
          created_at?: string | null
          email?: string | null
          email_cleanup_enabled?: boolean | null
          email_cleanup_frequency?: string | null
          email_cleanup_keep_days?: number | null
          email_password?: string | null
          id?: string
          license_active?: boolean | null
          license_expiry?: string | null
          license_key: string
          license_status?: string | null
          max_storage_bytes?: number | null
          name: string
          phone_number?: string | null
          subscription_plan?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_info?: string | null
          created_at?: string | null
          email?: string | null
          email_cleanup_enabled?: boolean | null
          email_cleanup_frequency?: string | null
          email_cleanup_keep_days?: number | null
          email_password?: string | null
          id?: string
          license_active?: boolean | null
          license_expiry?: string | null
          license_key?: string
          license_status?: string | null
          max_storage_bytes?: number | null
          name?: string
          phone_number?: string | null
          subscription_plan?: string | null
        }
        Relationships: []
      }
      agency_banks: {
        Row: {
          account_number: string | null
          account_title: string | null
          agency_id: string
          bank_name: string
          branch_name: string | null
          created_at: string
          id: string
          is_active: boolean
          opening_balance: number | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_title?: string | null
          agency_id: string
          bank_name: string
          branch_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          opening_balance?: number | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_title?: string | null
          agency_id?: string
          bank_name?: string
          branch_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          opening_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_banks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_agents: {
        Row: {
          agency_id: string
          agent_name: string
          business_name: string | null
          city: string | null
          commission_type: string
          commission_value: number | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          agent_name: string
          business_name?: string | null
          city?: string | null
          commission_type?: string
          commission_value?: number | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          agent_name?: string
          business_name?: string | null
          city?: string | null
          commission_type?: string
          commission_value?: number | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_agents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_bookings: {
        Row: {
          agency_id: string
          agent_id: string
          airline: string | null
          booking_status: string | null
          commission_amount: number | null
          created_at: string | null
          destination: string | null
          flight_date: string | null
          id: string
          notes: string | null
          passenger_contact: string | null
          passenger_name: string
          passenger_passport: string | null
          payment_status: string | null
          pnr: string | null
          profit: number | null
          purchasing_price: number | null
          selling_price: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          agency_id: string
          agent_id: string
          airline?: string | null
          booking_status?: string | null
          commission_amount?: number | null
          created_at?: string | null
          destination?: string | null
          flight_date?: string | null
          id?: string
          notes?: string | null
          passenger_contact?: string | null
          passenger_name: string
          passenger_passport?: string | null
          payment_status?: string | null
          pnr?: string | null
          profit?: number | null
          purchasing_price?: number | null
          selling_price?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string
          airline?: string | null
          booking_status?: string | null
          commission_amount?: number | null
          created_at?: string | null
          destination?: string | null
          flight_date?: string | null
          id?: string
          notes?: string | null
          passenger_contact?: string | null
          passenger_name?: string
          passenger_passport?: string | null
          payment_status?: string | null
          pnr?: string | null
          profit?: number | null
          purchasing_price?: number | null
          selling_price?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_bookings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "b2b_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_ledger: {
        Row: {
          agency_id: string
          agent_id: string
          amount: number
          bank_name: string | null
          created_at: string | null
          entry_date: string
          entry_type: string
          id: string
          payment_mode: string | null
          remarks: string | null
        }
        Insert: {
          agency_id: string
          agent_id: string
          amount: number
          bank_name?: string | null
          created_at?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          payment_mode?: string | null
          remarks?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          payment_mode?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_ledger_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_ledger_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "b2b_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agency_id: string
          booking_type: string | null
          client_id: string
          created_at: string | null
          discount_amount: number | null
          flight_date: string
          id: string
          name_update_date: string | null
          notes: string | null
          payment_status: string | null
          pnr: string
          seat_class: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          booking_type?: string | null
          client_id: string
          created_at?: string | null
          discount_amount?: number | null
          flight_date: string
          id?: string
          name_update_date?: string | null
          notes?: string | null
          payment_status?: string | null
          pnr: string
          seat_class?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          booking_type?: string | null
          client_id?: string
          created_at?: string | null
          discount_amount?: number | null
          flight_date?: string
          id?: string
          name_update_date?: string | null
          notes?: string | null
          payment_status?: string | null
          pnr?: string
          seat_class?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_bank_entries: {
        Row: {
          agency_id: string
          amount: number
          bank_name: string | null
          category: string | null
          created_at: string
          description: string | null
          entry_date: string
          entry_type: string
          id: string
          payment_mode: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount: number
          bank_name?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          payment_mode?: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          bank_name?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          payment_mode?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_bank_entries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_history: {
        Row: {
          agency_id: string
          bank_name: string | null
          client_id: string
          created_at: string | null
          id: string
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_mode: string | null
          payment_type: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          bank_name?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount: number
          payment_date?: string
          payment_mode?: string | null
          payment_type: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          bank_name?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_mode?: string | null
          payment_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          airline: string | null
          amount_paid: number | null
          cnic: string | null
          contact_number: string | null
          contact_person: string | null
          created_at: string | null
          destination: string | null
          email: string | null
          flight_date: string | null
          group_booking_type: string | null
          group_size: number | null
          id: string
          name: string
          name_update_date: string | null
          notes: string | null
          passengers_data: Json | null
          passport_number: string | null
          payment_amount: number | null
          payment_status: string | null
          pnr: string | null
          purchasing_price: number | null
          remaining_payment_date: string | null
          selling_price: number | null
          travel_type: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          agency_id: string
          airline?: string | null
          amount_paid?: number | null
          cnic?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          destination?: string | null
          email?: string | null
          flight_date?: string | null
          group_booking_type?: string | null
          group_size?: number | null
          id?: string
          name: string
          name_update_date?: string | null
          notes?: string | null
          passengers_data?: Json | null
          passport_number?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          pnr?: string | null
          purchasing_price?: number | null
          remaining_payment_date?: string | null
          selling_price?: number | null
          travel_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          agency_id?: string
          airline?: string | null
          amount_paid?: number | null
          cnic?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          destination?: string | null
          email?: string | null
          flight_date?: string | null
          group_booking_type?: string | null
          group_size?: number | null
          id?: string
          name?: string
          name_update_date?: string | null
          notes?: string | null
          passengers_data?: Json | null
          passport_number?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          pnr?: string | null
          purchasing_price?: number | null
          remaining_payment_date?: string | null
          selling_price?: number | null
          travel_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          retry_count: number | null
          sent_at: string | null
          sent_by: string
          status: string
          subject: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          retry_count?: number | null
          sent_at?: string | null
          sent_by: string
          status?: string
          subject: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          retry_count?: number | null
          sent_at?: string | null
          sent_by?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          agency_id: string
          amount: number
          bank_name: string | null
          created_at: string | null
          expense_date: string
          expense_type: string
          id: string
          is_paid: boolean | null
          is_recurring: boolean | null
          notes: string | null
          paid_date: string | null
          payment_mode: string | null
          recurring_frequency: string | null
          recurring_parent_id: string | null
        }
        Insert: {
          agency_id: string
          amount: number
          bank_name?: string | null
          created_at?: string | null
          expense_date: string
          expense_type: string
          id?: string
          is_paid?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_date?: string | null
          payment_mode?: string | null
          recurring_frequency?: string | null
          recurring_parent_id?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          is_paid?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_date?: string | null
          payment_mode?: string | null
          recurring_frequency?: string | null
          recurring_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_parent_id_fkey"
            columns: ["recurring_parent_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          agency_id: string
          created_at: string | null
          expires_at: string | null
          filename: string
          id: string
          is_temporary: boolean | null
          path: string
          size_bytes: number
          uploaded_by: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          expires_at?: string | null
          filename: string
          id?: string
          is_temporary?: boolean | null
          path: string
          size_bytes: number
          uploaded_by: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          expires_at?: string | null
          filename?: string
          id?: string
          is_temporary?: boolean | null
          path?: string
          size_bytes?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_tokens: {
        Row: {
          access_token: string | null
          agency_id: string
          connected_at: string | null
          created_at: string | null
          drive_folder_id: string | null
          id: string
          last_synced_at: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          agency_id: string
          connected_at?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          agency_id?: string
          connected_at?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          additional_notes: string | null
          agency_id: string
          amount: number
          amount_paid: number
          balance_due: number
          client_id: string
          created_at: string | null
          generated_by: string
          id: string
          invoice_date: string
          invoice_number: string
          item_description: string
          pdf_data: Json | null
          updated_at: string | null
        }
        Insert: {
          additional_notes?: string | null
          agency_id: string
          amount?: number
          amount_paid?: number
          balance_due?: number
          client_id: string
          created_at?: string | null
          generated_by: string
          id?: string
          invoice_date?: string
          invoice_number: string
          item_description: string
          pdf_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          additional_notes?: string | null
          agency_id?: string
          amount?: number
          amount_paid?: number
          balance_due?: number
          client_id?: string
          created_at?: string | null
          generated_by?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          item_description?: string
          pdf_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      opening_balances: {
        Row: {
          agency_id: string
          amount: number
          as_of_date: string
          balance_type: string
          created_at: string | null
          id: string
          notes: string | null
          party_id: string
          party_type: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          amount?: number
          as_of_date?: string
          balance_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          party_id: string
          party_type: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          as_of_date?: string
          balance_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          party_id?: string
          party_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      policy_acknowledgments: {
        Row: {
          acknowledged_at: string
          created_at: string | null
          id: string
          privacy_policy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          created_at?: string | null
          id?: string
          privacy_policy_version?: string
          terms_version?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          created_at?: string | null
          id?: string
          privacy_policy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          created_at: string | null
          full_name: string
          id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          full_name: string
          id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      queries: {
        Row: {
          agency_id: string
          assigned_to: string | null
          client_name: string
          completed_at: string | null
          contact_number: string | null
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          priority: string | null
          query_text: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          client_name: string
          completed_at?: string | null
          contact_number?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          query_text: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          client_name?: string
          completed_at?: string | null
          contact_number?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          query_text?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotations: {
        Row: {
          agency_id: string
          agent_id: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount: number
          id: string
          items: Json
          notes: string | null
          quotation_date: string
          quotation_number: string
          service_type: string
          source: string | null
          source_ref: Json | null
          status: string
          subtotal: number
          tax: number
          terms: string | null
          title: string | null
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          agency_id: string
          agent_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_date?: string
          quotation_number: string
          service_type?: string
          source?: string | null
          source_ref?: Json | null
          status?: string
          subtotal?: number
          tax?: number
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_date?: string
          quotation_number?: string
          service_type?: string
          source?: string | null
          source_ref?: Json | null
          status?: string
          subtotal?: number
          tax?: number
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          agency_id: string
          bank_name: string | null
          booking_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_mode: string | null
          reason: string | null
          refund_amount: number
          refund_date: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          bank_name?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string | null
          reason?: string | null
          refund_amount: number
          refund_date?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          bank_name?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string | null
          reason?: string | null
          refund_amount?: number
          refund_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sub_users: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity: string | null
          last_login: string | null
          main_user_id: string
          permissions: Json
          sub_id_code: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          last_login?: string | null
          main_user_id: string
          permissions?: Json
          sub_id_code: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          last_login?: string | null
          main_user_id?: string
          permissions?: Json
          sub_id_code?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
      vendor_payment_history: {
        Row: {
          agency_id: string
          bank_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_mode: string | null
          payment_type: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          agency_id: string
          bank_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount: number
          payment_date?: string
          payment_mode?: string | null
          payment_type: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          agency_id?: string
          bank_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_mode?: string | null
          payment_type?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payment_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          agency_id: string
          amount_paid: number | null
          booking_date: string | null
          contact_number: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_amount: number | null
          payment_status: string | null
          service_type: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          amount_paid?: number | null
          booking_date?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          service_type?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          amount_paid?: number | null
          booking_date?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          service_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agency_smtp_configured: { Args: never; Returns: boolean }
      can_upload_file: {
        Args: { p_agency_id: string; p_file_size: number }
        Returns: boolean
      }
      count_sub_users: { Args: { _main_user_id: string }; Returns: number }
      current_user_agency_id: { Args: never; Returns: string }
      delete_all_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      delete_user_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      get_active_session_counts: {
        Args: never
        Returns: {
          session_count: number
          user_id: string
        }[]
      }
      get_agency_smtp_password: { Args: never; Returns: string }
      get_agency_storage_usage: {
        Args: { p_agency_id: string }
        Returns: number
      }
      get_main_user_id: { Args: { _user_id: string }; Returns: string }
      get_user_active_sessions: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          ip: string
          not_after: string
          user_agent: string
        }[]
      }
      has_module_permission: {
        Args: { _action?: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_sub_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
