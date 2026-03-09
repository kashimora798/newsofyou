import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { guess, answer } = await req.json();

    if (!guess || !answer) {
      return new Response(JSON.stringify({ match: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quick local checks first
    const g = guess.trim().toLowerCase();
    const a = answer.trim().toLowerCase();
    
    if (g === a) {
      return new Response(JSON.stringify({ match: true, type: "exact" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if one contains the other (partial match for compound words)
    if (a.includes(g) && g.length >= Math.ceil(a.length * 0.6)) {
      return new Response(JSON.stringify({ match: true, type: "partial" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI for semantic/alternative matching
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          tools: [
            {
              type: "function",
              function: {
                name: "check_match",
                description: "Check if a guess matches or is close enough to the answer in a drawing game",
                parameters: {
                  type: "object",
                  properties: {
                    match: {
                      type: "boolean",
                      description: "true if the guess is close enough to accept",
                    },
                    type: {
                      type: "string",
                      enum: ["synonym", "close", "no_match"],
                      description: "Type of match",
                    },
                  },
                  required: ["match", "type"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "check_match" } },
          messages: [
            {
              role: "system",
              content: `You are a judge in a drawing guessing game. The answer is a thing someone drew. Decide if the guess is close enough to accept.

Accept if:
- It's a synonym (e.g. "puppy" for "dog", "kitty" for "cat")  
- It's the same thing described differently (e.g. "ice cream cone" for "ice cream")
- It's a very common alternative name (e.g. "bunny" for "rabbit")
- Singular/plural variants (e.g. "balloon" for "balloons")
- Minor spelling mistakes (e.g. "elefant" for "elephant")

Reject if:
- It's a different thing entirely
- It's too vague (e.g. "animal" for "cat")
- It's a category not the specific thing`,
            },
            {
              role: "user",
              content: `Answer: "${a}"\nGuess: "${g}"\n\nIs this close enough?`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ match: false, error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ match: false, error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fall back to no match
      return new Response(JSON.stringify({ match: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ match: args.match, type: args.type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ match: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("guess-check error:", e);
    return new Response(
      JSON.stringify({ match: false, error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
