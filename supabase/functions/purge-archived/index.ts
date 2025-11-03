import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurgeArchivedRequest {
  dryRun?: boolean;
}

interface PurgeArchivedResponse {
  deletedCount: number;
  promptIds: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PurgeArchivedRequest = await req.json().catch(() => ({ dryRun: false }));
    const { dryRun = false } = body;

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[purge-archived] Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role (optional - you can remove this check for per-user cleanup)
    const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    // For now, allow any authenticated user to purge their own archived prompts
    // If you want admin-only access, uncomment the block below:
    /*
    if (roleError || !hasAdminRole) {
      console.error('[purge-archived] User is not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    */

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    // Query old archived prompts
    const { data: oldPrompts, error: queryError } = await supabase
      .from('prompts')
      .select('id')
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .lt('archived_at', cutoffISO);

    if (queryError) {
      console.error('[purge-archived] Error querying old prompts:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query old prompts', details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const promptIds = (oldPrompts || []).map((p) => p.id);
    const deletedCount = promptIds.length;

    if (dryRun) {
      console.log(`[purge-archived] Dry run: Would delete ${deletedCount} prompts for user ${user.id}`);
      
      const response: PurgeArchivedResponse = {
        deletedCount,
        promptIds,
      };

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Actually delete the prompts
    if (deletedCount > 0) {
      const { error: deleteError } = await supabase
        .from('prompts')
        .delete()
        .in('id', promptIds)
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .lt('archived_at', cutoffISO);

      if (deleteError) {
        console.error('[purge-archived] Error deleting prompts:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete prompts', details: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[purge-archived] Deleted ${deletedCount} archived prompts for user ${user.id}`);
    } else {
      console.log(`[purge-archived] No archived prompts to delete for user ${user.id}`);
    }

    const response: PurgeArchivedResponse = {
      deletedCount,
      promptIds,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[purge-archived] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
