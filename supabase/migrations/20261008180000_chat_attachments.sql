-- Chat media details, Phase 9c — the facts a WhatsApp-style bubble shows.
-- ============================================================================
-- `messages` stays read-only (hard rule #1): we never add a column to it. The
-- extras a media bubble needs live here instead, keyed by the **storage object
-- name**, which is already unique and already inside every URL the bubble has.
--
-- What this buys, with no change to the chat history:
--   * a document card can say "2 pages • 1.1 MB • PDF" after a reload — the page
--     count is read from the PDF's own bytes on the sender's device, once;
--   * an image can reserve its space before it loads (width/height), so a 4-photo
--     grid does not jump while the photos arrive;
--   * the 480 px preview uploaded beside each master is recorded, so grids can
--     use the small file and the full-size view uses the master.
--
-- Reads: both partners. Writes: the uploader, through one guarded RPC.
-- Idempotent; nothing dropped; nothing in `messages` is touched.

CREATE TABLE IF NOT EXISTS public.chat_attachments (
  path        text PRIMARY KEY,                    -- storage object name inside the bucket
  bucket      text NOT NULL DEFAULT 'chat-images',
  user_id     uuid NOT NULL,                       -- who uploaded it
  kind        text NOT NULL DEFAULT 'image',       -- image | video | audio | document
  mime        text,
  bytes       bigint,
  width       int,
  height      int,
  pages       int,                                 -- documents
  duration    numeric,                             -- audio / video, seconds
  thumb_path  text,                                -- the .thumb sibling, when one was made
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_user ON public.chat_attachments (user_id, created_at DESC);

ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- Both of them may read the details of anything in their chat.
DROP POLICY IF EXISTS "partners read attachments" ON public.chat_attachments;
CREATE POLICY "partners read attachments" ON public.chat_attachments
  FOR SELECT TO authenticated
  USING (public.is_partner(auth.uid()));

-- Only the uploader may write their own row.
DROP POLICY IF EXISTS "uploader inserts attachments" ON public.chat_attachments;
CREATE POLICY "uploader inserts attachments" ON public.chat_attachments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_partner(auth.uid()));

DROP POLICY IF EXISTS "uploader updates attachments" ON public.chat_attachments;
CREATE POLICY "uploader updates attachments" ON public.chat_attachments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.chat_attachments FROM anon;
GRANT SELECT ON TABLE public.chat_attachments TO authenticated;
GRANT ALL ON TABLE public.chat_attachments TO service_role;

-- ── The single writer ───────────────────────────────────────────────────
-- Called right after an upload, and safe to call again: a second save of the
-- same path only fills in what was missing (e.g. a page count read later).
CREATE OR REPLACE FUNCTION public.chat_attachment_save(
  p_path text,
  p_kind text DEFAULT 'image',
  p_mime text DEFAULT NULL,
  p_bytes bigint DEFAULT NULL,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL,
  p_pages integer DEFAULT NULL,
  p_duration numeric DEFAULT NULL,
  p_thumb_path text DEFAULT NULL,
  p_bucket text DEFAULT 'chat-images'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text := nullif(btrim(coalesce(p_path, '')), '');
  kind text := CASE WHEN p_kind IN ('image','video','audio','document') THEN p_kind ELSE 'image' END;
  saved public.chat_attachments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.is_partner(auth.uid()) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF clean IS NULL THEN RAISE EXCEPTION 'A path is required';
  IF length(clean) > 300 THEN RAISE EXCEPTION 'That path is too long'; END IF;

  INSERT INTO public.chat_attachments AS a (
    path, bucket, user_id, kind, mime, bytes, width, height, pages, duration, thumb_path
  ) VALUES (
    clean, coalesce(nullif(p_bucket, ''), 'chat-images'), auth.uid(), kind, p_mime,
    p_bytes, p_width, p_height, p_pages, p_duration, p_thumb_path
  )
  ON CONFLICT (path) DO UPDATE SET
    -- never overwrite a known value with a null; only fill the gaps
    mime       = coalesce(a.mime, excluded.mime),
    bytes      = coalesce(a.bytes, excluded.bytes),
    width      = coalesce(a.width, excluded.width),
    height     = coalesce(a.height, excluded.height),
    pages      = coalesce(a.pages, excluded.pages),
    duration   = coalesce(a.duration, excluded.duration),
    thumb_path = coalesce(a.thumb_path, excluded.thumb_path)
  RETURNING * INTO saved;

  RETURN jsonb_build_object(
    'ok', true,
    'path', saved.path,
    'kind', saved.kind,
    'width', saved.width,
    'height', saved.height,
    'pages', saved.pages,
    'thumb_path', saved.thumb_path
  );
END;
$$;
REVOKE ALL ON FUNCTION public.chat_attachment_save(text, text, text, bigint, integer, integer, integer, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_attachment_save(text, text, text, bigint, integer, integer, integer, numeric, text, text) TO authenticated, service_role;

-- ── Reading a window of the chat in one round trip ──────────────────────
-- Given the storage paths the visible bubbles point at, return their details.
CREATE OR REPLACE FUNCTION public.chat_attachments_for(p_paths text[])
RETURNS TABLE (path text, kind text, bytes bigint, width int, height int, pages int, duration numeric, thumb_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.path, a.kind, a.bytes, a.width, a.height, a.pages, a.duration, a.thumb_path
  FROM public.chat_attachments a
  WHERE a.path = ANY (coalesce(p_paths, ARRAY[]::text[]))
    AND public.is_partner(auth.uid())
  LIMIT 400;
$$;
REVOKE ALL ON FUNCTION public.chat_attachments_for(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_attachments_for(text[]) TO authenticated, service_role;

-- ── Verify ──────────────────────────────────────────────────────────────
--   select * from public.chat_attachments_for(
--     array['1728470000000_ab12cd.webp']);
