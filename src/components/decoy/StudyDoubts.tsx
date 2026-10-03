import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { answerDoubt } from "@/lib/studyData";

/**
 * StudyDoubts — the "doubt solver" inside the decoy portal.
 *
 * This is deliberately NOT an LLM call: the answers come from a small local
 * keyword bank (`answerDoubt`), so the decoy page never spends a token, never
 * touches the router and never sends a stranger's question anywhere.
 */

interface Turn {
  role: "student" | "buddy";
  text: string;
}

const SEED: Turn[] = [
  { role: "student", text: "Explain the difference between the light reaction and the Calvin cycle quickly" },
  {
    role: "buddy",
    text: "Light reaction (thylakoid membranes): light splits water, releasing O₂ and making ATP + NADPH. Calvin cycle (stroma): ATP and NADPH fix CO₂ into glucose through RuBisCO. So: light reaction makes energy carriers, the Calvin cycle spends them to build sugar.",
  },
  { role: "student", text: "thanks, and how do I remember the mole formulas?" },
  {
    role: "buddy",
    text: "Keep three relationships on one card: n = m/M, n = N/6.022×10²³, and n = V/22.4 L at STP. Everything else in stoichiometry is just converting to moles, using the balanced ratio, then converting back.",
  },
];

const SUGGESTIONS = [
  "Derive Newton's second law",
  "Integration by parts example",
  "Ohm's law with two resistors in parallel",
  "Mendel's laws in one paragraph",
  "Letter to the editor format",
];

const StudyDoubts: React.FC = () => {
  const [turns, setTurns] = useState<Turn[]>(SEED);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, thinking]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;
    setTurns((prev) => [...prev, { role: "student", text: q }]);
    setText("");
    setThinking(true);
    const answer = answerDoubt(q);
    window.setTimeout(
      () => {
        setTurns((prev) => [...prev, { role: "buddy", text: answer }]);
        setThinking(false);
      },
      550 + Math.min(1400, answer.length * 4),
    );
  };

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[420px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50">
          <Bot className="h-4 w-4 text-indigo-600" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">StudyBuddy</p>
          <p className="text-[11px] text-slate-400">Class 12 · Science · answers from the school material</p>
        </div>
        <span className="hidden rounded-full bg-emerald-50 px-2 py-[2px] text-[10px] font-medium text-emerald-700 sm:block">
          online
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                t.role === "student"
                  ? "rounded-br-md bg-indigo-600 text-white"
                  : "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {t.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-200"
            >
              <Sparkles className="h-3 w-3 text-slate-400" />
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your doubt (e.g. explain titration errors)"
            className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!text.trim() || thinking}
            className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            aria-label="send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Answers are generated from the class-12 study material. Verify with your teacher before submitting work.
        </p>
      </div>
    </div>
  );
};

export default StudyDoubts;
