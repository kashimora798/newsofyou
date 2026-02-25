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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get due scheduled messages
  const { data: due, error: fetchErr } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("sent", false)
    .lte("send_at", new Date().toISOString());

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const msg of due ?? []) {
    const extras = (msg.extras as Record<string, unknown>) ?? {};
    const messageData: Record<string, unknown> = {
      user_id: msg.user_id,
      username: msg.username,
      content: msg.content,
      message_type: (extras.message_type as string) ?? "text",
      status: "sent",
    };

    // Copy extras like image_url, gif_url, etc.
    if (extras.image_url) messageData.image_url = extras.image_url;
    if (extras.gif_url) messageData.gif_url = extras.gif_url;
    if (extras.sticker_url) messageData.sticker_url = extras.sticker_url;
    if (extras.file_url) {
      messageData.file_url = extras.file_url;
      messageData.file_name = extras.file_name;
      messageData.file_type = extras.file_type;
      messageData.file_size = extras.file_size;
    }
    if (extras.video) {
      messageData.video = true;
      messageData.vidUrl = extras.vidUrl;
    }
    if (extras.reply_to_id) messageData.reply_to_id = extras.reply_to_id;

    const { error: insertErr } = await supabase
      .from("messages")
      .insert(messageData);

    if (!insertErr) {
      await supabase
        .from("scheduled_messages")
        .update({ sent: true })
        .eq("id", msg.id);
      sent++;
    }
  }

  return new Response(
    JSON.stringify({ processed: due?.length ?? 0, sent }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
