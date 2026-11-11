import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes('your-project.supabase.co') ||
  !supabaseUrl.startsWith('http')

const isPlaceholderKey =
  !supabasePublishableKey ||
  supabasePublishableKey === 'your-publishable-key'

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
