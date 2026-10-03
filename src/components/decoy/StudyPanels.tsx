import React, { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, FileText, IndianRupee, Percent, TrendingUp } from "lucide-react";
import {
  percent,
  inr,
  todayTimetable,
  type StudyData,
  type StudySubject,
} from "@/lib/studyData";

/**
 * StudyPanels — the inner screens of the decoy student portal.
 *
 * All light-mode, dense and utilitarian on purpose: this must read like a real
 * school ERP, not like the couples app. No component here talks to Supabase.
 */

const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  title,
  hint,
  children,
  className,
}) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
    <header className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </header>
    <div className="px-4 py-3">{children}</div>
  </section>
);

const Bar: React.FC<{ value: number; tone?: "indigo" | "emerald" | "amber" | "rose" }> = ({ value, tone = "indigo" }) => {
  const tones = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    submitted: "bg-sky-50 text-sky-700 border-sky-200",
    graded: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    due: "bg-rose-50 text-rose-700 border-rose-200",
    upcoming: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`rounded-full border px-2 py-[2px] text-[10px] font-medium capitalize ${map[status] ?? map.upcoming}`}>
      {status}
    </span>
  );
};

const average = (s: StudySubject) => {
  const parts = [s.marks.test1, s.marks.test2, s.marks.unitTest];
  if (s.marks.practical != null) parts.push(s.marks.practical * (100 / 30));
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
};

// ── Dashboard ────────────────────────────────────────────────────────────
export const StudyDashboard: React.FC<{ data: StudyData; onOpen: (tab: string) => void }> = ({ data, onOpen }) => {
  const { day, periods } = todayTimetable(data);
  const pending = data.assignments.filter((a) => a.status === "pending");
  const attendance = percent(data.attendanceSummary.present, data.attendanceSummary.total);
  const graded = data.assignments.filter((a) => a.status === "graded");
  const scored = graded.reduce((n, a) => n + (a.score ?? 0), 0);
  const outOf = graded.reduce((n, a) => n + a.marks, 0);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const next =
    periods.find((p) => {
      const [h, m] = p.time.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    }) ?? periods[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Attendance", value: `${attendance}%`, sub: `${data.attendanceSummary.workingDays} working days`, icon: Percent, tone: attendance >= 85 ? "emerald" : "amber" },
          { label: "Assignments graded", value: `${percent(scored, outOf)}%`, sub: `${graded.length} of ${data.assignments.length} submitted`, icon: TrendingUp, tone: "indigo" },
          { label: "Pending work", value: String(pending.length), sub: pending[0] ? `Next: ${pending[0].title}` : "All clear", icon: Clock, tone: pending.length > 3 ? "rose" : "amber" },
          { label: "Fees", value: inr(data.fees.filter((f) => f.status === "due").reduce((n, f) => n + f.amount, 0)), sub: "Term 2 window closes 10 Oct", icon: IndianRupee, tone: "indigo" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{card.label}</p>
              <card.icon className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{card.value}</p>
            <p className="mt-1 truncate text-[11px] text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Today · ${day}`} hint={`${periods.length} periods`} className="lg:col-span-2">
          <ul className="divide-y divide-slate-100">
            {periods.slice(0, 6).map((p) => (
              <li key={`${p.time}-${p.subject}`} className="flex items-center gap-3 py-2">
                <span className="w-14 text-xs font-medium text-slate-500">{p.time}</span>
                <span className="flex-1 text-sm text-slate-800">{p.subject}</span>
                <span className="hidden text-xs text-slate-400 sm:block">{p.teacher}</span>
                <span className="rounded border border-slate-200 px-1.5 py-[1px] text-[10px] text-slate-500">{p.room}</span>
              </li>
            ))}
          </ul>
          {next && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Next up: <span className="font-medium text-slate-700">{next.subject}</span> at {next.time} · {next.room}
            </p>
          )}
        </Panel>

        <Panel title="Notices" hint="School" >
          <ul className="space-y-3">
            {data.notices.slice(0, 3).map((n) => (
              <li key={n.title}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-[1px] text-[10px] uppercase tracking-wide text-slate-500">{n.tag}</span>
                  <span className="text-[10px] text-slate-400">{n.date}</span>
                </div>
                <p className="mt-1 text-[13px] font-medium leading-snug text-slate-800">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{n.body}</p>
              </li>
            ))}
          </ul>
          <button onClick={() => onOpen("notices")} className="mt-3 text-[11px] font-medium text-indigo-600 hover:underline">
            All notices →
          </button>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pending assignments" hint={`${pending.length} open`}>
          <ul className="divide-y divide-slate-100">
            {pending.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-800">{a.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {a.subject} · {a.marks} marks
                  </p>
                </div>
                <span className="whitespace-nowrap text-[11px] text-amber-600">{a.due}</span>
              </li>
            ))}
            {pending.length === 0 && <li className="py-3 text-sm text-slate-400">Nothing pending. Well done.</li>}
          </ul>
          <button onClick={() => onOpen("assignments")} className="mt-3 text-[11px] font-medium text-indigo-600 hover:underline">
            Open assignment tracker →
          </button>
        </Panel>

        <Panel title="Half-yearly date sheet" hint="Exam cell">
          <ul className="divide-y divide-slate-100">
            {data.examSchedule.map((e) => (
              <li key={e.paper} className="flex items-center gap-3 py-2">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-800">{e.paper}</p>
                  <p className="text-[11px] text-slate-400">{e.time} · {e.room}</p>
                </div>
                <span className="whitespace-nowrap text-[11px] text-slate-500">{e.date}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
};

// ── Subjects ─────────────────────────────────────────────────────────────
export const StudySubjects: React.FC<{ data: StudyData }> = ({ data }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {data.subjects.map((s) => {
      const att = percent(s.attendance.present, s.attendance.total);
      const chapterPct = percent(s.chaptersDone, s.chaptersTotal);
      return (
        <div key={s.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[15px] font-semibold text-slate-800">{s.name}</p>
              <p className="text-[11px] text-slate-400">{s.teacher} · {s.code}</p>
            </div>
            <span className="rounded bg-slate-50 px-2 py-[2px] text-[11px] text-slate-500">{s.periodsPerWeek}/week</span>
          </div>

          <dl className="mt-3 space-y-2.5">
            <div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <dt>Syllabus covered</dt>
                <dd>
                  {s.chaptersDone}/{s.chaptersTotal} chapters
                </dd>
              </div>
              <div className="mt-1">
                <Bar value={chapterPct} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <dt>Attendance</dt>
                <dd className={att < 85 ? "text-rose-600" : ""}>{att}%</dd>
              </div>
              <div className="mt-1">
                <Bar value={att} tone={att >= 85 ? "emerald" : "rose"} />
              </div>
            </div>
          </dl>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["T1", s.marks.test1],
              ["T2", s.marks.test2],
              ["UT", s.marks.unitTest],
              ["PR", s.marks.practical],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{String(label)}</p>
                <p className="text-[13px] font-medium text-slate-700">{value == null ? "—" : String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

// ── Timetable ────────────────────────────────────────────────────────────
export const StudyTimetable: React.FC<{ data: StudyData }> = ({ data }) => {
  const days = Object.keys(data.timetable);
  const [day, setDay] = useState(days[Math.max(0, Math.min(new Date().getDay() - 1, days.length - 1))]);
  const periods = data.timetable[day] ?? [];

  return (
    <Panel
      title={`Weekly timetable · ${day}`}
      hint="Room numbers change for labs"
      className="overflow-hidden"
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              d === day ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="py-2 pr-3 font-medium">Subject</th>
              <th className="py-2 pr-3 font-medium">Teacher</th>
              <th className="py-2 font-medium">Room</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.map((p) => (
              <tr key={`${p.time}-${p.subject}`}>
                <td className="py-2 pr-3 text-slate-500">{p.time}</td>
                <td className="py-2 pr-3 text-slate-800">{p.subject}</td>
                <td className="py-2 pr-3 text-slate-500">{p.teacher}</td>
                <td className="py-2 text-slate-500">{p.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Break 10:30–10:50 · Lunch 13:20–14:00. Practicals are held in the last two periods.
      </p>
    </Panel>
  );
};

// ── Assignments ──────────────────────────────────────────────────────────
export const StudyAssignments: React.FC<{ data: StudyData }> = ({ data }) => {
  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");
  const rows = useMemo(
    () => (filter === "all" ? data.assignments : data.assignments.filter((a) => a.status === filter)),
    [data.assignments, filter],
  );

  return (
    <Panel title="Assignment tracker" hint={`${rows.length} entries`}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "pending", "submitted", "graded"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
              f === filter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-medium">Assignment</th>
              <th className="py-2 pr-3 font-medium">Subject</th>
              <th className="py-2 pr-3 font-medium">Due</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="py-2 pr-3 text-slate-800">{a.title}</td>
                <td className="py-2 pr-3 text-slate-500">{a.subject}</td>
                <td className="py-2 pr-3 text-slate-500">{a.due}</td>
                <td className="py-2 pr-3 text-slate-700">{a.score == null ? "—" : `${a.score}/${a.marks}`}</td>
                <td className="py-2">
                  <StatusPill status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

// ── Notes ────────────────────────────────────────────────────────────────
export const StudyNotes: React.FC<{ data: StudyData }> = ({ data }) => (
  <Panel title="Notes & study material" hint={`${data.notes.length} files`}>
    <ul className="divide-y divide-slate-100">
      {data.notes.map((n) => (
        <li key={n.id} className="flex items-center gap-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
            PDF
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-slate-800">{n.title}</p>
            <p className="text-[11px] text-slate-400">
              {n.subject} · {n.pages} pages · updated {n.updated}
            </p>
          </div>
          <button className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
            Open
          </button>
        </li>
      ))}
    </ul>
  </Panel>
);

// ── Results ──────────────────────────────────────────────────────────────
export const StudyResults: React.FC<{ data: StudyData }> = ({ data }) => {
  const overall = Math.round(data.subjects.reduce((n, s) => n + average(s), 0) / data.subjects.length);
  return (
    <div className="space-y-4">
      <Panel title="Term 1 performance" hint={`Overall ${overall}%`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 font-medium">Test 1</th>
                <th className="py-2 pr-3 font-medium">Test 2</th>
                <th className="py-2 pr-3 font-medium">Unit test</th>
                <th className="py-2 pr-3 font-medium">Practical</th>
                <th className="py-2 font-medium">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.subjects.map((s) => (
                <tr key={s.code}>
                  <td className="py-2 pr-3 text-slate-800">{s.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.marks.test1}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.marks.test2}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.marks.unitTest}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.marks.practical ?? "—"}</td>
                  <td className="py-2 font-medium text-slate-800">{average(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Where to focus" hint="Based on unit-test scores">
        <ul className="space-y-2.5">
          {[...data.subjects]
            .sort((a, b) => a.marks.unitTest - b.marks.unitTest)
            .slice(0, 3)
            .map((s) => (
              <li key={s.code}>
                <div className="flex justify-between text-[12px] text-slate-600">
                  <span>{s.name}</span>
                  <span>{s.marks.unitTest}/100</span>
                </div>
                <div className="mt-1">
                  <Bar value={s.marks.unitTest} tone={s.marks.unitTest < 70 ? "amber" : "indigo"} />
                </div>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
};

// ── Attendance ───────────────────────────────────────────────────────────
export const StudyAttendance: React.FC<{ data: StudyData }> = ({ data }) => {
  const overall = percent(data.attendanceSummary.present, data.attendanceSummary.total);
  return (
    <div className="space-y-4">
      <Panel title={`Attendance · ${data.attendanceSummary.month}`} hint={`${overall}% overall`}>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-3xl font-semibold text-slate-800">{overall}%</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {data.attendanceSummary.present} present / {data.attendanceSummary.total} periods
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {overall >= 85 ? "Above the 85% requirement" : "Below the 85% requirement"}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Last 30 working days</p>
            <div className="grid grid-cols-10 gap-1">
              {data.attendanceGrid.map((present, i) => (
                <span
                  key={i}
                  title={present ? "Present" : "Absent"}
                  className={`h-5 rounded ${present ? "bg-emerald-400/80" : "bg-rose-300/80"}`}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Green = present, red = absent or leave.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Subject-wise">
        <ul className="space-y-3">
          {data.subjects.map((s) => {
            const att = percent(s.attendance.present, s.attendance.total);
            return (
              <li key={s.code}>
                <div className="flex justify-between text-[12px] text-slate-600">
                  <span>
                    {s.name} <span className="text-slate-400">· {s.teacher}</span>
                  </span>
                  <span className={att < 85 ? "text-rose-600" : ""}>
                    {att}% ({s.attendance.present}/{s.attendance.total})
                  </span>
                </div>
                <div className="mt-1">
                  <Bar value={att} tone={att >= 85 ? "emerald" : "rose"} />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
};

// ── Fees ─────────────────────────────────────────────────────────────────
export const StudyFees: React.FC<{ data: StudyData }> = ({ data }) => {
  const due = data.fees.filter((f) => f.status === "due").reduce((n, f) => n + f.amount, 0);
  return (
    <div className="space-y-4">
      <Panel title="Fee summary" hint={due > 0 ? `${inr(due)} payable` : "Nothing due"}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-medium">Particulars</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Paid on</th>
                <th className="py-2 pr-3 font-medium">Receipt</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.fees.map((f) => (
                <tr key={f.term}>
                  <td className="py-2 pr-3 text-slate-800">{f.term}</td>
                  <td className="py-2 pr-3 text-slate-600">{inr(f.amount)}</td>
                  <td className="py-2 pr-3 text-slate-500">{f.paidOn ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{f.receipt ?? "—"}</td>
                  <td className="py-2">
                    <StatusPill status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Term 2 fees are payable until 10 October. Online payment reflects in the portal within 24 hours.
        </p>
      </Panel>
    </div>
  );
};

// ── Notices ──────────────────────────────────────────────────────────────
export const StudyNotices: React.FC<{ data: StudyData }> = ({ data }) => (
  <Panel title="Notice board" hint="Updated by the school office">
    <ul className="space-y-4">
      {data.notices.map((n) => (
        <li key={n.title} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-[1px] text-[10px] uppercase tracking-wide text-slate-500">{n.tag}</span>
            <span className="text-[10px] text-slate-400">{n.date}</span>
          </div>
          <p className="mt-1 text-[13px] font-medium text-slate-800">{n.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{n.body}</p>
        </li>
      ))}
    </ul>
  </Panel>
);

// ── Progress cards (used by the shell's "Reports" tab) ───────────────────
export const StudyReports: React.FC<{ data: StudyData }> = ({ data }) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Panel title="Submission discipline" hint="Term 1">
      <ul className="space-y-3">
        {(["graded", "submitted", "pending"] as const).map((s) => {
          const n = data.assignments.filter((a) => a.status === s).length;
          const pct = percent(n, data.assignments.length);
          return (
            <li key={s}>
              <div className="flex justify-between text-[12px] capitalize text-slate-600">
                <span>{s}</span>
                <span>
                  {n} ({pct}%)
                </span>
              </div>
              <div className="mt-1">
                <Bar value={pct} tone={s === "pending" ? "amber" : s === "graded" ? "emerald" : "indigo"} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
    <Panel title="Strengths & watch-outs" hint="Auto-generated">
      <ul className="space-y-2 text-[12px] text-slate-600">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-emerald-500" />
          Consistent in {[...data.subjects].sort((a, b) => average(b) - average(a))[0]?.name}; keep the revision routine.
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-amber-500" />
          {[...data.subjects].sort((a, b) => a.marks.unitTest - b.marks.unitTest)[0]?.name} needs two extra problem-solving sessions a week.
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-sky-500" />
          Submit pending work before Friday; late submissions are graded out of half marks.
        </li>
      </ul>
    </Panel>
  </div>
);
