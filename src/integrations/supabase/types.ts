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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string
          feature: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          date: string
          id: string
          status: string
          subject_id: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          status: string
          subject_id: string
          user_id?: string
        }
        Update: {
          date?: string
          id?: string
          status?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          course: string | null
          description: string | null
          ends_at: string | null
          id: string
          kind: string
          source: string
          source_id: string | null
          starts_at: string
          title: string
          uid: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          course?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          source?: string
          source_id?: string | null
          starts_at: string
          title: string
          uid: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          course?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          source?: string
          source_id?: string | null
          starts_at?: string
          title?: string
          uid?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_sources: {
        Row: {
          color: string
          created_at: string
          ics_url: string | null
          id: string
          kind: string
          last_error: string | null
          last_sync: string | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          ics_url?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_sync?: string | null
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          ics_url?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_sync?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          end_time: string
          id: string
          room: string | null
          start_time: string
          subject_id: string
          user_id: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          subject_id: string
          user_id?: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          subject_id?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      google_accounts: {
        Row: {
          access_token_enc: string | null
          email: string | null
          expires_at: string | null
          refresh_token_enc: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          email?: string | null
          expires_at?: string | null
          refresh_token_enc: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          email?: string | null
          expires_at?: string | null
          refresh_token_enc?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grade_items: {
        Row: {
          created_at: string
          grade: number | null
          id: string
          max_grade: number
          name: string
          subject_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          grade?: number | null
          id?: string
          max_grade?: number
          name: string
          subject_id: string
          user_id?: string
          weight: number
        }
        Update: {
          created_at?: string
          grade?: number | null
          id?: string
          max_grade?: number
          name?: string
          subject_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          display_name: string
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          display_name?: string
          group_id: string
          joined_at?: string
          user_id?: string
        }
        Update: {
          display_name?: string
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          id: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          absence_limit_pct: number
          created_at: string
          degree: string | null
          digest_email: boolean
          display_name: string
          feed_token: string
          hidden_widgets: string[]
          onboarded: boolean
          university: string | null
          updated_at: string
          user_id: string
          weekly_goal_minutes: number
        }
        Insert: {
          absence_limit_pct?: number
          created_at?: string
          degree?: string | null
          digest_email?: boolean
          display_name?: string
          feed_token?: string
          hidden_widgets?: string[]
          onboarded?: boolean
          university?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal_minutes?: number
        }
        Update: {
          absence_limit_pct?: number
          created_at?: string
          degree?: string | null
          digest_email?: boolean
          display_name?: string
          feed_token?: string
          hidden_widgets?: string[]
          onboarded?: boolean
          university?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal_minutes?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          created_at: string
          id: string
          label: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      study_groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          id: string
          kind: string
          minutes: number
          started_at: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          kind?: string
          minutes: number
          started_at: string
          subject_id?: string | null
          user_id?: string
        }
        Update: {
          id?: string
          kind?: string
          minutes?: number
          started_at?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          absence_limit: number | null
          color: string
          created_at: string
          credits: number | null
          id: string
          moodle_url: string | null
          name: string
          pass_grade: number
          room: string | null
          target_grade: number | null
          teacher: string | null
          user_id: string
        }
        Insert: {
          absence_limit?: number | null
          color?: string
          created_at?: string
          credits?: number | null
          id?: string
          moodle_url?: string | null
          name: string
          pass_grade?: number
          room?: string | null
          target_grade?: number | null
          teacher?: string | null
          user_id?: string
        }
        Update: {
          absence_limit?: number | null
          color?: string
          created_at?: string
          credits?: number | null
          id?: string
          moodle_url?: string | null
          name?: string
          pass_grade?: number
          room?: string | null
          target_grade?: number | null
          teacher?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          estimate_minutes: number | null
          group_id: string | null
          id: string
          kind: string
          parent_id: string | null
          priority: string
          recurrence: string
          source_uid: string | null
          status: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimate_minutes?: number | null
          group_id?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          priority?: string
          recurrence?: string
          source_uid?: string | null
          status?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimate_minutes?: number | null
          group_id?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          priority?: string
          recurrence?: string
          source_uid?: string | null
          status?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          recurring: boolean
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recurring?: boolean
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recurring?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: { Args: { gid: string }; Returns: boolean }
      join_group: { Args: { code: string }; Returns: string }
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
    Enums: {},
  },
} as const
