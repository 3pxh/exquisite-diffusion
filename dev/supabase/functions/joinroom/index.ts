// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';

// RLS disallows users from viewing Rooms they aren't a member of,
// and creating Participant entries. In order to join a room we 
// need to use the secret service_role key, and only create a
// Participant entry if that Room is currently accepting players.
serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

  const { shortcode, userId } = await req.json()

  // TODO: use the SECRET_KEY
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    // { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  let { data, error, status } = await supabaseClient
    .from('rooms')
    .select('*')
    .eq('shortcode', shortcode)
    .order('id', { ascending: false }).single();


  if (error || data === null) {
    return new Response(
      JSON.stringify({ roomId: null, error: error, status: status }),
      { headers: {...corsHeaders, "Content-Type": "application/json" } },
    )
  } else if (data?.host_state === "Lobby") {
    await supabaseClient.from('participants').insert({
      room: data?.id,
      user: userId
    });
    return new Response(
      JSON.stringify({ roomId: data?.id }),
      { headers: {...corsHeaders, "Content-Type": "application/json" } },
    )
  } else {
    return new Response(
      JSON.stringify({
        error: "Game has already begun, room not accepting new players.",
        roomId: null
      }),
      { headers: {...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
