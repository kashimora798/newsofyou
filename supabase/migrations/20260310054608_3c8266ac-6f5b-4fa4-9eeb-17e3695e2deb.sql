
-- Allow users to see compliments delivered TO them (from partner, already delivered)
CREATE POLICY "Users see received delivered compliments"
ON public.compliments
FOR SELECT
TO authenticated
USING (auth.uid() <> user_id AND is_delivered = true);
