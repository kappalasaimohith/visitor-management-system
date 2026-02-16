/**
 * Simple seed script for visitor-management-system backend.
 * Creates: 1 household, 1 resident, 1 guard, 1 admin, and 1 pending visitor.
 * Run with: node seed.js (ensure SUPABASE_API_URL and SUPABASE_API_SERVICE_ROLE_KEY are set)
 */
import 'dotenv/config';
import supabaseAdmin from '../src/supabaseClient.js';
import crypto from 'crypto';

async function run() {
  console.log('Seeding database...');

  // Create household
  const { data: household, error: hErr } = await supabaseAdmin
    .from('households')
    .insert([{ name: 'Block A', flat_no: 'A-101' }])
    .select('*')
    .maybeSingle();
  if (hErr) throw hErr;

  // Create users rows. Note: users must exist in auth.users. If you do not have
  // corresponding auth users, insert only the users table references for demo.
  const residentId = crypto.randomUUID();
  const guardId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  // Insert user rows into 'users' table (assumes corresponding auth users exist).
  const usersToInsert = [
    { id: residentId, display_name: 'Demo Resident', household_id: household.id, role: 'resident' },
    { id: guardId, display_name: 'Demo Guard', household_id: null, role: 'guard' },
    { id: adminId, display_name: 'Demo Admin', household_id: null, role: 'admin' },
  ];

  const { data: usersData, error: uErr } = await supabaseAdmin.from('users').upsert(usersToInsert);
  if (uErr) throw uErr;

  // Create a pending visitor hosted by resident's household
  const { data: visitor, error: vErr } = await supabaseAdmin.from('visitors').insert([
    {
      name: 'Ramesh',
      phone: '9999999999',
      purpose: 'Delivery',
      host_household_id: household.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ]).select('*').maybeSingle();
  if (vErr) throw vErr;

  // Insert initial event
  await supabaseAdmin.from('events').insert([
    { type: 'seed', actor_user_id: adminId, subject_id: visitor.id, payload: { note: 'seed data' } },
  ]);

  console.log('Seed completed.');
  console.log({ household, usersData, visitor });
}

// no-op; using crypto.randomUUID from Node

run().catch((err)=>{console.error(err); process.exit(1);});
