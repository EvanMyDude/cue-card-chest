import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PackPrompt {
  id: string;
  title: string;
  content: string;
  order_index: number;
  checksum: string;
}

interface Pack {
  id: string;
  name: string;
  version: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`User ${userId} requesting pack import`);

    // Parse request body
    const { packId, deviceId } = await req.json();
    if (!packId) {
      return new Response(
        JSON.stringify({ error: 'packId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Importing pack ${packId} for user ${userId}`);

    // Fetch the pack
    const { data: pack, error: packError } = await supabase
      .from('prompt_packs')
      .select('id, name, version')
      .eq('id', packId)
      .eq('is_active', true)
      .single();

    if (packError || !pack) {
      console.error('Pack fetch error:', packError);
      return new Response(
        JSON.stringify({ error: 'Pack not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch pack prompts
    const { data: packPrompts, error: promptsError } = await supabase
      .from('pack_prompts')
      .select('id, title, content, order_index, checksum')
      .eq('pack_id', packId)
      .order('order_index');

    if (promptsError) {
      console.error('Pack prompts fetch error:', promptsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pack prompts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!packPrompts || packPrompts.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, skipped: 0, message: 'Pack has no prompts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${packPrompts.length} prompts in pack`);

    // Fetch user's existing prompt checksums for deduplication
    const { data: existingPrompts, error: existingError } = await supabase
      .from('prompts')
      .select('checksum')
      .eq('user_id', userId);

    if (existingError) {
      console.error('Existing prompts fetch error:', existingError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing prompts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingChecksums = new Set((existingPrompts || []).map(p => p.checksum));
    console.log(`User has ${existingChecksums.size} existing prompts`);

    // Filter out duplicates
    const newPrompts = (packPrompts as PackPrompt[]).filter(p => !existingChecksums.has(p.checksum));
    const skippedCount = packPrompts.length - newPrompts.length;

    console.log(`After dedup: ${newPrompts.length} new, ${skippedCount} skipped`);

    if (newPrompts.length === 0) {
      return new Response(
        JSON.stringify({ 
          imported: 0, 
          skipped: skippedCount, 
          message: 'All prompts already exist in your library' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get max order_index for user's prompts
    const { data: maxOrderData } = await supabase
      .from('prompts')
      .select('order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1);

    const startOrderIndex = (maxOrderData?.[0]?.order_index ?? -1) + 1;

    // Prepare prompts for insertion
    const promptsToInsert = newPrompts.map((p, idx) => ({
      user_id: userId,
      device_id: deviceId || null,
      title: p.title,
      content: p.content,
      checksum: p.checksum,
      order_index: startOrderIndex + idx,
      source_pack_id: pack.id,
      source_pack_version: pack.version,
      is_pinned: false,
      version: 1,
    }));

    // Insert new prompts
    const { error: insertError } = await supabase
      .from('prompts')
      .insert(promptsToInsert);

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to import prompts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully imported ${newPrompts.length} prompts`);

    return new Response(
      JSON.stringify({ 
        imported: newPrompts.length, 
        skipped: skippedCount,
        packName: pack.name,
        message: `Imported ${newPrompts.length} prompts from "${pack.name}"` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
