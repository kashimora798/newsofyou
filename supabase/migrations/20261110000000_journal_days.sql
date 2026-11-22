-- Auto Journal: per-day customisation for the "Our Journal" e-book.
--
-- The journal itself is generated on the fly from the `messages` table; this
-- table only stores how each day's page(s) are decorated (emojis, ink colour,
-- paper style, washi tape, a custom title and a little caption).
-- One row per calendar day, shared by both partners (it is one shared book).

CREATE TABLE IF NOT EXISTS public.journal_days (
  day         date PRIMARY KEY,
  emojis      text[]  NOT NULL DEFAULT '{}',
  accent      text    NOT NULL DEFAULT 'rose',
  paper       text    NOT NULL DEFAULT 'dotted',
  washi       text    NOT NULL DEFAULT 'stripes',
  title       text,
  caption     text,
  mood        text,
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view journal days" ON public.journal_days;
CREATE POLICY "Partners can view journal days"
  ON public.journal_days FOR SELECT
  TO authenticated
  USING (public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "Partners can insert journal days" ON public.journal_days;
CREATE POLICY "Partners can insert journal days"
  ON public.journal_days FOR INSERT
  TO authenticated
  WITH CHECK (public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "Partners can update journal days" ON public.journal_days;
CREATE POLICY "Partners can update journal days"
  ON public.journal_days FOR UPDATE
  TO authenticated
  USING (public.is_partner(auth.uid()))
  WITH CHECK (public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "Partners can delete journal days" ON public.journal_days;
CREATE POLICY "Partners can delete journal days"
  ON public.journal_days FOR DELETE
  TO authenticated
  USING (public.is_partner(auth.uid()));
