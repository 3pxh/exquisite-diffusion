// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';

// TODO: Error handling.
serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

  const { prompt, player, room } = await req.json()

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const textsynthKey = Deno.env.get('TEXTSYNTH_API_KEY');
  const apiUrl = 'https://api.textsynth.com';
  const model = 'gptneox_20B'; // 'gptneox_6B';
  const synth = await fetch(apiUrl + '/v1/engines/' + model + '/completions', {
    headers: { Authorization: 'Bearer ' + textsynthKey },
    method: 'POST',
    body: JSON.stringify({ prompt: prompt })
  });
  const synthJson = await synth.json();

  let { data, error, status } = await supabaseClient.from('messages').insert({
    room: room,
    data: {
      type: "GeneratedText",
      player: player,
      prompt: prompt,
      text: synthJson.text,
    }
  });

  return new Response(
    JSON.stringify({}),
    { headers: {...corsHeaders, "Content-Type": "application/json" } },
  )
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
