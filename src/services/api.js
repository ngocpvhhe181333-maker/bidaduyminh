import { isSupabaseConfigured } from '../lib/supabaseClient'
import { demoAdapter } from './demoAdapter'
import { supabaseAdapter } from './supabaseAdapter'

export const api = isSupabaseConfigured ? supabaseAdapter : demoAdapter
export const isDemoMode = !isSupabaseConfigured
