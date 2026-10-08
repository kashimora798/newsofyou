import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * fetch-link-preview — the little card that appears under a pasted link.
 *
 * ## What was wrong
 *
 * This function used to take a URL from anyone and `fetch` it, with no
 * questions asked: no sign-in, no scheme check, no host check, no size limit.
 * That is a classic server-side request forgery (SSRF) hole. Anyone holding the
 * public anon key (it ships in the browser bundle, so: anyone) could ask it to
 * fetch whatever they liked **from inside Supabase's network** — including
 * `http://169.254.169.254/…` (the cloud metadata endpoint, the usual first step
 * towards stealing credentials), `http://localhost:8000/…`, or any private
 * address reachable from the function. It could also be used as free bandwidth
 * and as a port scanner, one response time at a time.
 *
 * ## What it does now
 *
 *   1. **You must be one of the two accounts.** A real session token is
 *      required and its bearer must pass `is_partner` — the same rule the rest
 *      of the app uses. No token, no fetch.
 *   2. **Only `http` and `https`.** `file:`, `ftp:`, `data:`, `gopher:` and the
 *      rest are refused before any network call.
 *   3. **The host must resolve to a public address.** The name is resolved here
 *      and *every* answer is checked: loopback, RFC1918, link-local (including
 *      the `169.254.169.254` metadata address), carrier-grade NAT, multicast,
 *      unique-local IPv6, and IP literals in any of those ranges are refused.
 *      The check runs on the resolved addresses, so a hostname pointing at
 *      `127.0.0.1` is refused too.
 *   4. **Redirects are followed by hand**, at most twice, with the same checks
 *      applied to each hop — otherwise a public URL could redirect us inward.
 *   5. **The body is capped at 256 KB** while streaming, so one call can never
 *      pull an arbitrarily large file through the function.
 *   6. **Five seconds, end to end**, and only `text/html` is parsed.
 *   7. **Failures are vague on purpose** — the caller learns "couldn't read
 *      that link", never whether a port is open or a host exists.
 *
 * Nothing about the happy path changed: paste a link, get a title, a
 * description and an image back.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Never read more than this much of a page. */
const MAX_BYTES = 256 * 1024;
/** Whole operation budget. */
const TIMEOUT_MS = 5000;
/** At most this many redirect hops, each re-checked. */
const MAX_REDIRECTS = 2;

// ── address guards ──────────────────────────────────────────────────────────

/** Is this IPv4 string in a range that must never be reachable from here? */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** Is this IPv6 string (as Deno formats it) unsafe to reach? */
function isBlockedIPv6(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1") return true; // unspecified, loopback
  if (value.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(value)) return true; // unique local
  if (value.startsWith("ff")) return true; // multicast
  if (value.startsWith("2001:db8")) return true; // documentation
  // IPv4-mapped (::ffff:169.254.169.254) — check the embedded v4 too.
  const mapped = value.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

function isBlockedAddress(address: string): boolean {
  return address.includes(":") ? isBlockedIPv6(address) : isBlockedIPv4(address);
}

/**
 * Parse and vet a URL: scheme, port and — by resolving it — the actual address
 * we would connect to.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("unreadable");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unreadable");
  if (url.username || url.password) throw new Error("unreadable"); // no credentials in URLs
  if (url.port && !["80", "443", ""].includes(url.port)) throw new Error("unreadable");

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // An IP literal is checked directly — no DNS needed.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isBlockedAddress(host)) throw new Error("unreadable");
    return url;
  }

  // A name: resolve it and refuse if *any* answer is private. Deno resolves A
  // and AAAA; a hostname with several answers is only allowed when all of them
  // are safe, because we cannot control which one a fetch would pick.
  let answers: { address: string }[] = [];
  try {
    answers = await Deno.resolveDns(host, "A").then((v) => v.map((address) => ({ address })));
    try {
      const v6 = await Deno.resolveDns(host, "AAAA");
      answers = answers.concat(v6.map((address) => ({ address })));
    } catch {
      /* no AAAA record is fine */
    }
  } catch {
    // Resolution failed here — let the fetch try, but only for names, never
    // literals, and the same checks still run on every redirect hop.
    answers = [];
  }

  if (answers.length === 0) throw new Error("unreadable");
  for (const answer of answers) {
    if (isBlockedAddress(answer.address)) throw new Error("unreadable");
  }

  return url;
}

/** Read at most MAX_BYTES of a response body, cancelling the rest. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.length) break;
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Fetch a URL, following a couple of redirects by hand, vetting each hop. */
async function safeFetch(start: URL, signal: AbortSignal): Promise<Response | null> {
  let url = await assertPublicUrl(start.toString());

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), {
      signal,
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)" },
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      res.body?.cancel().catch(() => undefined);
      if (hop === MAX_REDIRECTS) return null;
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    return res;
  }
  return null;
}

// ── meta tag reading (unchanged) ────────────────────────────────────────────

const META_PATTERN = (property: string) => [
  new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
  new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
];

function getMeta(html: string, property: string): string | null {
  for (const pattern of META_PATTERN(property)) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/** Keep a text field sane before it goes into a bubble. */
const clean = (value: string | null, max: number) =>
  value === null ? null : value.replace(/\s+/g, " ").trim().slice(0, max) || null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. only the two of you ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userError || !uid) return json({ error: "Unauthorized" }, 401);

    const { data: isPartner } = await supabase.rpc("is_partner", { uid });
    if (isPartner !== true) return json({ error: "Unauthorized" }, 401);

    // ── 2. a sane URL ───────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as { url?: unknown };
    const raw = typeof body.url === "string" ? body.url.trim().slice(0, 2048) : "";
    if (!raw) return json({ error: "URL required" }, 400);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await safeFetch(new URL(raw), controller.signal);
      if (!res || !res.ok) return json({ error: "Could not read that link" }, 200);

      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!type.includes("text/html") && !type.includes("application/xhtml")) {
        res.body?.cancel().catch(() => undefined);
        return json({ error: "Could not read that link" }, 200);
      }

      const html = await readCapped(res);

      return json({
        title: clean(
          getMeta(html, "og:title") ?? getMeta(html, "twitter:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null,
          120,
        ),
        description: clean(getMeta(html, "og:description") ?? getMeta(html, "twitter:description") ?? getMeta(html, "description"), 240),
        image: clean(getMeta(html, "og:image") ?? getMeta(html, "twitter:image"), 500),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Deliberately vague: a probe learns nothing about what is behind the door.
    return json({ error: "Could not read that link" }, 200);
  }
});
