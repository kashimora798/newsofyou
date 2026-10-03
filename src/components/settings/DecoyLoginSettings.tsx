import React, { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hashCode } from "@/hooks/useDecoy";

/**
 * DecoyLoginSettings — the front-page decoy credential (Settings → Privacy).
 *
 * Two secrets live here:
 *   1. the fake student ID + password that opens the study portal from the front
 *      page (nothing real is behind it), and
 *   2. the "exam cell verification code" that returns to the real door from
 *      inside that portal.
 *
 * Only SHA-256 hashes are stored (server-side, service-role only), and the
 * password field is write-only: it never comes back to the browser. This is a
 * shoulder-surfing defence, not encryption.
 */

const DEFAULT_ID = "12S-27";
const DEFAULT_STUDENT = "Aarav Sharma";
const DEFAULT_GRADE = "Class 12 · Science";

interface DecoyConfig {
  enabled: boolean;
  login_id: string | null;
  student_name: string;
  grade: string;
  has_password: boolean;
  has_unlock: boolean;
}

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block space-y-1.5">
    <span className="block text-[12px] font-medium text-foreground">{label}</span>
    {children}
    {hint && <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
  </label>
);

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`h-11 w-full rounded-[12px] bg-muted/50 px-3.5 text-[14px] text-foreground outline-none ring-1 ring-border/40 transition focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 ${
      props.className ?? ""
    }`}
  />
);

const DecoyLoginSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<DecoyConfig | null>(null);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.rpc as any)("decoy_login_get");
      if (!error && data) {
        const cfg = data as DecoyConfig;
        setConfig(cfg);
        setLoginId(cfg.login_id ?? "");
        setStudentName(cfg.student_name ?? DEFAULT_STUDENT);
        setGrade(cfg.grade ?? DEFAULT_GRADE);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!loginId.trim() || !studentName.trim()) {
      toast({ title: "Student ID and name are needed", variant: "destructive" });
      return;
    }
    if (!config?.has_password && password.trim().length < 6) {
      toast({ title: "Choose a password (6+ characters)", description: "It is the fake password for the front page.", variant: "destructive" });
      return;
    }
    if (!config?.has_unlock && unlockCode.trim().length < 4) {
      toast({ title: "Choose an exam code", description: "This is how you get back out of the study portal.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("decoy_login_set", {
        p_login_id: loginId.trim(),
        p_password_hash: password.trim() ? await hashCode(password.trim()) : null,
        p_unlock_hash: unlockCode.trim() ? await hashCode(unlockCode.trim()) : null,
        p_student_name: studentName.trim(),
        p_grade: grade.trim() || DEFAULT_GRADE,
        p_enabled: true,
      });
      if (error) throw error;
      setPassword("");
      setUnlockCode("");
      const { data } = await (supabase.rpc as any)("decoy_login_get");
      if (data) setConfig(data as DecoyConfig);
      toast({ title: "Decoy login saved", description: "The front page now accepts that student ID." });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("decoy_login_clear");
      if (error) throw error;
      const { data } = await (supabase.rpc as any)("decoy_login_get");
      if (data) setConfig(data as DecoyConfig);
      setPassword("");
      setUnlockCode("");
      toast({ title: "Decoy login removed", description: "The front page will reject every sign-in attempt." });
    } catch (e) {
      toast({ title: "Could not remove", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…
      </div>
    );
  }

  const ready = Boolean(config?.has_password && config?.has_unlock && config?.login_id);

  return (
    <div className="space-y-3.5">
      <div className="rounded-[16px] bg-card p-4 ring-1 ring-border/40">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-medium text-foreground">Front page (decoy) login</p>
          <span
            className={`ml-auto rounded-full px-2 py-[2px] text-[10px] font-medium ${
              ready ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
            }`}
          >
            {ready ? "active" : "not set"}
          </span>
        </div>

        <p className="mb-4 text-[11.5px] leading-relaxed text-muted-foreground">
          What anyone sees at <span className="font-medium text-foreground">myanshika.xyz</span> is a school portal. This
          credential opens the study app behind it — nothing real is ever behind that door. The exam code brings you back here.
        </p>

        <div className="space-y-3">
          <Row label="Student ID shown on the sign-in form" hint={`Default ${DEFAULT_ID}. Use whatever looks normal to you.`}>
            <Field value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder={DEFAULT_ID} autoComplete="off" />
          </Row>

          <Row
            label={config?.has_password ? "New decoy password (leave blank to keep)" : "Decoy password"}
            hint="Stored only as a hash on the server. This is a glance-defence, not encryption."
          >
            <div className="relative">
              <Field
                type={showSecrets ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config?.has_password ? "••••••••  (unchanged)" : "choose a password"}
                autoComplete="new-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowSecrets((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                aria-label={showSecrets ? "hide" : "show"}
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Row>

          <Row
            label={config?.has_unlock ? "New exam code (leave blank to keep)" : "Exam code (way back out)"}
            hint="Type this into the study portal's “Exam cell verification” box to return to the real door."
          >
            <Field
              type={showSecrets ? "text" : "password"}
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              placeholder={config?.has_unlock ? "••••••••  (unchanged)" : "e.g. a word only you know"}
              autoComplete="new-password"
            />
          </Row>

          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Student name shown inside the portal">
              <Field value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={DEFAULT_STUDENT} />
            </Row>
            <Row label="Class">
              <Field value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={DEFAULT_GRADE} />
            </Row>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-primary text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {ready ? "Update decoy login" : "Save decoy login"}
          </button>
          {ready && (
            <button
              onClick={turnOff}
              disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-muted/60 px-4 text-[13px] font-medium text-foreground disabled:opacity-50"
            >
              <ShieldOff className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecoyLoginSettings;
