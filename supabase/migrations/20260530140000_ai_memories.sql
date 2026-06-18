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
