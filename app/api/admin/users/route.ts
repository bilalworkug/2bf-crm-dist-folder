import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

// Define the role list based on existing roles
const VALID_ROLES = [
  'admin',
  'accounts',
  'accounts_manager',
  'sales',
  'sales_manager',
  'production',
  'production_manager',
  'warehouse',
  'warehouse_manager',
  'dispatch',
  'dispatch_manager',
  'delivery',
  'returns',
  'returns_manager'
];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // 1. Initialize client with Anon key to verify the caller's session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uubllghmxprlgqttwosr.supabase.co';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Verify caller's role is 'admin'
    // Create a client that assumes the user's session so RLS applies properly,
    // though for profiles, reading own profile is allowed.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: callerProfile, error: profileErr } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ message: 'Unable to verify caller role' }, { status: 403 });
    }

    if (callerProfile.role !== 'admin') {
      return NextResponse.json({ message: 'You are not authorized to create users.' }, { status: 403 });
    }

    // 3. Verify Server environment has Service Role Key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_NXv8h4QFKcrZIuzEZOLtRg_edMKBqoM';

    // 4. Validate input data
    const body = await request.json();
    const { email, password, full_name, role, warehouse_id } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ message: `Invalid role: ${role}` }, { status: 400 });
    }

    // 5. Initialize Service Role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 6. Create Auth User
    const { data: authData, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createAuthErr || !authData.user) {
      // Check for duplicate email error
      if (createAuthErr?.message?.toLowerCase().includes('already registered') || createAuthErr?.message?.toLowerCase().includes('already exists')) {
        return NextResponse.json({ message: 'A user with this email already exists.' }, { status: 400 });
      }
      return NextResponse.json({ message: 'Unable to create user. Please try again.' }, { status: 400 });
    }

    const newUserId = authData.user.id;

    // 7. Create Profile
    const { error: insertProfileErr } = await adminClient.from('profiles').insert({
      id: newUserId,
      email,
      full_name,
      role,
      warehouse_id: warehouse_id || null,
      active: true
    });

    if (insertProfileErr) {
      // Rollback Auth user if profile fails
      await adminClient.auth.admin.deleteUser(newUserId);
      console.error('Profile creation failed:', insertProfileErr);
      return NextResponse.json({ message: 'Unable to create user profile. Please try again.' }, { status: 500 });
    }

    // 8. Create Audit Log
    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'user_created',
      entity_type: 'profiles',
      entity_id: newUserId,
      details: { role, warehouse_id: warehouse_id || null, target_user: newUserId }
    });
    
    if (auditErr) {
      console.error('Failed to write audit log for user creation:', auditErr);
      // We don't fail the request if just the audit log fails, but it's noted.
    }

    return NextResponse.json({ 
      message: 'User created successfully',
      user: {
        id: newUserId,
        email,
        full_name,
        role,
        warehouse_id: warehouse_id || null,
        active: true
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in user creation endpoint:', error);
    return NextResponse.json({ message: 'An unexpected error occurred' }, { status: 500 });
  }
}
