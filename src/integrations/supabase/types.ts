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
      albums: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          provider: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          provider: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      bottles: {
        Row: {
          content: string
          created_at: string
          id: string
          is_picked: boolean | null
          picked_by: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_picked?: boolean | null
          picked_by?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_picked?: boolean | null
          picked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          opening_line: string | null
          persona: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          opening_line?: string | null
          persona?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          opening_line?: string | null
          persona?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_character_reply: boolean | null
          moment_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_character_reply?: boolean | null
          moment_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_character_reply?: boolean | null
          moment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moments"
            referencedColumns: ["id"]
          },
        ]
      }
      customization: {
        Row: {
          app_icons: Json | null
          bubble_color: string | null
          bubble_opacity: number | null
          bubble_style: string | null
          chat_background_url: string | null
          created_at: string
          friend_bubble_color: string | null
          id: string
          lock_screen_bg_url: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_icons?: Json | null
          bubble_color?: string | null
          bubble_opacity?: number | null
          bubble_style?: string | null
          chat_background_url?: string | null
          created_at?: string
          friend_bubble_color?: string | null
          id?: string
          lock_screen_bg_url?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_icons?: Json | null
          bubble_color?: string | null
          bubble_opacity?: number | null
          bubble_style?: string | null
          chat_background_url?: string | null
          created_at?: string
          friend_bubble_color?: string | null
          id?: string
          lock_screen_bg_url?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_chats: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          character_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          group_id: string
          id: string
          sender_type: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_type: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      moments: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes: number | null
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes?: number | null
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      music: {
        Row: {
          audio_url: string
          cover_url: string | null
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          audio_url: string
          cover_url?: string | null
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          album_id: string | null
          created_at: string
          id: string
          url: string
          user_id: string
        }
        Insert: {
          album_id?: string | null
          created_at?: string
          id?: string
          url: string
          user_id: string
        }
        Update: {
          album_id?: string | null
          created_at?: string
          id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nickname: string | null
          persona: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          persona?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          persona?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
