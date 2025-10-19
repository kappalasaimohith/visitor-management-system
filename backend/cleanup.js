import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_API_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_API_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanup() {
  try {
    // 1. Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    // 2. Delete each user from auth
    for (const user of users.users) {
      console.log(`Deleting user: ${user.email}`);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) console.error(`Error deleting user ${user.email}:`, error);
    }

    // 3. Clean up database tables
    const tables = ['users', 'households', 'visitors', 'events','broadcasts'];
    for (const table of tables) {
      console.log(`Cleaning table: ${table}`);
      const { error } = await supabase.from(table).delete().neq('id', 'dummy');
      if (error) console.error(`Error cleaning ${table}:`, error);
    }

    console.log('Cleanup completed successfully!');
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

cleanup();