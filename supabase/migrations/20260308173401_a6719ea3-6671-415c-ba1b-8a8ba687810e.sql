
-- Fix reminders RLS: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Users create reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users delete own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users see own or targeted reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users update own reminders" ON public.reminders;

CREATE POLICY "Users create reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users see own or targeted reminders" ON public.reminders FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (auth.uid() = target_user_id));
CREATE POLICY "Users update own reminders" ON public.reminders FOR UPDATE TO authenticated USING ((auth.uid() = user_id) OR (auth.uid() = target_user_id));

-- Fix shared_events RLS
DROP POLICY IF EXISTS "All authenticated users see events" ON public.shared_events;
DROP POLICY IF EXISTS "Users create events" ON public.shared_events;
DROP POLICY IF EXISTS "Users delete own events" ON public.shared_events;

CREATE POLICY "All authenticated users see events" ON public.shared_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create events" ON public.shared_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own events" ON public.shared_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix daily_checklists RLS
DROP POLICY IF EXISTS "Authenticated users can view all checklists" ON public.daily_checklists;
DROP POLICY IF EXISTS "Users can delete own checklist items" ON public.daily_checklists;
DROP POLICY IF EXISTS "Users can insert own checklist items" ON public.daily_checklists;
DROP POLICY IF EXISTS "Users can update own checklist items" ON public.daily_checklists;

CREATE POLICY "Authenticated users can view all checklists" ON public.daily_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can delete own checklist items" ON public.daily_checklists FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklist items" ON public.daily_checklists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklist items" ON public.daily_checklists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
