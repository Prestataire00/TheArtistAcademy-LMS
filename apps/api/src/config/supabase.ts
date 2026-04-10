import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const STORAGE_BUCKET = env.SUPABASE_STORAGE_BUCKET;
export const RESOURCES_BUCKET = env.SUPABASE_RESOURCES_BUCKET;
export const SIGNED_URL_EXPIRES_IN = env.SUPABASE_SIGNED_URL_EXPIRES_IN;
