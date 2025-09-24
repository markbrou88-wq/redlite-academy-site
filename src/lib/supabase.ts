import { createClient } from "@supabase/supabase-js";

// pull values from environment (Vercel variables you set earlier)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// create client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
