import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find invites expiring in the next 24 hours that haven't been responded to
    const oneDayFromNow = new Date();
    oneDayFromNow.setHours(oneDayFromNow.getHours() + 24);
    
    const { data: expiringInvites, error } = await supabase
      .from('match_invites')
      .select(`
        id,
        receiver_id,
        sender_id,
        date,
        start_time,
        expires_at,
        profiles!match_invites_sender_id_fkey (first_name, last_name)
      `)
      .eq('status', 'pending')
      .lte('expires_at', oneDayFromNow.toISOString())
      .gt('expires_at', new Date().toISOString())
      .is('response_at', null);
      
    if (error) throw error;
    
    let remindersSent = 0;
    
    // Create reminder notifications
    for (const invite of expiringInvites || []) {
      const senderName = `${invite.profiles.first_name} ${invite.profiles.last_name}`;
      const hoursRemaining = Math.floor(
        (new Date(invite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      
      const { error: notifError } = await supabase.rpc('create_notification', {
        target_user_id: invite.receiver_id,
        notification_type: 'match_invite_expiring',
        notification_title: 'Match Invite Expiring Soon',
        notification_message: `Your match invite from ${senderName} expires in ${hoursRemaining} hours`,
        notification_action_url: '/dashboard?tab=schedule',
        notification_metadata: {
          invite_id: invite.id,
          sender_id: invite.sender_id,
          hours_remaining: hoursRemaining
        }
      });
      
      if (!notifError) {
        remindersSent++;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: remindersSent,
        total_checked: expiringInvites?.length || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
    
  } catch (error: any) {
    console.error("Error sending invite reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
