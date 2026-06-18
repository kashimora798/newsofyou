-- Phase 7: Decoy / panic mode settings.
--
-- Lets a user disguise the private chat as a famous AI app (ChatGPT/Gemini/Claude)
-- and return to the real chat by typing a secret code into the decoy's input.
--
-- The unlock code is stored as a hash (set/compared client-side via SubtleCrypto).
-- This is a shoulder-surfing disguise, not cryptographic protection of the data.

ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_skin text NOT NULL DEFAULT 'chatgpt';   -- chatgpt|gemini|claude
ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_unlock_hash text;                       -- sha-256 hex of the code
ALTER TABLE public.chat_user_settings
  ADD COLUMN IF NOT EXISTS decoy_enabled boolean NOT NULL DEFAULT false;
