
-- Table: starred_messages
CREATE TABLE public.starred_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL REFERENCES public.messages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stars"
  ON public.starred_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can star messages"
  ON public.starred_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unstar messages"
  ON public.starred_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Table: pinned_messages
CREATE TABLE public.pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id),
  pinned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pinned messages"
  ON public.pinned_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can pin messages"
  ON public.pinned_messages FOR INSERT
  WITH CHECK (auth.uid() = pinned_by);

CREATE POLICY "Users can unpin their own pins"
  ON public.pinned_messages FOR DELETE
  USING (auth.uid() = pinned_by);

-- Table: chat_user_settings
CREATE TABLE public.chat_user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT 'system',
  font_size TEXT NOT NULL DEFAULT 'medium',
  wallpaper_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON public.chat_user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON public.chat_user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.chat_user_settings FOR UPDATE
  USING (auth.uid() = user_id);
