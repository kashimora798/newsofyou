import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sun, Moon, Monitor, Loader2, Check, Upload, X, Clock, ChevronRight, Sticker, Heart, Trophy, Mail, Camera, LogOut, Bot, ShieldCheck, ImageDown } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNav from "@/components/layout/BottomNav";
import { isCalmMode, setCalmMode } from "@/hooks/useAnimationsEnabled";
import { hashCode } from "@/hooks/useDecoy";
import { uploadImage } from "@/lib/uploadImage";
import { DECOY_SKINS, type DecoySkin } from "@/lib/decoySkins";
import { useTwinConsent } from "@/hooks/useTwinConsent";
import { shrinkMediaEnabled, setShrinkMedia } from "@/lib/imageCompress";
import DecoyLoginSettings from "@/components/settings/DecoyLoginSettings";

const SettingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <SettingsView userId={user.id} />;
};

const WALLPAPER_PRESETS = [
  { value: "none", label: "Default", style: {} as React.CSSProperties },
  { value: "#E8E0F0", label: "Lavender", style: { backgroundColor: "#E8E0F0" } },
  { value: "#D5ECD4", label: "Mint", style: { backgroundColor: "#D5ECD4" } },
  { value: "#F5E0E0", label: "Pink", style: { backgroundColor: "#F5E0E0" } },
  { value: "#F0F0F0", label: "Gray", style: { backgroundColor: "#F0F0F0" } },
  { value: "#1a1a2e", label: "Navy", style: { backgroundColor: "#1a1a2e" } },
  { value: "linear-gradient(135deg, #E8E0F0, #D5ECD4)", label: "Lavender→Mint", style: { background: "linear-gradient(135deg, #E8E0F0, #D5ECD4)" } },
  { value: "linear-gradient(135deg, #F5E0E0, #FFE0CC)", label: "Pink→Peach", style: { background: "linear-gradient(135deg, #F5E0E0, #FFE0CC)" } },
  { value: "linear-gradient(135deg, #CCE5FF, #99C8FF)", label: "Sky→Ocean", style: { background: "linear-gradient(135deg, #CCE5FF, #99C8FF)" } },
];

const DYNAMIC_WALLPAPERS: Record<string, { label: string; gradient: string }> = {
  morning: { label: "🌅 Morning", gradient: "linear-gradient(135deg, #FFE4B5, #FFD4A0, #FFDAB9)" },
  afternoon: { label: "☀️ Afternoon", gradient: "linear-gradient(135deg, #87CEEB, #ADD8E6, #B0E0E6)" },
  evening: { label: "🌇 Evening", gradient: "linear-gradient(135deg, #FF8C69, #FF7F7F, #DDA0DD)" },
  night: { label: "🌙 Night", gradient: "linear-gradient(135deg, #191970, #2C2C54, #1a1a2e)" },
};

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

// ── Apple-style building blocks ───────────────────────────────────────────

/** Section label: small, uppercase, tertiary — like iOS grouped-list headers. */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70 px-1 mb-2">
    {children}
  </h3>
);

/** Grouped card — flat surface, continuous corners, hairline-divided rows. */
const Group: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-[18px] bg-card overflow-hidden divide-y divide-border/50 ring-1 ring-border/40 ${className ?? ""}`}>
    {children}
  </div>
);

/** A single tappable list row with icon, label, and trailing chevron. */
const Row: React.FC<{
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}> = ({ icon, label, sub, onClick, trailing }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
  >
    {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
    <div className="flex-1 min-w-0">
      <span className="text-[15px] text-foreground">{label}</span>
      {sub && <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{sub}</span>}
    </div>
    {trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
  </button>
);

/** iOS-style toggle. */
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`w-[51px] h-[31px] rounded-full transition-colors relative shrink-0 ${on ? "bg-[#34c759]" : "bg-muted-foreground/30"}`}
  >
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
      style={{ left: on ? "22px" : "2px" }}
    />
  </button>
);

const SettingsView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const currentUser = useCurrentUser(userId);
  const twin = useTwinConsent();

  // profile
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [shrinkMedia, setShrinkMediaState] = useState(() => shrinkMediaEnabled());
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // settings
  const [fontSize, setFontSize] = useState("medium");
  const [wallpaper, setWallpaper] = useState("none");
  const [dynamicWallpaper, setDynamicWallpaper] = useState(false);
  const [messageEffects, setMessageEffects] = useState(true);
  const [calm, setCalm] = useState(() => isCalmMode());
  const [decoyEnabled, setDecoyEnabled] = useState(false);
  const [decoySkin, setDecoySkin] = useState<DecoySkin>("chatgpt");
  const [decoyHasCode, setDecoyHasCode] = useState(false);
  const [decoyCode, setDecoyCode] = useState("");
  const [chatTheme, setChatTheme] = useState("default");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [twinBusy, setTwinBusy] = useState(false);
  const [showDecoyLogin, setShowDecoyLogin] = useState(false);
  const [twinConfirmRevoke, setTwinConfirmRevoke] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name ?? "");
      setBio(currentUser.bio ?? "");
    }
  }, [currentUser]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setFontSize(data.font_size);
        setWallpaper(data.wallpaper_url ?? "none");
        setDynamicWallpaper((data as any).dynamic_wallpaper ?? false);
        setMessageEffects((data as any).message_effects ?? true);
        setChatTheme((data as any).chat_theme ?? "default");
        setDecoySkin(((data as any).decoy_skin as DecoySkin) ?? "chatgpt");
        setDecoyEnabled((data as any).decoy_enabled ?? false);
        setDecoyHasCode(!!(data as any).decoy_unlock_hash);
        if (data.theme !== "system") setTheme(data.theme);
      }
    };
    load();
  }, [userId]);

  const saveSettings = async (updates: Record<string, any>) => {
    setSaving(true);
    const { data: existing } = await supabase
      .from("chat_user_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from("chat_user_settings").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
    } else {
      await supabase.from("chat_user_settings").insert({ user_id: userId, ...updates } as any);
    }
    setSaving(false);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    await supabase.from("user_status").update({ name, bio }).eq("user_id", userId);
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const up = await uploadImage(file, { prefix: "avatars", maxDimension: 512 });
      await supabase.from("user_status").update({ profileurl: up.url }).eq("user_id", userId);
    } catch (err) {
      console.error("avatar upload failed", err);
    }
    setAvatarUploading(false);
    if (e.target) e.target.value = "";
  };

  const handleThemeChange = (newTheme: string) => { setTheme(newTheme); saveSettings({ theme: newTheme }); };
  const handleFontChange = (newSize: string) => { setFontSize(newSize); saveSettings({ font_size: newSize }); };
  const handleWallpaperChange = (value: string) => {
    setWallpaper(value); setDynamicWallpaper(false);
    saveSettings({ wallpaper_url: value === "none" ? null : value, dynamic_wallpaper: false });
  };
  const handleEffectsToggle = () => { const next = !messageEffects; setMessageEffects(next); saveSettings({ message_effects: next }); };
  const handleDecoyToggle = () => { const next = !decoyEnabled; setDecoyEnabled(next); saveSettings({ decoy_enabled: next }); };
  const handleDecoySkin = (skin: DecoySkin) => { setDecoySkin(skin); saveSettings({ decoy_skin: skin }); };
  const handleSaveDecoyCode = async () => {
    const code = decoyCode.trim();
    if (!code) return;
    const hash = await hashCode(code);
    await saveSettings({ decoy_unlock_hash: hash });
    setDecoyCode(""); setDecoyHasCode(true);
  };
  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // A wallpaper never needs more than screen size — it is drawn once, behind
      // everything, so 1600 px of a phone photo is generous.
      const up = await uploadImage(file, { prefix: `wallpapers/${userId}`, maxDimension: 1600 });
      setWallpaper(up.url); setDynamicWallpaper(false);
      saveSettings({ wallpaper_url: up.url, dynamic_wallpaper: false });
    } catch (err) {
      console.error("wallpaper upload failed", err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  const fontSizes = [
    { value: "small", label: "Small", sample: "text-[13px]" },
    { value: "medium", label: "Medium", sample: "text-[15px]" },
    { value: "large", label: "Large", sample: "text-[17px]" },
  ];
  const features = [
    { path: "/scheduled-messages", icon: Clock, label: "Scheduled Messages" },
    { path: "/custom-stickers", icon: Sticker, label: "My Stickers" },
    { path: "/custom-touch-reactions", icon: Heart, label: "Custom Touch Reactions" },
    { path: "/achievements", icon: Trophy, label: "Achievements" },
    { path: "/letter-collection", icon: Mail, label: "Letter Collection" },
  ];

  const isCustom = wallpaper.startsWith("http");

  const twinToggle = async () => {
    if (twinBusy) return;
    setTwinBusy(true);
    try {
      if (twin.enabled) {
        if (twin.canGrant) setTwinConfirmRevoke(true);
        else await twin.setEnabled(false); // owner can only switch off
      } else if (twin.canGrant) {
        await twin.grant(); // her explicit consent, recorded server-side
      }
    } catch {
      /* error state is surfaced by the hook */
    } finally {
      setTwinBusy(false);
    }
  };

  const confirmRevoke = async () => {
    setTwinBusy(true);
    try {
      await twin.revoke();
      setTwinConfirmRevoke(false);
    } catch {
      /* surfaced below */
    } finally {
      setTwinBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Nunito', sans-serif" }}>
      {/* Material top bar */}
      <header
        className="flex items-center gap-2 px-3 py-3 shrink-0 sticky top-0 z-10"
        style={{ background: "hsl(var(--background) / 0.72)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: "0.5px solid hsl(var(--border) / 0.6)" }}
      >
        <button onClick={() => navigate("/home")} className="p-2 -ml-1 rounded-full hover:bg-muted/60 transition-transform active:scale-90">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-[17px] font-semibold text-foreground">Settings</h2>
        {(saving || uploading) && <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7 pb-8">
        {/* ── Profile hero ── */}
        <div className="flex flex-col items-center pt-2">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-1 ring-border/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <AvatarImage src={currentUser?.profileurl ?? ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                {currentUser?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-90">
              {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Camera className="h-4 w-4 text-primary-foreground" />}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <p className="text-[20px] font-semibold text-foreground mt-3">{currentUser?.name ?? "You"}</p>
          {currentUser?.bio && <p className="text-[13px] text-muted-foreground text-center mt-0.5 max-w-[260px]">{currentUser.bio}</p>}
        </div>

        {/* ── Profile editor ── */}
        <section>
          <SectionLabel>Profile</SectionLabel>
          <Group>
            <div className="px-4 py-3">
              <label className="text-[12px] text-muted-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50"
                placeholder="Your name"
              />
            </div>
            <div className="px-4 py-3">
              <label className="text-[12px] text-muted-foreground">About</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full mt-1 bg-transparent text-[15px] text-foreground outline-none resize-none placeholder:text-muted-foreground/50"
                placeholder="Write something about yourself…"
              />
            </div>
          </Group>
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="w-full mt-2.5 h-11 rounded-[14px] bg-primary text-primary-foreground text-[16px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {profileSaving ? "Saving…" : profileSaved ? "✓ Saved" : "Save Profile"}
          </button>
        </section>

        {/* ── Appearance ── */}
        <section>
          <SectionLabel>Appearance</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => handleThemeChange(t.value)}
                className={`flex flex-col items-center gap-2 py-4 rounded-[16px] transition-all active:scale-[0.97] ${
                  theme === t.value ? "bg-primary/10 ring-2 ring-primary" : "bg-card ring-1 ring-border/40 hover:bg-muted/40"
                }`}
              >
                <t.icon className={`h-6 w-6 ${theme === t.value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[13px] font-medium ${theme === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Text size (segmented control) ── */}
        <section>
          <SectionLabel>Text Size</SectionLabel>
          <div className="flex p-1 rounded-[14px] bg-muted/60 ring-1 ring-border/30">
            {fontSizes.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFontChange(f.value)}
                className={`flex-1 py-2 rounded-[10px] font-medium transition-all active:scale-[0.97] ${f.sample} ${
                  fontSize === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Motion & effects ── */}
        <section>
          <SectionLabel>Motion &amp; Effects</SectionLabel>
          <Group>
            <Row label="Keyword animations" sub="❤️ 🎉 ❄️ react to your words" onClick={handleEffectsToggle} trailing={<Toggle on={messageEffects} onChange={handleEffectsToggle} />} />
            <Row label="Calm Mode" sub="Pauses petals, sparkles & ambient motion" onClick={() => { const n = !calm; setCalm(n); setCalmMode(n); }} trailing={<Toggle on={calm} onChange={() => { const n = !calm; setCalm(n); setCalmMode(n); }} />} />
          </Group>
        </section>

        {/* ── AI Twin (consent gate) ── */}
        {twin.configured && !twin.loading && (
          <section>
            <SectionLabel>AI Twin</SectionLabel>
            <Group>
              <Row
                icon={<Bot className="h-4 w-4" />}
                label="NewsOfYou Twin"
                sub={
                  twin.enabled
                    ? twin.canGrant
                      ? "On — you can switch it off any time"
                      : "On — she agreed; you can only switch it off"
                    : twin.canGrant
                      ? "Off — tap to agree and switch it on"
                      : "Off — waiting for her to agree"
                }
                onClick={twinToggle}
                trailing={twinBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Toggle on={twin.enabled} onChange={twinToggle} />}
              />
              {twin.enabled && (
                <Row
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="It is always AI"
                  sub="Every message is labelled. It never pretends to be human, and it never sees anything before you agree."
                />
              )}
              {twin.isOwner && (
                <Row
                  label="Twin control room"
                  sub="Greetings, voice profile, switches"
                  onClick={() => navigate("/you/twin")}
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                />
              )}
            </Group>
            {twin.error && <p className="px-1 pt-1.5 text-[12px] text-destructive">{twin.error}</p>}
          </section>
        )}

        {/* ── Privacy / Quick Hide ── */}
        <section>
          <SectionLabel>Privacy</SectionLabel>
          <Group>
            <Row label="Quick Hide" sub="Disguise chat as an AI app; type your code to return" onClick={handleDecoyToggle} trailing={<Toggle on={decoyEnabled} onChange={handleDecoyToggle} />} />
            <Row
              label="Front page decoy login"
              sub="myanshika.xyz opens a school portal — this is the fake credential and the code back"
              trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
              onClick={() => setShowDecoyLogin((v) => !v)}
            />
            {showDecoyLogin && (
              <div className="p-3">
                <DecoyLoginSettings />
              </div>
            )}
          </Group>
          {decoyEnabled && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 rounded-[18px] bg-card ring-1 ring-border/40 p-4 space-y-4">
              <div>
                <span className="text-[12px] font-medium text-muted-foreground">Disguise as</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(DECOY_SKINS) as DecoySkin[]).map((id) => (
                    <button
                      key={id}
                      onClick={() => handleDecoySkin(id)}
                      className={`rounded-[12px] py-2.5 text-[13px] font-medium transition-all active:scale-[0.97] ${
                        decoySkin === id ? "bg-primary/10 ring-2 ring-primary text-primary" : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {DECOY_SKINS[id].name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[12px] font-medium text-muted-foreground">
                  Unlock code {decoyHasCode && <span className="text-[#34c759]">· set ✓</span>}
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={decoyCode}
                    onChange={(e) => setDecoyCode(e.target.value)}
                    placeholder={decoyHasCode ? "Enter new code…" : "e.g. open sesame"}
                    className="flex-1 rounded-[12px] bg-muted/50 px-3.5 py-2.5 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleSaveDecoyCode}
                    disabled={!decoyCode.trim()}
                    className="rounded-[12px] bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-40 transition-transform active:scale-95"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground leading-snug">
                  Type this code into the disguised app's message box to return. This hides the chat from a glance — it does not encrypt your data.
                </p>
              </div>
            </motion.div>
          )}
        </section>

        {/* ── Wallpaper ── */}
        <section>
          <SectionLabel>Chat Wallpaper</SectionLabel>
          <Group className="mb-2.5">
            <Row
              icon={<span className="text-lg">🌅</span>}
              label="Live Sky"
              sub="Real-time sun/moon cycle with stars"
              onClick={() => {
                const useSky = wallpaper !== "sky";
                setWallpaper(useSky ? "sky" : "none"); setDynamicWallpaper(useSky);
                saveSettings({ wallpaper_url: useSky ? "sky" : null, dynamic_wallpaper: useSky });
              }}
              trailing={<Toggle on={wallpaper === "sky"} onChange={() => {
                const useSky = wallpaper !== "sky";
                setWallpaper(useSky ? "sky" : "none"); setDynamicWallpaper(useSky);
                saveSettings({ wallpaper_url: useSky ? "sky" : null, dynamic_wallpaper: useSky });
              }} />}
            />
            <Row
              icon={<span className="text-lg">🎨</span>}
              label="Gradient Mode"
              sub="Auto-changes by time of day"
              onClick={() => {
                const next = wallpaper === "sky" ? false : !dynamicWallpaper;
                setDynamicWallpaper(next); if (next) setWallpaper("none");
                saveSettings({ dynamic_wallpaper: next, wallpaper_url: next ? null : (wallpaper === "sky" ? null : wallpaper === "none" ? null : wallpaper) });
              }}
              trailing={<Toggle on={dynamicWallpaper && wallpaper !== "sky"} onChange={() => {
                const next = wallpaper === "sky" ? false : !dynamicWallpaper;
                setDynamicWallpaper(next); if (next) setWallpaper("none");
                saveSettings({ dynamic_wallpaper: next, wallpaper_url: next ? null : (wallpaper === "sky" ? null : wallpaper === "none" ? null : wallpaper) });
              }} />}
            />
          </Group>

          {dynamicWallpaper && wallpaper !== "sky" && (
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {Object.entries(DYNAMIC_WALLPAPERS).map(([key, wp]) => (
                <div key={key} className={`aspect-video rounded-[14px] overflow-hidden relative ${key === getTimeOfDay() ? "ring-2 ring-primary" : "ring-1 ring-border/30"}`} style={{ background: wp.gradient }}>
                  <span className="absolute bottom-1.5 left-2.5 text-[11px] font-semibold text-white drop-shadow">{wp.label}</span>
                  {key === getTimeOfDay() && <Check className="absolute top-1.5 right-1.5 h-4 w-4 text-white drop-shadow" />}
                </div>
              ))}
            </div>
          )}

          {!dynamicWallpaper && (
            <div className="grid grid-cols-3 gap-2.5">
              {WALLPAPER_PRESETS.map((wp) => (
                <button
                  key={wp.value}
                  onClick={() => handleWallpaperChange(wp.value)}
                  className={`relative aspect-[3/4] rounded-[14px] overflow-hidden transition-all active:scale-[0.97] ${wallpaper === wp.value ? "ring-2 ring-primary" : "ring-1 ring-border/40"}`}
                  style={wp.value === "none" ? {} : wp.style}
                >
                  {wp.value === "none" && <div className="absolute inset-0 bg-card flex items-center justify-center"><X className="h-4 w-4 text-muted-foreground" /></div>}
                  {wallpaper === wp.value && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Check className="h-5 w-5 text-white drop-shadow" /></div>}
                  <span className="absolute bottom-1 inset-x-0 text-[9px] font-medium text-center drop-shadow-sm" style={{ color: wp.value === "#1a1a2e" ? "#fff" : "#333" }}>{wp.label}</span>
                </button>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className={`relative aspect-[3/4] rounded-[14px] overflow-hidden transition-all active:scale-[0.97] ${isCustom ? "ring-2 ring-primary" : "ring-1 ring-dashed ring-border"}`}
              >
                {isCustom ? (
                  <>
                    <img src={wallpaper} alt="Custom" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Check className="h-5 w-5 text-white drop-shadow" /></div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-medium">Custom</span>
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCustomUpload} />
            </div>
          )}
        </section>

        {/* ── Features ── */}
        <section>
          <SectionLabel>Storage</SectionLabel>
          <Group>
            <Row
              icon={<ImageDown className="h-[18px] w-[18px]" />}
              label="Shrink photos before sending"
              trailing={
                <button
                  type="button"
                  role="switch"
                  aria-checked={shrinkMedia}
                  onClick={() => {
                    const next = !shrinkMedia;
                    setShrinkMedia(next);
                    setShrinkMediaState(next);
                  }}
                  className={`relative h-[30px] w-[50px] rounded-full transition-colors ${
                    shrinkMedia ? "bg-[#34c759]" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      shrinkMedia ? "translate-x-[23px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              }
            />
          </Group>
          <p className="mt-1 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Photos are re-encoded on your phone (modern codec, long edge capped at 2400px) before upload — usually 70–90% less
            storage for the same look. Videos and GIFs are never re-encoded. Anything above 4 MB is always shrunk.
          </p>
        </section>

        <section>
          <SectionLabel>Features</SectionLabel>
          <Group>
            {features.map((f) => (
              <Row key={f.path} icon={<f.icon className="h-[18px] w-[18px]" />} label={f.label} onClick={() => navigate(f.path)} />
            ))}
          </Group>
        </section>

        {/* ── Account ── */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <Group>
            <Row
              icon={<LogOut className="h-[18px] w-[18px] text-[#ff3b30]" />}
              label="Sign Out"
              onClick={() => signOut()}
              trailing={<span />}
            />
          </Group>
        </section>

        <p className="text-center text-[12px] text-muted-foreground/70 pt-1">EduflowAi v2.0 · A private chat for two 💕</p>
      </div>

      <BottomNav />

      {twinConfirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm rounded-[20px] bg-card p-5 ring-1 ring-border/40"
          >
            <h3 className="text-[16px] font-semibold text-foreground">Switch the twin off?</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              It stops immediately. Everything it remembered about you is deleted, and it can only come back if you agree
              again.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setTwinConfirmRevoke(false)}
                className="flex-1 rounded-[14px] bg-muted/60 py-2.5 text-[14px] font-medium text-foreground active:scale-[0.98]"
              >
                Keep it on
              </button>
              <button
                onClick={confirmRevoke}
                disabled={twinBusy}
                className="flex-1 rounded-[14px] bg-destructive py-2.5 text-[14px] font-medium text-destructive-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {twinBusy ? "Switching off…" : "Switch off & erase"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
