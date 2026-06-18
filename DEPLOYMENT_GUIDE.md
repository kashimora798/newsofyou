# 🚀 Complete Deployment Guide

This guide will help you deploy all the new features to your Supabase project.

## Prerequisites

- Access to your Supabase dashboard: https://supabase.com/dashboard/project/itjukxjshcobpibmbrzq
- OpenRouter API key (for AI features) - get one at https://openrouter.ai/

---

## Option A: Deploy via Supabase Dashboard (No CLI needed)

### Step 1: Apply Database Migrations

Go to your Supabase project → **SQL Editor** and run these migrations **in order**:

#### Migration 1: Security & RLS (CRITICAL - Run this first!)
```sql
-- Phase 1: Security hardening for the private couples chat.
--
-- Problem this fixes:
--   * messages SELECT/UPDATE were USING (true) -> any authenticated account could
--     read the entire private conversation and overwrite any message.
--   * Bans were enforced only in the React client, so a banned JWT could still
--     read/write via the API.
--   * A few tables exposed rows to every authenticated user instead of partners.
--
-- Strategy: this app has exactly two real users (role 'partner') plus an 'admin'.
-- We scope access to "is a partner/admin" and "is not currently banned", enforced
-- in the database so the client can no longer be bypassed.
--
-- Defensive: base tables live in the remote DB; everything here is idempotent.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when the given user is a real chat participant (partner or admin).
-- Role of record lives on public.users (see useUserRole + current_user_is_admin).
CREATE OR REPLACE FUNCTION public.is_partner(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = uid AND role IN ('partner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_partner(uuid) TO authenticated;

-- True when the given user has an active (not yet expired) ban.
CREATE OR REPLACE FUNCTION public.is_banned(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_bans
    WHERE user_id = uid AND banned_until > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- messages: replace permissive policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can reveal secret messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can read messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Owners can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Partners can update receipt fields" ON public.messages;

-- Only partners who are not banned can read the conversation.
CREATE POLICY "Partners can read messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_partner(auth.uid()) AND NOT public.is_banned(auth.uid()));

-- Only partners who are not banned can send, and only as themselves.
CREATE POLICY "Partners can insert their own messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_partner(auth.uid())
  AND NOT public.is_banned(auth.uid())
);

-- The owner may update their own message (edits, link previews, etc.).
CREATE POLICY "Owners can update their own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND NOT public.is_banned(auth.uid()))
WITH CHECK (auth.uid() = user_id);

-- The partner may update rows they did NOT author (to mark seen/delivered/revealed).
-- A trigger (below) ensures such updates can only touch receipt/reveal columns.
CREATE POLICY "Partners can update receipt fields"
ON public.messages FOR UPDATE
TO authenticated
USING (
  auth.uid() <> user_id
  AND public.is_partner(auth.uid())
  AND NOT public.is_banned(auth.uid())
)
WITH CHECK (auth.uid() <> user_id);

-- Guard: when a non-owner updates a message, only receipt/reveal columns may change.
-- This is what RLS alone cannot express (column-level write scoping).
CREATE OR REPLACE FUNCTION public.enforce_message_receipt_only_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner edits are unrestricted; only police non-owner updates.
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN
    IF NEW.content      IS DISTINCT FROM OLD.content
       OR NEW.message_type IS DISTINCT FROM OLD.message_type
       OR NEW.user_id   IS DISTINCT FROM OLD.user_id
       OR NEW.username  IS DISTINCT FROM OLD.username
       OR NEW.file_url  IS DISTINCT FROM OLD.file_url
       OR NEW.gif_url   IS DISTINCT FROM OLD.gif_url
       OR NEW.sticker_url IS DISTINCT FROM OLD.sticker_url
       OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only receipt fields may be updated on a partner''s message';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_receipt_only_update ON public.messages;
CREATE TRIGGER trg_enforce_message_receipt_only_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_receipt_only_update();

-- ---------------------------------------------------------------------------
-- Input hardening: message length + flood guard
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length_chk
  CHECK (content IS NULL OR char_length(content) <= 4000);

-- Soft anti-flood: at most 20 inserts per user per rolling 10 seconds.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.messages
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Sending too fast. Please slow down.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_rate_limit ON public.messages;
CREATE TRIGGER trg_enforce_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- Tighten other partner-only tables (were auth.role()='authenticated')
-- ---------------------------------------------------------------------------

-- pinned_messages: anyone authenticated could read. Restrict SELECT to partners.
DROP POLICY IF EXISTS "Authenticated users can view pinned messages" ON public.pinned_messages;
DROP POLICY IF EXISTS "Partners can view pinned messages" ON public.pinned_messages;
CREATE POLICY "Partners can view pinned messages"
  ON public.pinned_messages FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));

-- pending_animations: SELECT/DELETE are already scoped to target_user_id.
-- Tighten INSERT so only partners can enqueue animations.
DROP POLICY IF EXISTS "Authenticated users can insert pending animations" ON public.pending_animations;
DROP POLICY IF EXISTS "Partners can insert pending animations" ON public.pending_animations;
CREATE POLICY "Partners can insert pending animations"
  ON public.pending_animations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_partner(auth.uid()));

-- message_reactions: ensure only partners can read reactions.
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Partners can view reactions" ON public.message_reactions;
CREATE POLICY "Partners can view reactions"
  ON public.message_reactions FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));
```

⚠️ **IMPORTANT**: Test this migration immediately after applying! Log in as both partners and verify:
- Both can still see messages
- Non-partner accounts cannot access messages
- Banned users cannot read/write

---

#### Migration 2: Proposals System
```sql
-- Phase 3: Proposal / mutual-consent system.
--
-- One partner proposes something (e.g. "let's only talk 30 min", a shared
-- reminder, a date). It only becomes active when BOTH partners accept.

CREATE TABLE IF NOT EXISTS public.proposals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id       uuid NOT NULL,
  partner_id        uuid NOT NULL,
  type              text NOT NULL,            -- time_limit | reminder | no_phone | challenge | date | goodnight
  title             text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending', -- pending|accepted|declined|active|completed|expired
  proposer_accepted boolean NOT NULL DEFAULT true,
  partner_accepted  boolean NOT NULL DEFAULT false,
  starts_at         timestamptz,
  ends_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_partner ON public.proposals (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_proposer ON public.proposals (proposer_id, created_at DESC);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Only the two parties to a proposal may see it (and both must be partners).
DROP POLICY IF EXISTS "Parties can view proposals" ON public.proposals;
CREATE POLICY "Parties can view proposals"
  ON public.proposals FOR SELECT
  TO authenticated
  USING (
    public.is_partner(auth.uid())
    AND auth.uid() IN (proposer_id, partner_id)
  );

-- The proposer creates the proposal, addressed to their partner.
DROP POLICY IF EXISTS "Proposer can create proposals" ON public.proposals;
CREATE POLICY "Proposer can create proposals"
  ON public.proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = proposer_id
    AND public.is_partner(auth.uid())
    AND NOT public.is_banned(auth.uid())
  );

-- Either party may update (partner to accept/decline; proposer to cancel/complete).
DROP POLICY IF EXISTS "Parties can update proposals" ON public.proposals;
CREATE POLICY "Parties can update proposals"
  ON public.proposals FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (proposer_id, partner_id) AND public.is_partner(auth.uid()))
  WITH CHECK (auth.uid() IN (proposer_id, partner_id));

-- When both sides have accepted, flip to 'active' and stamp the window.
-- For time_limit proposals, ends_at = now + payload.minutes.
CREATE OR REPLACE FUNCTION public.proposal_activate_on_consent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  minutes integer;
BEGIN
  IF NEW.proposer_accepted AND NEW.partner_accepted
     AND NEW.status IN ('pending', 'accepted') THEN
    NEW.status := 'active';
    IF NEW.starts_at IS NULL THEN
      NEW.starts_at := now();
    END IF;

    IF NEW.type = 'time_limit' THEN
      minutes := COALESCE((NEW.payload ->> 'minutes')::int, 30);
      NEW.ends_at := COALESCE(NEW.starts_at, now()) + make_interval(mins => minutes);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_activate_on_consent ON public.proposals;
CREATE TRIGGER trg_proposal_activate_on_consent
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.proposal_activate_on_consent();

-- Realtime so the other partner sees proposals appear/accept live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
```

---

#### Migration 3: AI Memories
```sql
-- Phase 5: AI memory assistant.
--
-- Stores facts the assistant knows about each partner (things they like,
-- important dates, preferences). Facts are either captured manually
-- ("Remember this") or extracted automatically from recent messages.

CREATE TABLE IF NOT EXISTS public.ai_memories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL,            -- who saved it
  subject_user_id uuid NOT NULL,            -- who the fact is about
  fact            text NOT NULL,
  category        text NOT NULL DEFAULT 'other', -- likes|dislikes|important|date|other
  source          text NOT NULL DEFAULT 'manual', -- manual|auto
  confidence      real NOT NULL DEFAULT 1.0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_subject ON public.ai_memories (subject_user_id, created_at DESC);

-- Avoid duplicate auto-extracted facts about the same subject.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_memories_subject_fact
  ON public.ai_memories (subject_user_id, lower(fact));

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- Partners share one couple's memory: any partner may read all memories.
DROP POLICY IF EXISTS "Partners can view memories" ON public.ai_memories;
CREATE POLICY "Partners can view memories"
  ON public.ai_memories FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "Partners can insert memories" ON public.ai_memories;
CREATE POLICY "Partners can insert memories"
  ON public.ai_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id AND public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "Owners can delete memories" ON public.ai_memories;
CREATE POLICY "Owners can delete memories"
  ON public.ai_memories FOR DELETE
  TO authenticated
  USING (public.is_partner(auth.uid()));
```

---

#### Migration 4: Decoy Mode
```sql
-- Phase 7: Decoy / panic mode settings.
--
-- Lets a user disguise the private chat as a famous AI app (ChatGPT/Gemini/Claude)
-- and return to the real chat by typing a secret code into the decoy's input.

ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_skin text NOT NULL DEFAULT 'chatgpt';   -- chatgpt|gemini|claude
ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_unlock_hash text;                       -- sha-256 hex of the code
ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_enabled boolean NOT NULL DEFAULT false;
```

---

### Step 2: Set OpenRouter API Key

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add a new secret:
   - Name: `OPENROUTER_API_KEY`
   - Value: Your OpenRouter API key (get one at https://openrouter.ai/)

---

### Step 3: Deploy Edge Functions

Unfortunately, edge functions **cannot** be deployed via the dashboard. You need the Supabase CLI for this.

**Install Supabase CLI:**

```powershell
# Using npm
npm install -g supabase

# Or using scoop (Windows package manager)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Then deploy the functions:**

```powershell
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref itjukxjshcobpibmbrzq

# Deploy all AI functions
supabase functions deploy ai-compose-help
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy ai-companion
supabase functions deploy ai-decoy-bot
```

---

## Option B: Full CLI Deployment (Recommended)

If you install the Supabase CLI, you can deploy everything with a few commands:

```powershell
# Install CLI (if not already installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref itjukxjshcobpibmbrzq

# Apply all migrations
supabase db push

# Set the API key
supabase secrets set OPENROUTER_API_KEY=sk-or-your-key-here

# Deploy all functions
supabase functions deploy ai-compose-help
supabase functions deploy ai-memory-extract
supabase functions deploy ai-message-guard
supabase functions deploy ai-companion
supabase functions deploy ai-decoy-bot

# Regenerate types (optional but recommended)
supabase gen types typescript --project-id itjukxjshcobpibmbrzq > src/integrations/supabase/types.ts
```

---

## Verification Checklist

After deployment, test these features:

### ✅ Security (Critical!)
- [ ] Log in as both partners - both can see messages
- [ ] Try accessing messages as a non-partner account - should fail
- [ ] Trigger a 5-minute ban - banned user cannot read/write messages

### ✅ Proposals
- [ ] Create a "Talk for 30 min" pact
- [ ] Partner sees the accept/decline banner
- [ ] Accept it - countdown appears
- [ ] Timer reaches 0 - soft "time's up" overlay shows

### ✅ AI Features (requires OpenRouter key)
- [ ] Click ✨ button in input - rewrites draft text
- [ ] Long-press a message → "Teach AI" - saves a memory
- [ ] Long-press a message → "Ask companion" - shows AI response

### ✅ Decoy Mode
- [ ] Settings → Quick Hide → enable, pick a skin, set unlock code
- [ ] Mask button appears in chat header
- [ ] Tap mask - shows disguised AI app
- [ ] Type unlock code - returns to real chat
- [ ] Type wrong code - stays in decoy mode

---

## What's Next?

Once deployed, you can:

1. **Build the app**: `npm run build`
2. **Deploy to Vercel**: `vercel --prod`
3. **Test all features** using the checklist above

---

## Troubleshooting

**"Function not found" errors:**
- Make sure you deployed the edge functions with `supabase functions deploy`
- Check that OPENROUTER_API_KEY is set in Supabase secrets

**"Permission denied" on messages:**
- Verify Migration 1 (secure_rls.sql) was applied successfully
- Check that your user has role 'partner' or 'admin' in the `users` table

**AI features not working:**
- Verify OPENROUTER_API_KEY is set correctly
- Check edge function logs in Supabase dashboard

---

## Need Help?

- Check the original `DEPLOYMENT_NOTES.md` for more details
- Review edge function logs in Supabase dashboard
- Test each migration individually if something fails
