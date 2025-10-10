/**
 * Supabase Edge Function: Cleanup Soft-Deleted Staff Groups
 *
 * Purpose: Scheduled job to hard-delete soft-deleted staff groups after 30-day retention
 * Schedule: Daily at 2:00 AM UTC (via Supabase cron trigger)
 * Endpoint: https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups
 *
 * Authentication: Requires service_role key or valid authorization
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  deleted_count: number;
  deleted_ids: string[];
  deletion_details: Array<{
    group_id: string;
    name: string;
    soft_deleted_at: string;
    member_count: number;
    child_group_count: number;
    days_since_deletion: number;
  }>;
}

interface EdgeFunctionRequest {
  dry_run?: boolean;
  retention_days?: number;
  force?: boolean; // Force run even if recently executed
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    let params: EdgeFunctionRequest = {};
    if (req.method === 'POST') {
      try {
        params = await req.json();
      } catch {
        // Default params if no body provided
        params = {};
      }
    }

    const dryRun = params.dry_run ?? false;
    const retentionDays = params.retention_days ?? 30;
    const force = params.force ?? false;

    console.log(`Cleanup job started: dry_run=${dryRun}, retention_days=${retentionDays}`);

    // Check last execution time (prevent duplicate runs)
    if (!force && !dryRun) {
      const { data: lastRun, error: lastRunError } = await supabase
        .from('staff_groups_deletion_log')
        .select('hard_deleted_at')
        .order('hard_deleted_at', { ascending: false })
        .limit(1);

      if (!lastRunError && lastRun && lastRun.length > 0) {
        const lastRunTime = new Date(lastRun[0].hard_deleted_at);
        const hoursSinceLastRun = (Date.now() - lastRunTime.getTime()) / (1000 * 60 * 60);

        // Prevent running more than once every 12 hours
        if (hoursSinceLastRun < 12) {
          console.log(`Skipping: Last run was ${hoursSinceLastRun.toFixed(1)} hours ago`);
          return new Response(
            JSON.stringify({
              success: true,
              skipped: true,
              message: `Already ran ${hoursSinceLastRun.toFixed(1)} hours ago`,
              last_run: lastRunTime.toISOString(),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // Execute cleanup function
    const { data, error } = await supabase.rpc('cleanup_soft_deleted_staff_groups', {
      p_dry_run: dryRun,
      p_retention_days: retentionDays,
    });

    if (error) {
      console.error('Cleanup function error:', error);
      throw error;
    }

    const result = data[0] as CleanupResult;

    console.log(`Cleanup completed: deleted_count=${result.deleted_count}, dry_run=${dryRun}`);

    // Send notification if groups were deleted (could integrate with email/Slack here)
    if (!dryRun && result.deleted_count > 0) {
      console.log('Groups deleted:', result.deletion_details);
      // TODO: Add email/Slack notification integration here
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        retention_days: retentionDays,
        deleted_count: result.deleted_count,
        deleted_ids: result.deleted_ids,
        deletion_details: result.deletion_details,
        executed_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        executed_at: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * DEPLOYMENT INSTRUCTIONS:
 *
 * 1. Deploy this Edge Function:
 *    supabase functions deploy cleanup-soft-deleted-groups
 *
 * 2. Set up cron trigger in Supabase Dashboard:
 *    - Navigate to: Database > Functions > Edge Functions
 *    - Click on "cleanup-soft-deleted-groups"
 *    - Enable "Cron Triggers"
 *    - Schedule: "0 2 * * *" (runs at 2:00 AM UTC daily)
 *
 * 3. Test manually:
 *    curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups \
 *      -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
 *      -H "Content-Type: application/json" \
 *      -d '{"dry_run": true}'
 *
 * 4. Monitor execution:
 *    - Check Edge Function logs in Supabase Dashboard
 *    - Query deletion log: SELECT * FROM staff_groups_deletion_log ORDER BY hard_deleted_at DESC;
 */
