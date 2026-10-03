/**
 * studySession — the (fake) signed-in state for the decoy student portal.
 *
 * Nothing here is a credential: it is just the display fields the decoy-login
 * function returned, kept in sessionStorage so a refresh stays inside the study
 * app. There is no token, no Supabase session and nothing that could be replayed
 * against the real app. `clearStudySession` is what the "sign out" button and
 * the exam-code escape hatch use.
 */

import type { StudyProfile } from "@/lib/studyData";

const KEY = "noy_study_session_v1";

export interface StudySession extends StudyProfile {
  signedInAt: number;
}

export function getStudySession(): StudySession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudySession;
    if (!parsed?.student_name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStudySession(profile: StudyProfile): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...profile, signedInAt: Date.now() } satisfies StudySession));
  } catch {
    /* private mode — the portal still works for this tab */
  }
}

export function clearStudySession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
