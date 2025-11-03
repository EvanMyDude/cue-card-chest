import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientPrompt {
  id: string;
  title: string;
  content: string;
  checksum?: string;
  isPinned: boolean;
  orderIndex: number;
  version: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface SyncRequest {
  deviceId: string;
  lastSyncAt: string | null;
  prompts: ClientPrompt[];
}

interface SyncedPrompt {
  clientId: string;
  serverId: string;
  checksum: string;
  version: number;
}

interface ConflictDetails {
  promptId: string;
  serverVersion: {
    title: string;
    content: string;
    updatedAt: string;
    deviceId: string;
  };
  clientVersion: {
    title: string;
    content: string;
    updatedAt: string;
  };
  revisionId: string;
}

interface ServerPrompt {
  id: string;
  title: string;
  content: string;
  checksum: string;
  isPinned: boolean;
  orderIndex: number;
  version: number;
  tags: string[];
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncResponse {
  synced: SyncedPrompt[];
  conflicts: ConflictDetails[];
  serverPrompts: ServerPrompt[];
  syncToken: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SyncRequest = await req.json();
    const { deviceId, lastSyncAt, prompts } = body;

    // Validate input
    if (!deviceId || !Array.isArray(prompts)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: deviceId and prompts array' }),
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
      console.error('[sync-prompts] Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify device belongs to user
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single();

    if (deviceError || !device) {
      console.error('[sync-prompts] Device verification failed:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Device not found or does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update device last_seen_at
    await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId);

    // Pull server changes (prompts updated after lastSyncAt)
    let serverQuery = supabase
      .from('prompts')
      .select(`
        id,
        title,
        content,
        checksum,
        is_pinned,
        order_index,
        version,
        device_id,
        created_at,
        updated_at,
        prompt_tags (
          tags (
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .is('archived_at', null);

    if (lastSyncAt) {
      serverQuery = serverQuery.gt('updated_at', lastSyncAt);
    }

    const { data: serverPromptsRaw, error: pullError } = await serverQuery;

    if (pullError) {
      console.error('[sync-prompts] Failed to pull server prompts:', pullError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch server prompts', details: pullError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform server prompts
    const serverPrompts: ServerPrompt[] = (serverPromptsRaw || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      checksum: p.checksum,
      isPinned: p.is_pinned,
      orderIndex: p.order_index,
      version: p.version,
      tags: (p.prompt_tags || []).map((pt: any) => pt.tags.name),
      deviceId: p.device_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    // Process client prompts
    const synced: SyncedPrompt[] = [];
    const conflicts: ConflictDetails[] = [];

    for (const clientPrompt of prompts) {
      try {
        // Validate prompt data
        if (!clientPrompt.title || !clientPrompt.content) {
          console.warn(`[sync-prompts] Skipping prompt ${clientPrompt.id}: missing title or content`);
          continue;
        }

        // Compute checksum
        const { data: checksumData, error: checksumError } = await supabase.rpc('compute_checksum', {
          p_title: clientPrompt.title,
          p_content: clientPrompt.content,
        });

        if (checksumError) {
          console.error(`[sync-prompts] Checksum computation failed for ${clientPrompt.id}:`, checksumError);
          continue;
        }

        const checksum = checksumData as string;

        // Check if prompt exists
        const { data: existingPrompt, error: findError } = await supabase
          .from('prompts')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', clientPrompt.id)
          .is('archived_at', null)
          .maybeSingle();

        if (findError) {
          console.error(`[sync-prompts] Error finding prompt ${clientPrompt.id}:`, findError);
          continue;
        }

        if (existingPrompt) {
          // Prompt exists - check for conflicts
          const serverTime = new Date(existingPrompt.updated_at).getTime();
          const clientTime = new Date(clientPrompt.updatedAt).getTime();
          const deltaSeconds = Math.abs(serverTime - clientTime) / 1000;

          if (deltaSeconds >= 30) {
            // Conflict detected
            console.warn(`[sync-prompts] Conflict detected for prompt ${clientPrompt.id} (delta: ${deltaSeconds}s)`);

            // Determine which version is newer
            const isClientNewer = clientTime > serverTime;

            // Create revision for older version
            const olderVersion = isClientNewer ? {
              title: existingPrompt.title,
              content: existingPrompt.content,
              checksum: existingPrompt.checksum,
            } : {
              title: clientPrompt.title,
              content: clientPrompt.content,
              checksum: checksum,
            };

            const { data: revision, error: revisionError } = await supabase
              .from('prompt_revisions')
              .insert({
                prompt_id: existingPrompt.id,
                version: existingPrompt.version,
                device_id: deviceId,
                title: olderVersion.title,
                content: olderVersion.content,
                checksum: olderVersion.checksum,
                conflict_resolved: false,
              })
              .select()
              .single();

            if (revisionError) {
              console.error(`[sync-prompts] Failed to create revision:`, revisionError);
            } else {
              conflicts.push({
                promptId: existingPrompt.id,
                serverVersion: {
                  title: existingPrompt.title,
                  content: existingPrompt.content,
                  updatedAt: existingPrompt.updated_at,
                  deviceId: existingPrompt.device_id,
                },
                clientVersion: {
                  title: clientPrompt.title,
                  content: clientPrompt.content,
                  updatedAt: clientPrompt.updatedAt,
                },
                revisionId: revision.id,
              });
            }

            // Update with newer version
            if (isClientNewer) {
              await supabase
                .from('prompts')
                .update({
                  title: clientPrompt.title,
                  content: clientPrompt.content,
                  checksum: checksum,
                  is_pinned: clientPrompt.isPinned,
                  order_index: clientPrompt.orderIndex,
                  version: existingPrompt.version + 1,
                  device_id: deviceId,
                })
                .eq('id', existingPrompt.id);
            }

          } else {
            // Last-write-wins (small time delta)
            if (clientTime > serverTime) {
              await supabase
                .from('prompts')
                .update({
                  title: clientPrompt.title,
                  content: clientPrompt.content,
                  checksum: checksum,
                  is_pinned: clientPrompt.isPinned,
                  order_index: clientPrompt.orderIndex,
                  version: existingPrompt.version + 1,
                  device_id: deviceId,
                })
                .eq('id', existingPrompt.id);

              synced.push({
                clientId: clientPrompt.id,
                serverId: existingPrompt.id,
                checksum: checksum,
                version: existingPrompt.version + 1,
              });
            } else {
              // Server version is newer, client should accept it
              synced.push({
                clientId: clientPrompt.id,
                serverId: existingPrompt.id,
                checksum: existingPrompt.checksum,
                version: existingPrompt.version,
              });
            }
          }

          // Update tags
          await supabase
            .from('prompt_tags')
            .delete()
            .eq('prompt_id', existingPrompt.id);

          for (const tagName of clientPrompt.tags) {
            const { data: tag, error: tagError } = await supabase
              .from('tags')
              .upsert(
                { user_id: user.id, name: tagName },
                { onConflict: 'user_id,name', ignoreDuplicates: false }
              )
              .select()
              .single();

            if (!tagError && tag) {
              await supabase
                .from('prompt_tags')
                .insert({ prompt_id: existingPrompt.id, tag_id: tag.id });
            }
          }

        } else {
          // New prompt - insert
          const { data: newPrompt, error: insertError } = await supabase
            .from('prompts')
            .insert({
              id: clientPrompt.id,
              user_id: user.id,
              device_id: deviceId,
              title: clientPrompt.title,
              content: clientPrompt.content,
              checksum: checksum,
              is_pinned: clientPrompt.isPinned,
              order_index: clientPrompt.orderIndex,
              version: clientPrompt.version,
              created_at: clientPrompt.createdAt,
              updated_at: clientPrompt.updatedAt,
            })
            .select()
            .single();

          if (insertError) {
            console.error(`[sync-prompts] Failed to insert prompt ${clientPrompt.id}:`, insertError);
            continue;
          }

          // Insert tags
          for (const tagName of clientPrompt.tags) {
            const { data: tag, error: tagError } = await supabase
              .from('tags')
              .upsert(
                { user_id: user.id, name: tagName },
                { onConflict: 'user_id,name', ignoreDuplicates: false }
              )
              .select()
              .single();

            if (!tagError && tag) {
              await supabase
                .from('prompt_tags')
                .insert({ prompt_id: newPrompt.id, tag_id: tag.id });
            }
          }

          synced.push({
            clientId: clientPrompt.id,
            serverId: newPrompt.id,
            checksum: checksum,
            version: newPrompt.version,
          });
        }

      } catch (error) {
        console.error(`[sync-prompts] Error processing prompt ${clientPrompt.id}:`, error);
      }
    }

    // Update sync state
    await supabase
      .from('sync_state')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          last_sync_at: new Date().toISOString(),
          sync_status: 'synced',
        },
        { onConflict: 'user_id,device_id', ignoreDuplicates: false }
      );

    const syncToken = new Date().toISOString();

    console.log(`[sync-prompts] User ${user.id} completed sync: ${synced.length} synced, ${conflicts.length} conflicts`);

    const response: SyncResponse = {
      synced,
      conflicts,
      serverPrompts,
      syncToken,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-prompts] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
