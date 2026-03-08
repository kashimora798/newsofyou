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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          couple_start_date: string | null
          enable_memory_bot: boolean | null
          id: string
        }
        Insert: {
          couple_start_date?: string | null
          enable_memory_bot?: boolean | null
          id?: string
        }
        Update: {
          couple_start_date?: string | null
          enable_memory_bot?: boolean | null
          id?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          category: string
          created_at: string
          id: string
          message_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_user_settings: {
        Row: {
          chat_theme: string | null
          created_at: string
          dynamic_wallpaper: boolean
          font_size: string
          id: string
          message_effects: boolean
          theme: string
          updated_at: string
          user_id: string
          wallpaper_url: string | null
        }
        Insert: {
          chat_theme?: string | null
          created_at?: string
          dynamic_wallpaper?: boolean
          font_size?: string
          id?: string
          message_effects?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          wallpaper_url?: string | null
        }
        Update: {
          chat_theme?: string | null
          created_at?: string
          dynamic_wallpaper?: boolean
          font_size?: string
          id?: string
          message_effects?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          wallpaper_url?: string | null
        }
        Relationships: []
      }
      compliments: {
        Row: {
          content: string
          created_at: string
          delivered_at: string | null
          id: string
          is_delivered: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean
          user_id?: string
        }
        Relationships: []
      }
      couple_stats: {
        Row: {
          concurrent_seconds: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          concurrent_seconds?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          concurrent_seconds?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_stickers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          sticker_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          sticker_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          sticker_url?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_touch_reactions: {
        Row: {
          created_at: string
          emoji: string | null
          flash: boolean
          gradient: string | null
          id: string
          label: string
          particle_size: number
          particles: string[] | null
          shake: boolean
          user_id: string
          verb: string
          vibration_duration: number
          vibration_strength: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          flash?: boolean
          gradient?: string | null
          id?: string
          label: string
          particle_size?: number
          particles?: string[] | null
          shake?: boolean
          user_id: string
          verb: string
          vibration_duration?: number
          vibration_strength?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          flash?: boolean
          gradient?: string | null
          id?: string
          label?: string
          particle_size?: number
          particles?: string[] | null
          shake?: boolean
          user_id?: string
          verb?: string
          vibration_duration?: number
          vibration_strength?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_status: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          emoji: Json | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          gif_url: string | null
          id: string
          image_url: string | null
          is_memory: boolean | null
          isReact: boolean | null
          link_description: string | null
          link_image: string | null
          link_preview_active: boolean | null
          link_target_url: string | null
          link_title: string | null
          message_type: string | null
          read_at: string | null
          reply_to_id: string | null
          revealed: boolean | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          sticker_url: string | null
          user_id: string | null
          username: string | null
          video: boolean | null
          vidUrl: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          is_memory?: boolean | null
          isReact?: boolean | null
          link_description?: string | null
          link_image?: string | null
          link_preview_active?: boolean | null
          link_target_url?: string | null
          link_title?: string | null
          message_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          revealed?: boolean | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          sticker_url?: string | null
          user_id?: string | null
          username?: string | null
          video?: boolean | null
          vidUrl?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          is_memory?: boolean | null
          isReact?: boolean | null
          link_description?: string | null
          link_image?: string | null
          link_preview_active?: boolean | null
          link_target_url?: string | null
          link_title?: string | null
          message_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          revealed?: boolean | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          sticker_url?: string | null
          user_id?: string | null
          username?: string | null
          video?: boolean | null
          vidUrl?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_backup_20250619_20250628: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20250628_20250728: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20250728_20250815: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20250815_20250904: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20250904_20250924: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20250925_20251015: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          emoji: Json | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      messages_backup_20251015_20251120: {
        Row: {
          content: string | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          emoji: Json | null
          id: string | null
          image_url: string | null
          read_at: string | null
          reply_to_id: string | null
          seen: boolean | null
          seen_at: string | null
          status: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          emoji?: Json | null
          id?: string | null
          image_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          seen?: boolean | null
          seen_at?: string | null
          status?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      pending_animations: {
        Row: {
          animation_data: Json
          animation_type: string
          created_at: string
          id: string
          sender_name: string | null
          target_user_id: string
        }
        Insert: {
          animation_data?: Json
          animation_type: string
          created_at?: string
          id?: string
          sender_name?: string | null
          target_user_id: string
        }
        Update: {
          animation_data?: Json
          animation_type?: string
          created_at?: string
          id?: string
          sender_name?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          pinned_by: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          note: string | null
          remind_at: string
          target_user_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          note?: string | null
          remind_at: string
          target_user_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          note?: string | null
          remind_at?: string
          target_user_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string | null
          created_at: string
          extras: Json | null
          id: string
          send_at: string
          sent: boolean
          user_id: string
          username: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          extras?: Json | null
          id?: string
          send_at: string
          sent?: boolean
          user_id: string
          username: string
        }
        Update: {
          content?: string | null
          created_at?: string
          extras?: Json | null
          id?: string
          send_at?: string
          sent?: boolean
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      shared_events: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          event_date: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          event_date: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          event_date?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          is_shared: boolean
          notes: string | null
          priority: Database["public"]["Enums"]["todo_priority"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          is_shared?: boolean
          notes?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          is_shared?: boolean
          notes?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_status: {
        Row: {
          id: string
          is_typing: boolean | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_achievement_state: {
        Row: {
          created_at: string
          event_1111: boolean | null
          event_jinx: boolean | null
          event_newyear: boolean | null
          event_timecapsule: boolean | null
          event_timetraveler: boolean | null
          event_waiter: boolean | null
          id: string
          streak_celebrated_date: string | null
          unlocked_achievements: Json | null
          updated_at: string
          user_id: string
          waiter_open_count: number | null
          waiter_start_time: number | null
        }
        Insert: {
          created_at?: string
          event_1111?: boolean | null
          event_jinx?: boolean | null
          event_newyear?: boolean | null
          event_timecapsule?: boolean | null
          event_timetraveler?: boolean | null
          event_waiter?: boolean | null
          id?: string
          streak_celebrated_date?: string | null
          unlocked_achievements?: Json | null
          updated_at?: string
          user_id: string
          waiter_open_count?: number | null
          waiter_start_time?: number | null
        }
        Update: {
          created_at?: string
          event_1111?: boolean | null
          event_jinx?: boolean | null
          event_newyear?: boolean | null
          event_timecapsule?: boolean | null
          event_timetraveler?: boolean | null
          event_waiter?: boolean | null
          id?: string
          streak_celebrated_date?: string | null
          unlocked_achievements?: Json | null
          updated_at?: string
          user_id?: string
          waiter_open_count?: number | null
          waiter_start_time?: number | null
        }
        Relationships: []
      }
      user_status: {
        Row: {
          activity_state: string | null
          bio: string | null
          current_streak: number | null
          custom_status: string | null
          daliyPopUPMsgs: string | null
          id: string
          is_online: boolean | null
          is_typing: boolean | null
          isOnboardComplete: boolean | null
          last_seen: string | null
          longest_streak: number | null
          name: string | null
          profileurl: string | null
          streak_broken_on: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_state?: string | null
          bio?: string | null
          current_streak?: number | null
          custom_status?: string | null
          daliyPopUPMsgs?: string | null
          id?: string
          is_online?: boolean | null
          is_typing?: boolean | null
          isOnboardComplete?: boolean | null
          last_seen?: string | null
          longest_streak?: number | null
          name?: string | null
          profileurl?: string | null
          streak_broken_on?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_state?: string | null
          bio?: string | null
          current_streak?: number | null
          custom_status?: string | null
          daliyPopUPMsgs?: string | null
          id?: string
          is_online?: boolean | null
          is_typing?: boolean | null
          isOnboardComplete?: boolean | null
          last_seen?: string | null
          longest_streak?: number | null
          name?: string | null
          profileurl?: string | null
          streak_broken_on?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          isOboardComp: boolean | null
          name: string | null
          profileURL: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          isOboardComp?: boolean | null
          name?: string | null
          profileURL?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          isOboardComp?: boolean | null
          name?: string | null
          profileURL?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wish: {
        Row: {
          created_at: string
          id: number
          isRevealed: boolean | null
          revealtime: string | null
          uid: string | null
          wish: string | null
          wishDec: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          isRevealed?: boolean | null
          revealtime?: string | null
          uid?: string | null
          wish?: string | null
          wishDec?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          isRevealed?: boolean | null
          revealtime?: string | null
          uid?: string | null
          wish?: string | null
          wishDec?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      full_chat_history: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          source_table: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_cleanup_statuses: { Args: never; Returns: undefined }
      cleanup_typing_status: { Args: never; Returns: undefined }
      get_achievement_stats: { Args: never; Returns: Json }
      get_advanced_stats: { Args: never; Returns: Json }
      get_chat_stats: { Args: never; Returns: Json }
      get_on_this_day: { Args: never; Returns: Json }
      get_streak_data: { Args: never; Returns: Json }
      increment_concurrent_seconds: {
        Args: { seconds_to_add: number }
        Returns: undefined
      }
      update_user_and_message_status: {
        Args: {
          p_is_online?: boolean
          p_is_typing?: boolean
          p_mark_messages_seen?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      update_user_status: {
        Args: { p_is_online: boolean; p_last_seen?: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      todo_priority: "low" | "medium" | "high"
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
      todo_priority: ["low", "medium", "high"],
    },
  },
} as const
