import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterDeviceRequest {
  deviceName: string;
  deviceType: string;
}

interface RegisterDeviceResponse {
  deviceId: string;
  lastSeenAt: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: RegisterDeviceRequest = await req.json();
    const { deviceName, deviceType } = body;

    // Validate input
    if (!deviceName || !deviceType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: deviceName and deviceType' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (deviceName.trim().length === 0 || deviceName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Device name must be between 1 and 100 characters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const validTypes = ['desktop', 'mobile', 'tablet'];
    if (!validTypes.includes(deviceType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid device type. Must be: desktop, mobile, or tablet' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[register-device] Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user agent for device fingerprint
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Upsert device record
    const { data: device, error: upsertError } = await supabase
      .from('devices')
      .upsert(
        {
          user_id: user.id,
          device_name: deviceName.trim(),
          device_type: deviceType,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,device_name',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[register-device] Database error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to register device', details: upsertError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[register-device] User ${user.id} registered device ${device.id} (${deviceName})`);

    const response: RegisterDeviceResponse = {
      deviceId: device.id,
      lastSeenAt: device.last_seen_at,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[register-device] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
