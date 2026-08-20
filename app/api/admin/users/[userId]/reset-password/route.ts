import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // ── 1. Extract Bearer token ──────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized: Missing or invalid token' },
        { status: 401 }
      );
    }
    const token = authHeader.replace('Bearer ', '');

    // ── 2. Verify Supabase environment ───────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { message: 'Server configuration error' },
        { status: 500 }
      );
    }

    // ── 3. Validate token → get authenticated user ───────────────────
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // ── 4. Verify caller role is admin ───────────────────────────────
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: callerProfile, error: profileErr } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json(
        { message: 'Unable to verify caller role' },
        { status: 403 }
      );
    }

    if (callerProfile.role !== 'admin') {
      return NextResponse.json(
        { message: 'Forbidden: Only admins can reset passwords.' },
        { status: 403 }
      );
    }

    // ── 5. Prevent admin from resetting own password ─────────────────
    if (userId === user.id) {
      return NextResponse.json(
        { message: 'You cannot reset your own password here. Use Settings → Change Password.' },
        { status: 400 }
      );
    }

    // ── 6. Validate target user exists ───────────────────────────────
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { message: 'Server configuration error: service key missing' },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: targetProfile, error: targetErr } = await adminClient
      .from('profiles')
      .select('id, email, active')
      .eq('id', userId)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json(
        { message: 'Target user not found' },
        { status: 404 }
      );
    }

    // ── 7. Validate password input ───────────────────────────────────
    const body = await request.json();
    const { password, confirmPassword } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { message: 'Password is required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (!confirmPassword || password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // ── 8. Reset password via Supabase Admin Auth API ────────────────
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (updateErr) {
      return NextResponse.json(
        { message: 'Failed to reset password. Please try again.' },
        { status: 500 }
      );
    }

    // ── 9. Create audit log (never include password) ─────────────────
    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'user_password_reset',
      entity_type: 'profiles',
      entity_id: userId,
      details: {
        target_user_id: userId,
        target_email: targetProfile.email,
        admin_id: user.id,
      },
    });

    if (auditErr) {
      // Audit failure is non-fatal — password was already reset
      console.error('Audit log write failed:', auditErr.message);
    }

    // ── 10. Return safe response ─────────────────────────────────────
    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in password reset endpoint:', (error as Error).message);
    return NextResponse.json(
      { message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
