import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode } = await req.json(); // "recent" or "missed"
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user from auth token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader?.replace("Bearer ", "") ?? ""
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch messages
    let query = supabase
      .from("messages")
      .select("content, username, created_at")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (mode === "missed") {
      // Get user's last seen time
      const { data: status } = await supabase
        .from("user_status")
        .select("last_seen")
        .eq("user_id", user.id)
        .single();

      if (status?.last_seen) {
        query = query.gt("created_at", status.last_seen);
      }
    }

    const { data: messages, error: msgErr } = await query;
    if (msgErr) throw msgErr;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ summary: "No messages to summarize!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format messages for AI
    const chatLog = messages
      .reverse()
      .map((m) => `[${new Date(m.created_at).toLocaleString()}] ${m.username}: ${m.content}`)
      .join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant summarizing a private couple's chat. Give a warm, concise summary of the key topics, emotions, and plans discussed. Use bullet points for clarity. Keep it under 200 words. Add emoji where appropriate.",
            },
            {
              role: "user",
              content: `Please summarize this chat:\n\n${chatLog}`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content ?? "Could not generate summary.";

    return new Response(
      JSON.stringify({ summary, messageCount: messages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-chat-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
