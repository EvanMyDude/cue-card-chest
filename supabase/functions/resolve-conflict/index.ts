import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ConflictStrategy = 'keep-current' | 'use-revision' | 'manual-merge';

interface ResolveConflictRequest {
  promptId: string;
  revisionId: string;
  strategy: ConflictStrategy;
  mergedData?: {
    title: string;
    content: string;
  };
}

interface UpdatedPrompt {
  id: string;
  title: string;
  content: string;
  checksum: string;
  version: number;
  updatedAt: string;
}

interface ResolveConflictResponse {
  success: boolean;
  updatedPrompt: UpdatedPrompt;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ResolveConflictRequest = await req.json();
    const { promptId, revisionId, strategy, mergedData } = body;

    // Validate input
    if (!promptId || !revisionId || !strategy) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: promptId, revisionId, and strategy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validStrategies: ConflictStrategy[] = ['keep-current', 'use-revision', 'manual-merge'];
    if (!validStrategies.includes(strategy)) {
      return new Response(
        JSON.stringify({ error: 'Invalid strategy. Must be: keep-current, use-revision, or manual-merge' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (strategy === 'manual-merge' && !mergedData) {
      return new Response(
        JSON.stringify({ error: 'mergedData is required when strategy is manual-merge' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mergedData && (!mergedData.title || !mergedData.content)) {
      return new Response(
        JSON.stringify({ error: 'mergedData must contain title and content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      console.error('[resolve-conflict] Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .maybeSingle();

    if (promptError) {
      console.error('[resolve-conflict] Error fetching prompt:', promptError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch prompt', details: promptError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt not found or does not belong to user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch revision
    const { data: revision, error: revisionError } = await supabase
      .from('prompt_revisions')
      .select('*')
      .eq('id', revisionId)
      .eq('prompt_id', promptId)
      .maybeSingle();

    if (revisionError) {
      console.error('[resolve-conflict] Error fetching revision:', revisionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch revision', details: revisionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!revision) {
      return new Response(
        JSON.stringify({ error: 'Revision not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedTitle = prompt.title;
    let updatedContent = prompt.content;
    let message = '';

    // Apply strategy
    switch (strategy) {
      case 'keep-current':
        message = 'Kept current version, marked conflict as resolved';
        break;

      case 'use-revision':
        updatedTitle = revision.title;
        updatedContent = revision.content;
        message = 'Applied revision version, updated prompt';
        break;

      case 'manual-merge':
        updatedTitle = mergedData!.title;
        updatedContent = mergedData!.content;
        message = 'Applied manually merged version';
        break;
    }

    // Compute new checksum
    const { data: checksumData, error: checksumError } = await supabase.rpc('compute_checksum', {
      p_title: updatedTitle,
      p_content: updatedContent,
    });

    if (checksumError) {
      console.error('[resolve-conflict] Checksum computation failed:', checksumError);
      return new Response(
        JSON.stringify({ error: 'Failed to compute checksum', details: checksumError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newChecksum = checksumData as string;

    // Update prompt
    const { data: updatedPrompt, error: updateError } = await supabase
      .from('prompts')
      .update({
        title: updatedTitle,
        content: updatedContent,
        checksum: newChecksum,
        version: prompt.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[resolve-conflict] Failed to update prompt:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update prompt', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark revision as resolved
    const { error: markResolvedError } = await supabase
      .from('prompt_revisions')
      .update({ conflict_resolved: true })
      .eq('id', revisionId);

    if (markResolvedError) {
      console.error('[resolve-conflict] Failed to mark revision as resolved:', markResolvedError);
      // Non-fatal, continue
    }

    // Update sync state for all user devices to trigger re-sync
    const { error: syncError } = await supabase
      .from('sync_state')
      .update({ sync_status: 'synced' })
      .eq('user_id', user.id);

    if (syncError) {
      console.error('[resolve-conflict] Failed to update sync state:', syncError);
      // Non-fatal, continue
    }

    console.log(`[resolve-conflict] User ${user.id} resolved conflict for prompt ${promptId} using strategy: ${strategy}`);

    const response: ResolveConflictResponse = {
      success: true,
      updatedPrompt: {
        id: updatedPrompt.id,
        title: updatedPrompt.title,
        content: updatedPrompt.content,
        checksum: updatedPrompt.checksum,
        version: updatedPrompt.version,
        updatedAt: updatedPrompt.updated_at,
      },
      message,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-conflict] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
