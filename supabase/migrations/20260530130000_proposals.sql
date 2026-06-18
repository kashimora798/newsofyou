-- Phase 3: Proposal / mutual-consent system.
--
-- One partner proposes something (e.g. "let's only talk 30 min", a shared
-- reminder, a date). It only becomes active when BOTH partners accept.
--
-- Effects of activation (creating reminders, calendar events, etc.) are handled
-- client-side in useProposals so they reuse the existing per-table RLS inserts.
-- This migration owns the proposals table, its RLS, and the both-accepted ->
-- active state transition.

-- Self-contained helpers: create is_partner / is_banned if the Phase-1 secure_rls
-- migration hasn't been applied yet, so this migration works standalone.
CREATE OR REPLACE FUNCTION public.is_partner(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND role IN ('partner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_banned(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = uid
      AND (banned_until IS NULL OR banned_until > now())
  );
$$;

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
