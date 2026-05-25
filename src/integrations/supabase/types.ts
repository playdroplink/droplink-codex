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
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          profile_id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          profile_id: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_support_config: {
        Row: {
          business_info: string | null
          created_at: string | null
          custom_instructions: string | null
          enabled: boolean | null
          faqs: string | null
          id: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          business_info?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          enabled?: boolean | null
          faqs?: string | null
          id?: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          business_info?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          enabled?: boolean | null
          faqs?: string | null
          id?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_support_config_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          location_city: string | null
          location_country: string | null
          profile_id: string
          user_agent: string | null
          visitor_ip: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          location_city?: string | null
          location_country?: string | null
          profile_id: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          location_city?: string | null
          location_country?: string | null
          profile_id?: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_profile_id: string
          following_profile_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_profile_id: string
          following_profile_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_profile_id?: string
          following_profile_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_profile_id_fkey"
            columns: ["following_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          message: string | null
          pi_amount: number
          plan_type: string
          purchased_by_profile_id: string | null
          recipient_email: string | null
          redeemed_at: string | null
          redeemed_by_profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_period: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          pi_amount?: number
          plan_type: string
          purchased_by_profile_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          pi_amount?: number
          plan_type?: string
          purchased_by_profile_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_purchased_by_profile_id_fkey"
            columns: ["purchased_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_redeemed_by_profile_id_fkey"
            columns: ["redeemed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_transactions: {
        Row: {
          created_at: string
          drop_tokens_spent: number
          gift_id: string
          id: string
          pi_amount: number
          receiver_profile_id: string
          sender_profile_id: string
        }
        Insert: {
          created_at?: string
          drop_tokens_spent: number
          gift_id: string
          id?: string
          pi_amount?: number
          receiver_profile_id: string
          sender_profile_id: string
        }
        Update: {
          created_at?: string
          drop_tokens_spent?: number
          gift_id?: string
          id?: string
          pi_amount?: number
          receiver_profile_id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          category: string
          created_at: string
          description: string
          drop_token_cost: number
          icon: string
          id: string
          is_active: boolean
          name: string
          pi_amount: number
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          drop_token_cost: number
          icon: string
          id?: string
          is_active?: boolean
          name: string
          pi_amount?: number
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          drop_token_cost?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          pi_amount?: number
          sort_order?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          group_id: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_profile_id: string | null
          sender_profile_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_profile_id?: string | null
          sender_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_profile_id?: string | null
          sender_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_idempotency: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          payment_id: string
          profile_id: string | null
          status: string
          txid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          profile_id?: string | null
          status?: string
          txid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          profile_id?: string | null
          status?: string
          txid?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_idempotency_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          image: string | null
          price: string
          profile_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          image?: string | null
          price: string
          profile_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          image?: string | null
          price?: string
          profile_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bank_details: Json | null
          business_name: string
          created_at: string
          crypto_wallets: Json | null
          description: string | null
          has_premium: boolean | null
          id: string
          last_active_at: string | null
          logo: string | null
          pi_donation_message: string | null
          pi_wallet_address: string | null
          show_share_button: boolean | null
          social_links: Json | null
          theme_settings: Json | null
          updated_at: string
          user_id: string | null
          username: string
          youtube_video_url: string | null
        }
        Insert: {
          bank_details?: Json | null
          business_name: string
          created_at?: string
          crypto_wallets?: Json | null
          description?: string | null
          has_premium?: boolean | null
          id?: string
          last_active_at?: string | null
          logo?: string | null
          pi_donation_message?: string | null
          pi_wallet_address?: string | null
          show_share_button?: boolean | null
          social_links?: Json | null
          theme_settings?: Json | null
          updated_at?: string
          user_id?: string | null
          username: string
          youtube_video_url?: string | null
        }
        Update: {
          bank_details?: Json | null
          business_name?: string
          created_at?: string
          crypto_wallets?: Json | null
          description?: string | null
          has_premium?: boolean | null
          id?: string
          last_active_at?: string | null
          logo?: string | null
          pi_donation_message?: string | null
          pi_wallet_address?: string | null
          show_share_button?: boolean | null
          social_links?: Json | null
          theme_settings?: Json | null
          updated_at?: string
          user_id?: string | null
          username?: string
          youtube_video_url?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          billing_period: string
          created_at: string
          end_date: string
          id: string
          pi_amount: number
          plan_type: string
          profile_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_period: string
          created_at?: string
          end_date: string
          id?: string
          pi_amount?: number
          plan_type: string
          profile_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_period?: string
          created_at?: string
          end_date?: string
          id?: string
          pi_amount?: number
          plan_type?: string
          profile_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          created_at: string
          drop_tokens: number
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          drop_tokens?: number
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          drop_tokens?: number
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          processed_at: string | null
          profile_id: string
          requested_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          profile_id: string
          requested_at: string
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          profile_id?: string
          requested_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_gift_card_code: { Args: never; Returns: string }
      get_active_subscription: {
        Args: { p_profile_id: string }
        Returns: {
          billing_period: string
          end_date: string
          plan_type: string
          status: string
        }[]
      }
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
