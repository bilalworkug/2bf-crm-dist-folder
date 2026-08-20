import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Basic security check - ensure this is called by a trusted source (e.g., cron job runner)
    // In production, verify an Authorization header or secret token.
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We MUST use the service role key to process deliveries (bypassing RLS)
    // because this is a background worker, not a logged-in user.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Instead of auth-helpers (which uses user session), we create a raw client with service role
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch pending notifications
    const { data: pendingDeliveries, error: fetchError } = await supabase
      .from('notification_deliveries')
      .select('*, notification:app_notifications(*)')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      return NextResponse.json({ message: 'No pending deliveries' });
    }

    const results = [];

    // 2. Process each delivery safely
    for (const delivery of pendingDeliveries) {
      try {
        // Mark as processing immediately to prevent concurrent worker pick-up
        await supabase
          .from('notification_deliveries')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', delivery.id);

        const notification = delivery.notification;

        // Skip if notifications are globally disabled
        if (process.env.NOTIFICATIONS_ENABLED === 'false') {
          await supabase.from('notification_deliveries').update({
            status: 'skipped',
            last_error: 'Notifications disabled in environment',
            updated_at: new Date().toISOString()
          }).eq('id', delivery.id);
          results.push({ id: delivery.id, status: 'skipped' });
          continue;
        }

        // Dummy send logic based on channel
        let success = true;
        let providerId = `mock_${Date.now()}`;

        if (delivery.channel === 'email') {
          if (!process.env.RESEND_API_KEY) {
            success = false;
            throw new Error('RESEND_API_KEY is not configured');
          }
          // TODO: Implement actual Resend logic here
          // await resend.emails.send({...})
        } else if (delivery.channel === 'sms') {
          if (!process.env.TWILIO_ACCOUNT_SID) {
            success = false;
            throw new Error('TWILIO_ACCOUNT_SID is not configured');
          }
          // TODO: Implement actual Twilio logic here
          // await twilioClient.messages.create({...})
        }

        // Mark as delivered
        await supabase.from('notification_deliveries').update({
          status: 'delivered',
          provider: delivery.channel === 'email' ? 'resend' : 'twilio',
          provider_message_id: providerId,
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attempt_count: delivery.attempt_count + 1
        }).eq('id', delivery.id);

        results.push({ id: delivery.id, status: 'delivered' });

      } catch (err: any) {
        // Handle failure and retry logic safely
        const attempt = delivery.attempt_count + 1;
        const maxRetries = 3;
        const status = attempt >= maxRetries ? 'failed' : 'failed'; // We can keep it 'failed' and use next_attempt_at

        let nextAttempt = null;
        if (attempt < maxRetries) {
          nextAttempt = new Date(Date.now() + (Math.pow(2, attempt) * 60000)); // Exponential backoff
        }

        await supabase.from('notification_deliveries').update({
          status: attempt >= maxRetries ? 'failed' : 'pending',
          last_error: err.message,
          next_attempt_at: nextAttempt?.toISOString(),
          updated_at: new Date().toISOString(),
          attempt_count: attempt
        }).eq('id', delivery.id);

        results.push({ id: delivery.id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });

  } catch (error: any) {
    console.error('Notification Processor Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
