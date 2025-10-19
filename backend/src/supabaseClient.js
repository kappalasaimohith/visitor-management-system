// server supabase client - uses service_role key for DB writes and admin calls
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_API_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_API_SERVICE_ROLE_KEY;
// console.log('Loaded env vars:', {
//   SUPABASE_API_URL: process.env.SUPABASE_API_URL,
//   SUPABASE_API_SERVICE_ROLE_KEY: process.env.SUPABASE_API_SERVICE_ROLE_KEY,
// });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing supabase env vars');
  console.log({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });
  throw new Error('Missing supabase env vars');
}

console.log('[supabaseClient] Initialized with', { SUPABASE_URL });

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export default supabaseAdmin;

// module.exports = { supabaseAdmin };
