import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Notebook,
  Percent,
  BarChart3,
  IndianRupee,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildStudyData } from "@/lib/studyData";
import { clearStudySession, getStudySession } from "@/lib/studySession";
import {
  StudyAssignments,
  StudyAttendance,
  StudyDashboard,
  StudyFees,
  StudyNotices,
  StudyNotes,
  StudyReports,
  StudyResults,
  StudySubjects,
  StudyTimetable,
} from "@/components/decoy/StudyPanels";
import StudyDoubts from "@/components/decoy/StudyDoubts";

/**
 * StudyApp — the fake student portal behind the decoy credential.
 *
 * Pure UI: every number comes from `buildStudyData()` (a seeded local dataset),
 * so nothing here can read or write the real app. It also holds the escape
 * hatch — the "exam cell verification code" that returns to the real door — so
 * that leaving the decoy never requires clearing site data.
 */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "timetable", label: "Timetable", icon: CalendarDays },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "notes", label: "Notes", icon: Notebook },
  { id: "results", label: "Results", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fees", label: "Fees", icon: IndianRupee },
  { id: "notices", label: "Notices", icon: Megaphone },
  { id: "doubts", label: "Doubt solver", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: BarChart3 },
] as const;

type TabId = (typeof NAV)[number]["id"];

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const StudyApp: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getStudySession();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState("");

  const data = useMemo(() => (session ? buildStudyData(session) : null), [session]);

  // the decoy portal only opens with the decoy credential — never by URL alone
  if (!session || !data) return <Navigate to="/" replace />;

  const leave = () => {
    clearStudySession();
    navigate("/", { replace: true });
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (codeBusy || !code.trim()) return;
    setCodeBusy(true);
    setCodeError("");
    try {
      const { data: payload, error } = await supabase.functions.invoke("decoy-login", {
        body: { unlock: await sha256Hex(code.trim()) },
      });
      const ok = (payload as { ok?: boolean } | null)?.ok === true && !error;
      if (ok) {
        clearStudySession();
        navigate(user ? "/home" : "/?real=1", { replace: true });
        return;
      }
      setCodeError("That code is not recognised. Check with the exam cell.");
      setCode("");
    } catch {
      setCodeError("Could not verify right now. Try again in a moment.");
    } finally {
      setCodeBusy(false);
    }
  };

  const pending = data.assignments.filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-slate-800">
              {data.profile.school} · Student Portal
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {data.profile.board} · {data.profile.grade} · Section {data.section} · Roll {data.roll}
            </p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
              {pending > 0 ? `${pending} pending` : "all clear"} · {data.session}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-[12px] font-semibold text-white">
              {data.profile.student_name.charAt(0)}
            </span>
            <span className="hidden text-[12px] text-slate-600 sm:block">{data.profile.student_name}</span>
            <button
              onClick={leave}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
              aria-label="sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                tab === item.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6">
        {/* desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  tab === item.id ? "bg-white font-medium text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white hover:shadow-sm"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
            <div className="!mt-4 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="text-[11px] font-medium text-slate-600">Exam cell</p>
              <p className="mt-1 text-[10.5px] leading-snug text-slate-400">
                Lost your admit card code? Verify it here.
              </p>
              <button
                onClick={() => setCodeOpen(true)}
                className="mt-2 flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
              >
                <Percent className="h-3 w-3" />
                Enter verification code
              </button>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {tab === "dashboard" && <StudyDashboard data={data} onOpen={(t) => setTab(t as TabId)} />}
          {tab === "subjects" && <StudySubjects data={data} />}
          {tab === "timetable" && <StudyTimetable data={data} />}
          {tab === "assignments" && <StudyAssignments data={data} />}
          {tab === "notes" && <StudyNotes data={data} />}
          {tab === "results" && <StudyResults data={data} />}
          {tab === "attendance" && <StudyAttendance data={data} />}
          {tab === "fees" && <StudyFees data={data} />}
          {tab === "notices" && <StudyNotices data={data} />}
          {tab === "doubts" && <StudyDoubts />}
          {tab === "reports" && <StudyReports data={data} />}

          <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} {data.profile.school}. Student portal v4.2</p>
            <p className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Report a problem to the helpdesk
            </p>
          </footer>
        </main>
      </div>

      {/* exam-cell verification code → back to the real door */}
      {codeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setCodeOpen(false)}>
          <form
            onSubmit={submitCode}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-[15px] font-semibold text-slate-800">Exam cell verification</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              Enter the verification code issued by the exam cell to unlock your admit card and re-verify your portal access.
            </p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              className="mt-4 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] outline-none focus:border-indigo-300 focus:bg-white"
            />
            {codeError && <p className="mt-2 text-[11.5px] text-rose-600">{codeError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCodeOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={codeBusy || !code.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {codeBusy ? "Verifying…" : "Verify"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default StudyApp;
