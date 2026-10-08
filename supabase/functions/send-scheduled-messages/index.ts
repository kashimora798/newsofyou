import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-scheduled-messages — the delivery half of "schedule a message".
 *
 * This function holds the service-role key, so it can write to `messages` on
 * behalf of either of you. That makes it a door that must stay shut: until now
 * it asked for nothing at all, so anyone who knew the URL could fire it, and
 * keep firing it, to flush every scheduled message early (and to hammer the
 * database doing it).
 *
 * It now requires the same proof the other background jobs use — the service
 * role's own bearer token, or the shared job secret. Neither is ever in the
 * browser: the client writes a row into `scheduled_messages`, and a scheduler
 * (cron / the local runner) calls this. If nothing calls it yet, nothing is
 * lost — the rows just wait until you point a scheduler at it (see
 * IMPLEMENTATION_GUIDE.md §8c).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-job-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** How many due messages one call may deliver. A cap, so a call cannot run long. */
const MAX_PER_RUN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── who is calling? ────────────────────────────────────────────────────────
  // Accepted: the service-role bearer token, or the shared job secret header.
  const presented = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const bearerOk = serviceRoleKey.length > 20 && presented === serviceRoleKey;

  const jobSecret = (req.headers.get("x-job-secret") ?? "").trim();
  const expectedSecret = Deno.env.get("SCHEDULED_JOB_SECRET") ?? Deno.env.get("EMBED_SECRET") ?? "";
  const secretOk = expectedSecret.length >= 16 && jobSecret === expectedSecret;

  if (!bearerOk && !secretOk) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Get due scheduled messages
  const { data: due, error: fetchErr } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("sent", false)
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (fetchErr) {
    return json({ error: fetchErr.message }, 500);
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

    const { error: insertErr } = await supabase.from("messages").insert(messageData);

    if (!insertErr) {
      // Mark it sent by id *and* only while it is still unsent, so two callers
      // racing each other can never deliver the same message twice.
      await supabase
        .from("scheduled_messages")
        .update({ sent: true })
        .eq("id", msg.id)
        .eq("sent", false);
      sent++;
    }
  }

  return json({ processed: due?.length ?? 0, sent, capped: (due?.length ?? 0) >= MAX_PER_RUN });
});
