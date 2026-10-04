import React from "react";
import { Bell, ChevronRight, Compass, Heart, Loader2, LogOut, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import HomeScene from "@/components/home/HomeScene";
import { EXPLORE_LINKS } from "@/lib/exploreLinks";
import { daysTogether, ANNIVERSARY_START } from "@/lib/anniversary";
import { formatClock, formatToday, phaseGreeting, phaseWhisper, scenePhase } from "@/lib/sceneTime";

/**
 * DevScene — a design preview of the Home scene (Phase 3).
 *
 * `/home` needs a signed-in session, which a design review in a sandbox never
 * has. This page renders the same scene, header, hero pane, explore
 * constellations and section headings with placeholder content, so the visual
 * work can be looked at without touching the database.
 *
 * The route only exists when `import.meta.env.DEV` is true (see App.tsx), so it
 * is never part of a production build.
 */

const SceneHeading: React.FC<{ icon: React.ElementType; children: React.ReactNode; accent?: string }> = ({
  icon: Icon,
  children,
  accent,
}) => (
  <div className="flex items-center gap-2 px-1">
    <Icon className="h-3 w-3" style={{ color: accent ?? "hsl(var(--rose-glow) / 0.9)" }} />
    <span className="scene-label">{children}</span>
    <span className="scene-hairline flex-1" />
  </div>
);

const DevScene: React.FC = () => {
  const now = new Date();
  const phase = scenePhase(now);

  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden">
      <HomeScene />

      <header className="relative z-10 shrink-0 px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="scene-label">
              {formatToday(now)} · {formatClock(now)} · dev preview
            </p>
            <h1 className="mt-1 font-heading text-[26px] leading-tight text-[hsl(var(--moon-white))]">
              {phaseGreeting(phase)}
              <span className="text-[hsl(var(--rose-glow))]">, Kratagya</span>
            </h1>
            <p className="mt-1 text-[12px] text-[hsl(var(--mist))]">{phaseWhisper(phase, now.getHours())}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="relative">
              <span
                className="pointer-events-none absolute -inset-1.5 rounded-full blur-md"
                style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.35), transparent 70%)" }}
              />
              <span className="relative grid h-11 w-11 place-items-center rounded-full bg-[hsl(var(--night-800))] text-sm font-semibold text-[hsl(var(--moon-white))] ring-1 ring-[hsl(var(--moon-white)/0.25)]">
                K
              </span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full text-[hsl(var(--mist))]">
              <LogOut className="h-4 w-4" />
            </span>
          </div>
        </div>
      </header>

      <div className="night-scene relative z-10 flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        <div className="space-y-4">
          {/* twin greeting stand-in */}
          <div className="relative mb-2 mt-1 self-start">
            <div
              className="pointer-events-none absolute -inset-x-4 -inset-y-3 rounded-3xl blur-2xl"
              style={{ background: "radial-gradient(ellipse at 20% 30%, hsl(var(--rose-glow) / 0.45), transparent 70%)", opacity: 0.55 }}
            />
            <p className="relative font-handwriting text-[21px] leading-snug text-foreground">
              good evening, jaan — 471 days of you, and I still count them 🌙
            </p>
            <div className="relative mt-1.5 flex items-center gap-1.5 pl-0.5">
              <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-[2px] text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Kratagya's AI
              </span>
              <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">gentle</span>
            </div>
          </div>

          {/* hero */}
          <button className="pane pane-glow group w-full p-5 text-left">
            <div className="relative flex items-center gap-3.5">
              <span className="relative shrink-0">
                <span
                  className="pointer-events-none absolute -inset-2 rounded-full blur-lg"
                  style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.4), transparent 70%)" }}
                />
                <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--night-800))] text-lg font-semibold text-[hsl(var(--moon-white))] ring-1 ring-[hsl(var(--moon-white)/0.22)]">
                  A
                </span>
                <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[hsl(var(--night-900))] bg-[hsl(var(--online))]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate font-heading text-[17px] text-[hsl(var(--moon-white))]">Anshika</h3>
                  <span className="shrink-0 text-[10px] text-[hsl(var(--mist)/0.8)]">2m ago</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-[hsl(var(--online))]">Online now</p>
                <p className="mt-1 truncate text-[12px] text-[hsl(var(--mist)/0.85)]">khana kha liya? 🌙</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[hsl(var(--rose-glow))] px-2 text-[11px] font-bold text-[hsl(var(--night-900))]">
                  3
                </span>
                <ChevronRight className="h-5 w-5 text-[hsl(var(--rose-glow)/0.7)]" />
              </div>
            </div>
          </button>

          {/* days together */}
          <div className="flex items-center gap-3 px-2">
            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,hsl(var(--rose-glow)/0.35))]" />
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-heading text-[30px] leading-none text-[hsl(var(--moon-white))]">
                {daysTogether().toLocaleString()}
              </span>
              <span className="scene-label">days together</span>
            </div>
            <span className="h-px flex-1 bg-[linear-gradient(90deg,hsl(var(--rose-glow)/0.35),transparent)]" />
          </div>
          <p className="-mt-2 text-center text-[11px] text-[hsl(var(--mist)/0.75)]">
            since {ANNIVERSARY_START.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          {/* two sample ritual panes */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "Today's little things", body: "3 of 5 done · send a voice note before midnight", pct: 60 },
              { title: "Question of the day", body: "What is one small thing I did this week that you noticed?", pct: 0 },
            ].map((card) => (
              <div key={card.title} className="pane p-4">
                <p className="font-heading text-[15px] text-[hsl(var(--moon-white))]">{card.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--mist))]">{card.body}</p>
                {card.pct > 0 && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--moon-white)/0.08)]">
                    <div className="h-full rounded-full bg-[hsl(var(--rose-glow)/0.85)]" style={{ width: `${card.pct}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* explore */}
          <div className="space-y-3 pt-1">
            <SceneHeading icon={Compass}>Explore</SceneHeading>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
              {EXPLORE_LINKS.map((link) => (
                <div key={link.path} className="flex select-none flex-col items-center gap-1.5">
                  <span
                    className="relative grid h-12 w-12 place-items-center rounded-full"
                    style={{
                      background: `radial-gradient(circle at 32% 26%, hsl(${link.hue} 80% 72% / 0.26), hsl(${link.hue} 70% 60% / 0.05) 72%)`,
                      boxShadow: `inset 0 0 0 0.5px hsl(${link.hue} 70% 80% / 0.16)`,
                    }}
                  >
                    <link.icon className="relative h-[20px] w-[20px]" style={{ color: `hsl(${link.hue} 85% 80%)` }} />
                  </span>
                  <span className="text-center text-[9.5px] font-medium leading-tight text-[hsl(var(--mist))]">
                    {link.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <SceneHeading icon={Bell} accent="hsl(222 80% 76%)">Coming up</SceneHeading>
            <div className="pane p-4">
              <p className="text-[13px] text-[hsl(var(--moon-white))]">Her Chemistry practical file</p>
              <p className="mt-0.5 text-[11px] text-[hsl(var(--mist))]">reminder · tomorrow, 7:00 pm</p>
            </div>
            <div className="pane p-4">
              <p className="text-[13px] text-[hsl(var(--moon-white))]">Anniversary in 258 days</p>
              <p className="mt-0.5 text-[11px] text-[hsl(var(--mist))]">Saturday, 19 June 2027</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <SceneHeading icon={Heart}>Your bond</SceneHeading>
            <div className="pane p-4">
              <p className="font-heading text-[15px] text-[hsl(var(--moon-white))]">471 days · 55,653 messages</p>
              <p className="mt-1 text-[12px] text-[hsl(var(--mist))]">Current streak 12 days · longest 96 days</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <SceneHeading icon={Sparkles} accent="hsl(var(--gold-ink))">Discover</SceneHeading>
            <div className="pane p-4">
              <p className="text-[13px] leading-relaxed text-[hsl(var(--moon-white))]">
                On this day last year you two were arguing about who forgot the umbrella — then sent 41 messages in an hour.
              </p>
              <p className="mt-1 text-[11px] text-[hsl(var(--mist))]">On this day · AI summary of your own chats</p>
            </div>
          </div>

          <p className="flex items-center justify-center gap-2 pt-4 text-[10.5px] text-[hsl(var(--mist)/0.7)]">
            <Loader2 className="h-3 w-3" />
            dev-only preview · /home renders this with your real data
          </p>
        </div>
      </div>

      <nav className="relative z-10 shrink-0 border-t-[0.5px] border-border/60 px-2 py-1.5">
        <div className="flex items-center justify-around">
          {["Home", "Chat", "Games", "Profile"].map((label, i) => (
            <div key={label} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
              <span className="h-[22px] w-[22px] rounded-md border border-current opacity-70" />
              <span className="text-[10px] font-medium tracking-tight">{label}</span>
            </div>
          ))}
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[hsl(var(--night-900)/0.85)] px-3 py-1 text-[10px] text-[hsl(var(--moon-white)/0.7)] ring-1 ring-[hsl(var(--moon-white)/0.12)] backdrop-blur"
      >
        Phase 3 · HomeScene · {phase}
      </motion.div>
    </div>
  );
};

export default DevScene;
