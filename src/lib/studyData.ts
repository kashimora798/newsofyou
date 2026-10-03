/**
 * studyData — the fixed dataset behind the decoy "school app".
 *
 * Everything here is invented and deterministic (seeded RNG, no network, no
 * database), which is exactly what makes the decoy safe: a visitor who logs in
 * with the decoy credential sees a busy, boring student portal and cannot reach
 * a single real table. Nothing in this file is ever mixed with real app data.
 */

export interface StudySubject {
  code: string;
  name: string;
  teacher: string;
  periodsPerWeek: number;
  chaptersDone: number;
  chaptersTotal: number;
  marks: { test1: number; test2: number; unitTest: number; practical: number | null };
  attendance: { present: number; total: number };
}

export interface StudyAssignment {
  id: string;
  subject: string;
  title: string;
  due: string;
  marks: number;
  status: "pending" | "submitted" | "graded";
  score: number | null;
}

export interface StudyNote {
  id: string;
  subject: string;
  title: string;
  pages: number;
  updated: string;
}

export interface StudyPeriod {
  time: string;
  subject: string;
  teacher: string;
  room: string;
}

export interface StudyFeeRow {
  term: string;
  amount: number;
  paidOn: string | null;
  receipt: string | null;
  status: "paid" | "due" | "upcoming";
}

export interface StudyProfile {
  student_name: string;
  grade: string;
  board: string;
  school: string;
}

export interface StudyData {
  profile: StudyProfile;
  roll: string;
  section: string;
  session: string;
  subjects: StudySubject[];
  timetable: Record<string, StudyPeriod[]>;
  assignments: StudyAssignment[];
  notes: StudyNote[];
  fees: StudyFeeRow[];
  notices: { date: string; title: string; body: string; tag: string }[];
  attendanceSummary: { present: number; total: number; workingDays: number; month: string };
  attendanceGrid: boolean[]; // last 30 working days, true = present
  examSchedule: { paper: string; date: string; time: string; room: string }[];
}

// ── deterministic randomness ─────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBJECTS: [string, string, string, number][] = [
  ["PHY", "Physics", "R. K. Verma", 6],
  ["CHE", "Chemistry", "S. Nair", 6],
  ["MAT", "Mathematics", "A. Bhattacharya", 7],
  ["BIO", "Biology", "P. Menon", 5],
  ["ENG", "English Core", "M. D'Souza", 4],
  ["CS", "Computer Science", "V. Iyer", 5],
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = ["08:00", "08:50", "09:40", "10:50", "11:40", "12:30", "14:00", "14:50"];

const ASSIGNMENT_TITLES: Record<string, string[]> = {
  PHY: ["Ray optics numericals set 3", "Potentiometer lab record", "Alternating current problems", "Wave optics worksheet"],
  CHE: ["Haloalkanes reactions chart", "Titration readings sheet", "Coordination compounds assignment", "Electrochemistry numericals"],
  MAT: ["Definite integrals exercise 7.9", "Linear programming case study", "Matrices revision sheet", "Probability practice set"],
  BIO: ["Ecosystem flow chart", "Human reproduction diagram", "Genetics problems set 2", "Biotechnology applications notes"],
  ENG: ["Letter to the editor draft", "Deep Water comprehension", "Poem analysis — Aunt Jennifer's Tigers", "Debate script: media and youth"],
  CS: ["SQL query practice", "Python file handling practical", "Stack implementation write-up", "Networking worksheet"],
};

const NOTE_TITLES: Record<string, string[]> = {
  PHY: ["Current Electricity — formula sheet", "Optics quick revision", "EMI & AC one-pagers"],
  CHE: ["Named reactions list", "p-block revision notes", "Mole concept refresher"],
  MAT: ["Integrals — standard results", "Vectors cheat sheet", "Continuity & differentiability summary"],
  BIO: ["NCERT line-by-line — Genetics", "Diagram bank (40 figures)", "Ecological pyramids notes"],
  ENG: ["Writing skills formats", "Novel: The Invisible Man chapter notes"],
  CS: ["Python standard library highlights", "DBMS normalisation notes"],
};

const NOTICES = [
  {
    tag: "Exam cell",
    title: "Half-yearly examination date sheet released",
    body: "The half-yearly date sheet is now on the notice board and the student portal. Reporting time is 09:30; carry your admit card and a transparent geometry box.",
    date: "2026-09-28",
  },
  {
    tag: "Academic",
    title: "Practical file submission — Physics and Chemistry",
    body: "Lab records for Term 1 must be submitted to the respective subject teachers before Friday. Late submissions will be graded out of half marks.",
    date: "2026-09-26",
  },
  {
    tag: "Fee office",
    title: "Term 2 fee window open until 10 October",
    body: "Pay online through the portal or at the fee counter between 09:00 and 13:00. A late fee of ₹50 per day applies after the closing date.",
    date: "2026-09-22",
  },
  {
    tag: "Cultural",
    title: "Annual day auditions — 12 October",
    body: "Auditions for the annual day programme will be held in the auditorium. Group entries should register with the class coordinator by 10 October.",
    date: "2026-09-20",
  },
  {
    tag: "Sports",
    title: "Inter-house cricket trials",
    body: "Trials for the senior boys' and girls' teams will take place on the main ground after school hours on Tuesday and Thursday.",
    date: "2026-09-18",
  },
];

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const isoDaysAhead = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const pretty = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Build the dataset for the signed-in demo student. */
export function buildStudyData(profile: StudyProfile): StudyData {
  const rand = mulberry32(20261003);

  const subjects: StudySubject[] = SUBJECTS.map(([code, name, teacher, periods]) => {
    const total = 120 + Math.round(rand() * 30);
    const ratio = 0.86 + rand() * 0.1;
    const mark = (base: number, spread: number) => Math.round((base + rand() * spread) * 10) / 10;
    return {
      code,
      name,
      teacher,
      periodsPerWeek: periods,
      chaptersTotal: 10 + Math.round(rand() * 6),
      chaptersDone: 0, // filled below (needs chaptersTotal)
      marks: {
        test1: mark(62, 26),
        test2: mark(60, 30),
        unitTest: mark(58, 32),
        practical: code === "ENG" || code === "MAT" ? null : mark(24, 6),
      },
      attendance: { present: Math.round(total * ratio), total },
    };
  });
  subjects.forEach((s) => {
    s.chaptersDone = Math.min(s.chaptersTotal, Math.round(s.chaptersTotal * (0.55 + rand() * 0.35)));
  });

  // ── timetable ──────────────────────────────────────────────────────────
  const timetable: Record<string, StudyPeriod[]> = {};
  WEEKDAYS.forEach((day, dayIdx) => {
    const periods: StudyPeriod[] = [];
    PERIODS.forEach((time, pIdx) => {
      const isBreak = pIdx === 3 || pIdx === 6;
      if (isBreak) return;
      const subject = SUBJECTS[(dayIdx * 3 + pIdx * 2 + 1) % SUBJECTS.length];
      const lab = subject[0] === "PHY" || subject[0] === "CHE" || subject[0] === "CS";
      periods.push({
        time,
        subject: lab && pIdx >= 6 ? `${subject[1]} Lab` : subject[1],
        teacher: subject[2],
        room: lab && pIdx >= 6 ? `${subject[0]} Lab` : `12-${(pIdx % 3) + 1}${dayIdx + 1}`,
      });
    });
    timetable[day] = periods;
  });

  // ── assignments ────────────────────────────────────────────────────────
  const assignments: StudyAssignment[] = [];
  let seq = 0;
  SUBJECTS.forEach(([code]) => {
    (ASSIGNMENT_TITLES[code] ?? []).forEach((title, i) => {
      seq += 1;
      const roll = rand();
      const status: StudyAssignment["status"] = roll < 0.45 ? "graded" : roll < 0.72 ? "submitted" : "pending";
      const dueOffset = status === "pending" ? Math.round(rand() * 9) + 1 : -(Math.round(rand() * 18) + 2);
      assignments.push({
        id: `${code}-${seq}`,
        subject: nameOf(code),
        title,
        due: pretty(status === "pending" ? isoDaysAhead(dueOffset) : isoDaysAgo(-dueOffset)),
        marks: [10, 15, 20, 25][i % 4],
        status,
        score: status === "graded" ? Math.round(([10, 15, 20, 25][i % 4] * (0.7 + rand() * 0.3)) * 10) / 10 : null,
      });
    });
  });
  assignments.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));

  // ── notes ──────────────────────────────────────────────────────────────
  const notes: StudyNote[] = [];
  SUBJECTS.forEach(([code], i) => {
    (NOTE_TITLES[code] ?? []).forEach((title, j) => {
      notes.push({
        id: `N-${code}-${j + 1}`,
        subject: nameOf(code),
        title,
        pages: 4 + Math.round(rand() * 26),
        updated: pretty(isoDaysAgo(3 + i * 2 + j * 5)),
      });
    });
  });

  // ── fees ───────────────────────────────────────────────────────────────
  const fees: StudyFeeRow[] = [
    { term: "Term 1 (Apr–Sep)", amount: 28500, paidOn: pretty(isoDaysAgo(196)), receipt: "EFS/25-26/01482", status: "paid" },
    { term: "Term 2 (Oct–Mar)", amount: 28500, paidOn: null, receipt: null, status: "due" },
    { term: "Transport (Jul–Sep)", amount: 4200, paidOn: pretty(isoDaysAgo(120)), receipt: "EFS/25-26/02033", status: "paid" },
    { term: "Transport (Oct–Dec)", amount: 4200, paidOn: null, receipt: null, status: "upcoming" },
    { term: "Annual charges", amount: 2600, paidOn: pretty(isoDaysAgo(204)), receipt: "EFS/25-26/00991", status: "paid" },
  ];

  // ── attendance ─────────────────────────────────────────────────────────
  const grid = Array.from({ length: 30 }, (_, i) => rand() > (i % 7 === 6 ? 0.5 : 0.09));
  const present = subjects.reduce((n, s) => n + s.attendance.present, 0);
  const total = subjects.reduce((n, s) => n + s.attendance.total, 0);

  return {
    profile,
    roll: "12S-27",
    section: "B",
    session: "2025–26",
    subjects,
    timetable,
    assignments,
    notes,
    fees,
    notices: NOTICES,
    attendanceSummary: {
      present,
      total,
      workingDays: 138,
      month: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    },
    attendanceGrid: grid,
    examSchedule: [
      { paper: "Physics (Theory)", date: pretty(isoDaysAhead(6)), time: "09:30 – 12:30", room: "Hall A" },
      { paper: "Chemistry (Theory)", date: pretty(isoDaysAhead(9)), time: "09:30 – 12:30", room: "Hall A" },
      { paper: "Mathematics", date: pretty(isoDaysAhead(12)), time: "09:30 – 12:30", room: "Hall B" },
      { paper: "Biology", date: pretty(isoDaysAhead(15)), time: "09:30 – 12:30", room: "Hall B" },
      { paper: "English Core", date: pretty(isoDaysAhead(18)), time: "09:30 – 12:30", room: "Hall C" },
      { paper: "Computer Science", date: pretty(isoDaysAhead(21)), time: "09:30 – 12:30", room: "CS Lab" },
    ],
  };
}

function nameOf(code: string): string {
  return SUBJECTS.find(([c]) => c === code)?.[1] ?? code;
}

export const percent = (part: number, whole: number) => Math.round((part / Math.max(1, whole)) * 100);
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Today's timetable, or the first weekday when it's a Sunday. */
export function todayTimetable(data: StudyData): { day: string; periods: StudyPeriod[] } {
  const idx = new Date().getDay(); // 0 = Sunday
  const day = WEEKDAYS[Math.max(0, Math.min(idx - 1, WEEKDAYS.length - 1))];
  return { day, periods: data.timetable[day] ?? [] };
}

/**
 * Small offline answer bank for the "Doubt Solver" helper. It matches on
 * keywords and otherwise returns a studious-looking study plan. Purely local —
 * no AI call, no data leaves the decoy screen.
 */
export function answerDoubt(question: string): string {
  const q = question.toLowerCase();

  if (/photosynthesis/.test(q)) {
    return "Photosynthesis is the process by which green plants use sunlight, water and CO₂ to make glucose and oxygen. It happens in two stages: the light reaction (thylakoid, makes ATP + NADPH) and the Calvin cycle (stroma, fixes CO₂). Net equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.";
  }
  if (/newton('s)? (second|2nd) law/.test(q)) {
    return "Newton's second law: the net force on a body equals its rate of change of momentum, F = dp/dt = ma for constant mass. Remember it is vector-valued, and it applies in an inertial frame.";
  }
  if (/integrat|integral/.test(q) && /x|∫/.test(q)) {
    return "For ∫x·dx use the power rule: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C, so ∫x dx = x²/2 + C. For products like x·eˣ, integrate by parts: ∫u dv = uv − ∫v du with u = x, dv = eˣ dx.";
  }
  if (/electro|ohm|resistance|circuit/.test(q)) {
    return "Ohm's law: V = IR (at constant temperature). For resistors in series add the resistances; in parallel add conductances: 1/R = 1/R₁ + 1/R₂. Kirchhoff's rules let you solve multi-loop circuits: junction rule (charge conservation) and loop rule (energy conservation).";
  }
  if (/mole|molar|stoichiom/.test(q)) {
    return "One mole = 6.022 × 10²³ particles. Mass → moles: n = m/M. For a balanced equation, coefficients are mole ratios, so convert every given quantity to moles first, then back to mass or volume (22.4 L per mole at STP).";
  }
  if (/genetic|dna|mendel/.test(q)) {
    return "Mendel's laws: dominance (one allele masks the other), segregation (alleles separate in gametes) and independent assortment (different genes sort independently). DNA codes via base pairing (A–T, G–C); transcription makes mRNA, translation makes protein.";
  }
  if (/matrix|matrices|determinant/.test(q)) {
    return "For a 2×2 matrix [[a,b],[c,d]], det = ad − bc, and the inverse exists only if det ≠ 0: (1/det)·[[d,−b],[−c,a]]. For 3×3, expand along a row (Laplace expansion) and watch the sign pattern + − +.";
  }
  if (/algorithm|time complexity|big o|sort/.test(q)) {
    return "Common bounds: linear search O(n), binary search O(log n) (sorted array only), merge sort O(n log n) worst case, bubble/insertion sort O(n²). Big-O describes the growth of the worst case as input size n grows.";
  }
  if (/essay|letter to the editor/.test(q)) {
    return "Letter to the editor format: 1) sender's address, 2) date, 3) receiver — “The Editor, <paper>”, 4) subject line, 5) salutation “Sir/Madam”, 6) three short paragraphs (issue → why it matters → suggestion), 7) “Yours faithfully” + name. Keep it under 150 words for a class-12 board answer.";
  }
  if (/time table|timetable|schedule|exam date/.test(q)) {
    return "Your exam date sheet and daily timetable are under Timetable and Results in the left menu. The half-yearly practicals start next week — carry your lab record and admit card.";
  }

  return (
    "Here is how I would approach it:\n" +
    "1) Write the given data with units, then the quantity asked for.\n" +
    "2) Pick the formula or theorem that links them (write it before substituting).\n" +
    "3) Substitute with units, keep 2–3 significant figures, and sanity-check the magnitude.\n" +
    "4) Re-do the step you are least sure about and compare.\n" +
    "If you paste the actual question (or upload a photo of the page), I can work through the exact steps."
  );
}
