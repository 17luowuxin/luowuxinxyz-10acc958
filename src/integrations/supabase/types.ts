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
          character_name: string | null
          content: string
          created_at: string
          id: string
          is_picked: boolean | null
          picked_by: string | null
          reply: string | null
          user_id: string
        }
        Insert: {
          character_name?: string | null
          content: string
          created_at?: string
          id?: string
          is_picked?: boolean | null
          picked_by?: string | null
          reply?: string | null
          user_id: string
        }
        Update: {
          character_name?: string | null
          content?: string
          created_at?: string
          id?: string
          is_picked?: boolean | null
          picked_by?: string | null
          reply?: string | null
          user_id?: string
        }
        Relationships: []
      }
      character_blocks: {
        Row: {
          blocked_at: string
          character_id: string
          created_at: string
          id: string
          is_active: boolean
          last_message_at: string | null
          message_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          character_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          message_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          character_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          message_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_blocks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_memories: {
        Row: {
          character_id: string
          created_at: string
          id: string
          message_count: number
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          message_count?: number
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          message_count?: number
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_memories_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sprites: {
        Row: {
          character_id: string
          created_at: string
          emotion: string
          id: string
          sprite_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          emotion?: string
          id?: string
          sprite_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          emotion?: string
          id?: string
          sprite_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sprites_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          avatar_url: string | null
          call_video_url: string | null
          created_at: string
          history_limit: number | null
          id: string
          name: string
          online_message_count: string | null
          opening_line: string | null
          persona: string | null
          reply_mode: string | null
          ringtone_url: string | null
          sprite_url: string | null
          sticker_enabled: boolean | null
          transfer_enabled: boolean | null
          updated_at: string
          use_novel_format: boolean | null
          user_id: string
          voice_id: string | null
          voice_mode: string | null
        }
        Insert: {
          avatar_url?: string | null
          call_video_url?: string | null
          created_at?: string
          history_limit?: number | null
          id?: string
          name: string
          online_message_count?: string | null
          opening_line?: string | null
          persona?: string | null
          reply_mode?: string | null
          ringtone_url?: string | null
          sprite_url?: string | null
          sticker_enabled?: boolean | null
          transfer_enabled?: boolean | null
          updated_at?: string
          use_novel_format?: boolean | null
          user_id: string
          voice_id?: string | null
          voice_mode?: string | null
        }
        Update: {
          avatar_url?: string | null
          call_video_url?: string | null
          created_at?: string
          history_limit?: number | null
          id?: string
          name?: string
          online_message_count?: string | null
          opening_line?: string | null
          persona?: string | null
          reply_mode?: string | null
          ringtone_url?: string | null
          sprite_url?: string | null
          sticker_enabled?: boolean | null
          transfer_enabled?: boolean | null
          updated_at?: string
          use_novel_format?: boolean | null
          user_id?: string
          voice_id?: string | null
          voice_mode?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          audio_url: string | null
          character_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          quoted_message_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          character_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          quoted_message_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          quoted_message_id?: string | null
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
          {
            foreignKeyName: "chat_messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_status: {
        Row: {
          character_id: string
          created_at: string
          id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          avatar_frame_url: string | null
          bubble_color: string | null
          bubble_frame_url: string | null
          bubble_opacity: number | null
          bubble_size: number | null
          bubble_style: string | null
          chat_background_url: string | null
          created_at: string
          font_color: string | null
          font_family: string | null
          friend_avatar_frame_url: string | null
          friend_bubble_color: string | null
          friend_bubble_frame_url: string | null
          friend_font_color: string | null
          global_background_url: string | null
          global_text_color: string | null
          global_text_size: number | null
          group_chat_background_url: string | null
          id: string
          lock_screen_bg_url: string | null
          lock_screen_video_url: string | null
          music_cover_url: string | null
          novel_action_color: string | null
          novel_dialogue_color: string | null
          novel_narration_color: string | null
          novel_thought_color: string | null
          space_background_url: string | null
          theme: string | null
          updated_at: string
          user_id: string
          video_background_url: string | null
        }
        Insert: {
          app_icons?: Json | null
          avatar_frame_url?: string | null
          bubble_color?: string | null
          bubble_frame_url?: string | null
          bubble_opacity?: number | null
          bubble_size?: number | null
          bubble_style?: string | null
          chat_background_url?: string | null
          created_at?: string
          font_color?: string | null
          font_family?: string | null
          friend_avatar_frame_url?: string | null
          friend_bubble_color?: string | null
          friend_bubble_frame_url?: string | null
          friend_font_color?: string | null
          global_background_url?: string | null
          global_text_color?: string | null
          global_text_size?: number | null
          group_chat_background_url?: string | null
          id?: string
          lock_screen_bg_url?: string | null
          lock_screen_video_url?: string | null
          music_cover_url?: string | null
          novel_action_color?: string | null
          novel_dialogue_color?: string | null
          novel_narration_color?: string | null
          novel_thought_color?: string | null
          space_background_url?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
          video_background_url?: string | null
        }
        Update: {
          app_icons?: Json | null
          avatar_frame_url?: string | null
          bubble_color?: string | null
          bubble_frame_url?: string | null
          bubble_opacity?: number | null
          bubble_size?: number | null
          bubble_style?: string | null
          chat_background_url?: string | null
          created_at?: string
          font_color?: string | null
          font_family?: string | null
          friend_avatar_frame_url?: string | null
          friend_bubble_color?: string | null
          friend_bubble_frame_url?: string | null
          friend_font_color?: string | null
          global_background_url?: string | null
          global_text_color?: string | null
          global_text_size?: number | null
          group_chat_background_url?: string | null
          id?: string
          lock_screen_bg_url?: string | null
          lock_screen_video_url?: string | null
          music_cover_url?: string | null
          novel_action_color?: string | null
          novel_dialogue_color?: string | null
          novel_narration_color?: string | null
          novel_thought_color?: string | null
          space_background_url?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          video_background_url?: string | null
        }
        Relationships: []
      }
      diaries: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          id: string
          mood: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string
          id?: string
          mood?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          mood?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diaries_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      dream_transactions: {
        Row: {
          amount: number
          character_id: string | null
          character_name: string
          created_at: string
          id: string
          is_received: boolean | null
          is_user_transfer: boolean | null
          message: string | null
          user_id: string
        }
        Insert: {
          amount: number
          character_id?: string | null
          character_name: string
          created_at?: string
          id?: string
          is_received?: boolean | null
          is_user_transfer?: boolean | null
          message?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          character_id?: string | null
          character_name?: string
          created_at?: string
          id?: string
          is_received?: boolean | null
          is_user_transfer?: boolean | null
          message?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dream_transactions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_custom_images: {
        Row: {
          created_at: string
          gift_id: string
          id: string
          image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gift_id: string
          id?: string
          image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gift_id?: string
          id?: string
          image_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_favorites: {
        Row: {
          created_at: string
          custom_image: string | null
          gift_category: string
          gift_color: string
          gift_id: string
          gift_name: string
          gift_price: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_image?: string | null
          gift_category: string
          gift_color: string
          gift_id: string
          gift_name: string
          gift_price: number
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_image?: string | null
          gift_category?: string
          gift_color?: string
          gift_id?: string
          gift_name?: string
          gift_price?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_history: {
        Row: {
          character_id: string
          character_name: string
          created_at: string
          gift_id: string
          gift_name: string
          gift_price: number
          id: string
          quantity: number
          user_id: string
        }
        Insert: {
          character_id: string
          character_name: string
          created_at?: string
          gift_id: string
          gift_name: string
          gift_price: number
          id?: string
          quantity?: number
          user_id: string
        }
        Update: {
          character_id?: string
          character_name?: string
          created_at?: string
          gift_id?: string
          gift_name?: string
          gift_price?: number
          id?: string
          quantity?: number
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
      guestbook: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          id: string
          is_character_reply: boolean | null
          parent_id: string | null
          user_id: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_character_reply?: boolean | null
          parent_id?: string | null
          user_id: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_character_reply?: boolean | null
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guestbook_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guestbook_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "guestbook"
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
          is_user_post: boolean | null
          likes: number | null
          user_id: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_user_post?: boolean | null
          likes?: number | null
          user_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_user_post?: boolean | null
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
      pending_messages: {
        Row: {
          character_id: string
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          request_context: Json
          retry_count: number
          status: string
          updated_at: string
          user_id: string
          user_message: string
        }
        Insert: {
          character_id: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          request_context?: Json
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
          user_message: string
        }
        Update: {
          character_id?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          request_context?: Json
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          user_message?: string
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
      presets: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presets_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      space_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          app_icon_url: string | null
          app_icons: Json | null
          chat_background_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          desktop_widgets: string[] | null
          global_background_url: string | null
          id: string
          is_active: boolean | null
          lock_screen_bg_url: string | null
          lock_screen_video_url: string | null
          name: string
          preview_url: string | null
          updated_at: string
          video_background_url: string | null
        }
        Insert: {
          app_icon_url?: string | null
          app_icons?: Json | null
          chat_background_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_widgets?: string[] | null
          global_background_url?: string | null
          id?: string
          is_active?: boolean | null
          lock_screen_bg_url?: string | null
          lock_screen_video_url?: string | null
          name: string
          preview_url?: string | null
          updated_at?: string
          video_background_url?: string | null
        }
        Update: {
          app_icon_url?: string | null
          app_icons?: Json | null
          chat_background_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_widgets?: string[] | null
          global_background_url?: string | null
          id?: string
          is_active?: boolean | null
          lock_screen_bg_url?: string | null
          lock_screen_video_url?: string | null
          name?: string
          preview_url?: string | null
          updated_at?: string
          video_background_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stickers: {
        Row: {
          created_at: string
          id: string
          image_url: string
          keywords: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          keywords?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          keywords?: string[]
          user_id?: string
        }
        Relationships: []
      }
      vn_saves: {
        Row: {
          background_url: string | null
          character_id: string
          created_at: string
          current_index: number | null
          id: string
          messages: Json
          name: string
          story_settings: Json | null
          updated_at: string
          user_id: string
          user_sprite_url: string | null
        }
        Insert: {
          background_url?: string | null
          character_id: string
          created_at?: string
          current_index?: number | null
          id?: string
          messages?: Json
          name?: string
          story_settings?: Json | null
          updated_at?: string
          user_id: string
          user_sprite_url?: string | null
        }
        Update: {
          background_url?: string | null
          character_id?: string
          created_at?: string
          current_index?: number | null
          id?: string
          messages?: Json
          name?: string
          story_settings?: Json | null
          updated_at?: string
          user_id?: string
          user_sprite_url?: string | null
        }
        Relationships: []
      }
      world_books: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          id: string
          is_global: boolean
          name: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_global?: boolean
          name: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_global?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_books_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
