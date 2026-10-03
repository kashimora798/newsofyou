import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, GraduationCap, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import { useAuth } from "@/contexts/AuthContext";
import { setStudySession } from "@/lib/studySession";

/**
 * DecoyLogin — the front page of myanshika.xyz.
 *
 * On the surface: the student portal of a CBSE school (PT DP Mishra Memorial /
 * Eduflow Public School), which is exactly what a stranger should see if they
 * open the domain.
 *
 * Behind it:
 *   - The decoy credential is verified by the `decoy-login` edge function and
 *     opens the fake study portal (`/study`). It creates no session and reaches
 *     no real table.
 *   - `?real=1` (shown on the front page only as an inconspicuous "Faculty &
 *     alumni" link) reaches the real door — the spell login — and any signed-in
 *     couple account is offered a shortcut back to the app.
 *
 * Nothing about the real app is mentioned anywhere on this page.
 */

const SCHOOL = {
  trust: "PT DP Mishra Memorial",
  name: "Eduflow Public School",
  tagline: "Excellence in education",
  address: "Civil Lines, Kanpur · Affiliated to CBSE, New Delhi",
  session: "Session 2026–27",
};

const NOTICE_TICKER = [
  "Half-yearly date sheet released — check the notice board",
  "Term 2 fee window open until 10 October",
  "Annual day auditions on 12 October, auditorium",
  "Class 12 practicals begin next week",
];

const DecoyLogin: React.FC = () => {
  const navigate = useNavigate();
  const animationsEnabled = useAnimationsEnabled();
  const { user } = useAuth();

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    idRef.current?.focus();
  }, []);

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const r = (i * 9301 + 49297) % 233280;
        const rand = r / 233280;
        return {
          left: `${(rand * 100).toFixed(2)}%`,
          top: `${((rand * 7919) % 100).toFixed(2)}%`,
          size: rand > 0.8 ? 2.4 : 1.4,
          delay: `${(rand * 6).toFixed(2)}s`,
          opacity: 0.25 + rand * 0.5,
        };
      }),
    [],
  );

  const submit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (busy) return;
      const id = studentId.trim();
      if (!id || password.length < 4) {
        setError("Enter your student ID and password.");
        return;
      }

      setBusy(true);
      setError("");
      try {
        const { data, error: fnError } = await supabase.functions.invoke("decoy-login", {
          body: { id, password },
        });

        let payload = (data ?? {}) as {
          ok?: boolean;
          reason?: string;
          study?: { student_name?: string; grade?: string; board?: string; school?: string };
        };
        if (fnError && !payload.reason) {
          try {
            const body = await (fnError as { context?: Response }).context?.json();
            if (body) payload = body as typeof payload;
          } catch {
            /* keep the generic message */
          }
        }

        if (payload.ok && payload.study?.student_name) {
          setStudySession({
            student_name: payload.study.student_name,
            grade: payload.study.grade ?? "Class 12 · Science",
            board: payload.study.board ?? "CBSE",
            school: payload.study.school ?? SCHOOL.name,
          });
          navigate("/study", { replace: true });
          return;
        }

        setShake((n) => n + 1);
        setAttemptsLeft((n) => Math.max(0, n - 1));
        setPassword("");
        setError(
          payload.reason === "throttled"
            ? "Too many attempts. Try again after a few minutes or contact the school office."
            : "Incorrect student ID or password.",
        );
      } catch {
        setShake((n) => n + 1);
        setError("Could not reach the school server. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, studentId, password, navigate],
  );

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050a1e] text-slate-100">
      {/* backdrop: aurora ribbons, chalkboard haze, slow stars */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_-10%,#122a5e_0%,#0a1332_45%,#050a1e_100%)]" />
        <div
          className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.18), transparent 65%)" }}
        />
        <div
          className="absolute -right-16 bottom-0 h-[380px] w-[380px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(129,140,248,0.16), transparent 65%)" }}
        />
        <div
          className="absolute left-1/3 top-1/4 h-[300px] w-[300px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(14,116,144,0.14), transparent 70%)" }}
        />
        {animationsEnabled &&
          stars.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDuration: "6s",
                animationDelay: s.delay,
              }}
            />
          ))}
      </div>

      {/* a real session on this device? offer the way back, without saying what it is */}
      {user && (
        <Link
          to="/home"
          className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20"
        >
          Signed in · continue →
        </Link>
      )}

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Crest />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-sky-200/70">{SCHOOL.trust}</p>
              <h1 className="font-heading text-2xl font-semibold leading-tight text-white sm:text-[32px]">{SCHOOL.name}</h1>
              <p className="mt-1 text-[12px] text-white/50">{SCHOOL.address}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
            {["CBSE Affiliated", SCHOOL.session, "NAAC A+"].map((chip) => (
              <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
                {chip}
              </span>
            ))}
          </div>
        </header>

        <main className="mt-10 grid flex-1 items-start gap-10 lg:mt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* left: the school blurb */}
          <section className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-100/90">
              {SCHOOL.tagline}
            </span>
            <h2 className="mt-5 font-heading text-3xl leading-[1.15] text-white sm:text-[42px]">
              Learning, discipline and curiosity — in one place.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/65">
              The student portal gives every learner their timetable, assignments, notes, attendance and results in a single
              dashboard. Parents can follow fees and notices, and teachers publish material class-wise.
            </p>

            <dl className="mt-7 grid grid-cols-3 gap-3">
              {[
                ["2,400+", "Students"],
                ["138", "Faculty"],
                ["100%", "Board results"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
                  <dt className="text-[10px] uppercase tracking-wider text-white/45">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur">
              <p className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                <GraduationCap className="h-3.5 w-3.5" /> Notice board
              </p>
              <ul className="divide-y divide-white/5">
                {NOTICE_TICKER.map((n) => (
                  <li key={n} className="flex items-start gap-2 px-4 py-2.5 text-[12px] text-white/70">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-sky-300/70" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-[11px] text-white/35">
              Office hours 08:00–15:30 · Fee counter 09:00–13:00 · helpdesk@eduflow.edu.in
            </p>
          </section>

          {/* right: the student sign-in */}
          <section className="w-full lg:justify-self-end">
            <motion.div
              key={shake}
              animate={animationsEnabled && shake > 0 ? { x: [0, -9, 9, -6, 6, 0] } : undefined}
              transition={{ duration: 0.45 }}
              className="w-full rounded-[24px] border border-white/12 bg-white/[0.07] p-6 shadow-[0_30px_80px_-30px_rgba(2,6,23,0.9)] backdrop-blur-xl sm:p-7"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/15">
                  <Lock className="h-4 w-4 text-sky-200" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Student sign-in</h3>
                  <p className="text-[11px] text-white/45">Use the ID printed on your admit card</p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/50">
                    Student ID / Admission no.
                  </span>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      ref={idRef}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. 12S-27"
                      autoComplete="username"
                      className="h-12 w-full rounded-xl border border-white/12 bg-[#0a1332]/70 pl-10 pr-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-sky-300/50"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/50">Password</span>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-12 w-full rounded-xl border border-white/12 bg-[#0a1332]/70 pl-10 pr-11 text-[14px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-sky-300/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
                      aria-label={showPassword ? "hide password" : "show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRemember((v) => !v)}
                    className="flex items-center gap-2 text-white/55 transition-colors hover:text-white/80"
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded border ${
                        remember ? "border-sky-300/60 bg-sky-400/25" : "border-white/20"
                      }`}
                    >
                      {remember && <span className="h-1.5 w-1.5 rounded-sm bg-sky-100" />}
                    </span>
                    Keep me signed in
                  </button>
                  <button type="button" className="text-white/45 transition-colors hover:text-white/75">
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-[14px] font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Verifying…" : "Sign in"}
                </button>

                <div className="min-h-[18px] text-center text-[11.5px] text-rose-200/90" role="status" aria-live="polite">
                  {error || (attemptsLeft < 5 && !busy ? `Attempts left before lockout: ${attemptsLeft}` : "")}
                </div>
              </form>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-[11px] text-white/45">
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/70" />
                  Credentials issued by the school office. Never share your password.
                </p>
                <p>
                  New admission?{" "}
                  <button type="button" className="text-sky-200/80 underline-offset-2 hover:underline">
                    Collect your portal ID
                  </button>{" "}
                  from the front office.
                </p>
              </div>
            </motion.div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-white/35">
              <Link to="/real" className="transition-colors hover:text-white/70">
                Faculty &amp; alumni
              </Link>
              <span className="hidden h-3 w-px bg-white/15 sm:block" />
              <button type="button" className="transition-colors hover:text-white/70">
                Downloads
              </button>
              <span className="hidden h-3 w-px bg-white/15 sm:block" />
              <button type="button" className="transition-colors hover:text-white/70">
                Grievance cell
              </button>
            </div>
          </section>
        </main>

        <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/8 pt-5 text-[10.5px] text-white/30 sm:flex-row">
          <p>© {new Date().getFullYear()} {SCHOOL.name}, Kanpur. All rights reserved.</p>
          <p>Student portal v4.2 · Best viewed on a mobile device</p>
        </footer>
      </div>
    </div>
  );
};

/** Small inline crest — an open book with rays, no external assets. */
const Crest: React.FC = () => (
  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur">
    <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
      <defs>
        <linearGradient id="crest-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="none" stroke="url(#crest-g)" strokeWidth="1.4" opacity="0.7" />
      <path d="M24 14v18" stroke="url(#crest-g)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24 16c-3.6-2.4-7.2-2.6-9.4-2.2v16c2.2-.4 5.8-.2 9.4 2.2" fill="none" stroke="#e2e8f0" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M24 16c3.6-2.4 7.2-2.6 9.4-2.2v16c-2.2-.4-5.8-.2-9.4 2.2" fill="none" stroke="#e2e8f0" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M17 35h14" stroke="url(#crest-g)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  </span>
);

export default DecoyLogin;
