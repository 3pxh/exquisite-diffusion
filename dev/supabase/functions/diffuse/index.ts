// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// supabase functions serve diffusion --env-file ./supabase/.env

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';

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
  const genData = await generate(supabaseClient, prompt);
  console.log("Got a prompt:", prompt)
  if (!genData.error) {
    let { data, error, status } = await supabaseClient.from('messages').insert({
      room: room,
      user_id: player.uuid,
      data: {
        type: "GeneratedImage",
        player: player,
        prompt: prompt,
        url: genData.url.publicUrl,
        seed: 0 // In case we want to get/save that from SD
      }
    });
    return new Response(
      JSON.stringify(status),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } else {
    return new Response(
      JSON.stringify(genData.error),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})


async function generate(supabaseClient: any, prompt: string) {
  const engineId = 'stable-diffusion-512-v2-0';
  const apiHost = 'https://api.stability.ai';
  const url = `${apiHost}/v1alpha/generation/${engineId}/text-to-image`;
  const apiKey = Deno.env.get('STABILITY_API_KEY');
  if (!apiKey) throw new Error("Missing Stability API key.");

  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'image/png',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        cfg_scale: 7,
        clip_guidance_preset: 'FAST_BLUE',
        height: 512,
        width: 512,
        samples: 1,
        seed: 0,
        steps: 30,
        text_prompts: [
          {
            text: prompt,
            weight: 1
          }
        ],
      })
    }
  );

  if (!response.ok) {
    const err = `Non-200 response: ${await response.text()}`;
    console.error(err);
    return {
      error: err
    };
  }

  try {
    const id = crypto.randomUUID();
    const filename = `v0/${id}.png`;
    const image = await response.blob();
    const {data, error} = await supabaseClient.storage.from('generated-images').upload(filename, image)
    if (error) {
      console.error(error);
      return {
        error: error
      };
    } else {
      const { data } = supabaseClient
        .storage
        .from('generated-images')
        .getPublicUrl(filename)
      return {
        error: null,
        url: data
      }
    }
  } catch (e) {
    console.error(e);
    return {error: e}
  }
}

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
