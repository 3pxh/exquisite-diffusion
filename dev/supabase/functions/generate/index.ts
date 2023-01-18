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

  const r = await req.json();
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  // TODO: Check that the player can access the room
  // r.room, r.player.uuid
  // TODO: Check that the room owner has credit

  // Run the generation.
  try {
    console.log('request', JSON.stringify(r))
    let responseData = {};
    if (r.generationType === "image") {
      responseData = await serveImage(supabaseClient, r);
    } else if (r.generationType === "text") {
      responseData = await serveText(supabaseClient, r);
    } else if (r.generationType === "list") {
      responseData = await serveList(supabaseClient, r);
    }

    // TODO: Note the usage on the room owner's credit?
    return new Response(
      JSON.stringify(responseData),
      { headers: {...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    console.error(r.generationType, e);
    return new Response(
      JSON.stringify({error: e}),
      { headers: {...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})

async function serveList(supabaseClient:any, req:any) {
  console.log("list prompt:", req.prompt);
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const apiUrl = 'https://api.openai.com/v1/completions';
  const res = await fetch(apiUrl, {
    headers: { Authorization: 'Bearer ' + openaiKey, "Content-Type": "application/json" },
    method: 'POST',
    body: JSON.stringify({
      "model": "text-davinci-003",
      "prompt": `${req.gisticlePrefix} ${req.prompt}, don't explain why.\n\n`,
      "temperature": 0.7,
      "max_tokens": 256,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0
    })
  });
  const resjson = await res.json();
  // TODO: Errors? Haha.
  console.log("openai response", resjson);
  const completion = resjson.choices[0].text;
  console.log("completion:", completion);

  let { data, error, status } = await supabaseClient.from('messages').insert({
    room: req.room,
    user_id: req.player.uuid || req.player.id,
    data: {
      type: "Generation",
      generationType: "list",
      player: req.player,
      gisticlePrefix: req.gisticlePrefix,
      prompt: req.prompt,
      text: completion,
      // This is temporary while migrating to the new engine. TODO: delete the entries above.
      generation: {
        player: req.player,
        generationType: "list",
        gisticlePrefix: req.gisticlePrefix,
        prompt: req.prompt,
        text: completion,
      }
    }
  });

  return { data, error, status };
}

async function serveText(supabaseClient:any, req:any) {
  console.log("text prompt:", req.prompt)
  const textsynthKey = Deno.env.get('TEXTSYNTH_API_KEY');
  const apiUrl = 'https://api.textsynth.com';
  const model = 'gptneox_20B'; // 'gptneox_6B';
  const synth = await fetch(apiUrl + '/v1/engines/' + model + '/completions', {
    headers: { Authorization: 'Bearer ' + textsynthKey },
    method: 'POST',
    body: JSON.stringify({ prompt: req.prompt })
  });
  const synthJson = await synth.json();

  let { data, error, status } = await supabaseClient.from('messages').insert({
    room: req.room,
    user_id: req.player.uuid || req.player.id,
    data: {
      type: "Generation",
      generationType: "text",
      player: req.player,
      prompt: req.prompt,
      text: synthJson.text,
      // This is temporary while migrating to the new engine. TODO: delete the entries above.
      generation: {
        player: req.player,
        generationType: "text",
        prompt: req.prompt,
        text: synthJson.text,
      }
    }
  });

  return {}
}

async function serveImage(supabaseClient:any, req:any) {
  const genData = await generateImage(supabaseClient, req.prompt);
  if (!genData.error) {
    let { data, error, status } = await supabaseClient.from('messages').insert({
      room: req.room,
      user_id: req.player.uuid || req.player.id,
      data: {
        type: "Generation",
        generationType: "image",
        player: req.player,
        prompt: req.prompt,
        url: genData.url!.publicUrl,
        seed: 0, // In case we want to get/save that from SD
        // This is temporary while migrating to the new engine. TODO: delete the entries above.
        generation: {
          player: req.player,
          prompt: req.prompt,
          url: genData.url!.publicUrl,
          generationType: "image",
        }
      }
    });
    return status
  } else {
    return genData
  }
}

async function generateImage(supabaseClient: any, prompt: string, tryCount = 0): Promise<{error: any, url?: any}> {
  const MAX_TRIES = 2;
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

  if (response.headers.get("goa-error") === "invalid_prompts") {
    return {error: "Your prompt was not valid and may have contained filtered words."}
  } else if (response.headers.get("goa-error")) {
    return {error: `goa-error: ${response.headers.get("goa-error")}`}
  } else if (tryCount < MAX_TRIES && response.headers.get("finish-reason") !== "SUCCESS") {
    return generateImage(supabaseClient, prompt, tryCount + 1);
  } else if (tryCount === MAX_TRIES && response.headers.get("finish-reason") !== "SUCCESS") {
    return {error: `Tried ${tryCount} times but response is ${response.headers.get("Finish-Reason")}`}
  }

  // In case we wanted to save it, here it is.
  const seed = response.headers.get("seed");

  if (!response.ok) {
    const rjson = await response.json();
    const err = `Non-200 response: ${rjson}`;
    console.error({err, prompt});
    return {
      error: rjson
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
