import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel's Supabase integration provides public keys with NEXT_PUBLIC_ names.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_SUPABASE_'],
})
