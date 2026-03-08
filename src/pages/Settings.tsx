import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sun, Moon, Monitor, Loader2, Check, Upload, X, Clock, ChevronRight, Sticker, Heart, Trophy, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import BottomNav from "@/components/layout/BottomNav";


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

const SettingsView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState("medium");
  const [wallpaper, setWallpaper] = useState("none");
  const [dynamicWallpaper, setDynamicWallpaper] = useState(false);
  const [messageEffects, setMessageEffects] = useState(true);
  const [chatTheme, setChatTheme] = useState("default");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    saveSettings({ theme: newTheme });
  };

  const handleFontChange = (newSize: string) => {
    setFontSize(newSize);
    saveSettings({ font_size: newSize });
  };

  const handleWallpaperChange = (value: string) => {
    setWallpaper(value);
    setDynamicWallpaper(false);
    saveSettings({ wallpaper_url: value === "none" ? null : value, dynamic_wallpaper: false });
  };

  const handleDynamicToggle = () => {
    const next = !dynamicWallpaper;
    setDynamicWallpaper(next);
    saveSettings({ dynamic_wallpaper: next });
  };

  const handleEffectsToggle = () => {
    const next = !messageEffects;
    setMessageEffects(next);
    saveSettings({ message_effects: next });
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `wallpapers/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
      const url = urlData.publicUrl;
      setWallpaper(url);
      setDynamicWallpaper(false);
      saveSettings({ wallpaper_url: url, dynamic_wallpaper: false });
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
    { value: "small", label: "Small", sample: "text-xs" },
    { value: "medium", label: "Medium", sample: "text-sm" },
    { value: "large", label: "Large", sample: "text-base" },
  ];

  const isCustom = wallpaper.startsWith("http");

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">Settings</h2>
        {(saving || uploading) && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary ml-auto" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Theme */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Theme</h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => handleThemeChange(t.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                  theme === t.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <t.icon className={`h-6 w-6 ${theme === t.value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${theme === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Font Size</h3>
          <div className="space-y-2">
            {fontSizes.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFontChange(f.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  fontSize === f.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span className={`font-medium ${f.sample} ${fontSize === f.value ? "text-primary" : "text-foreground"}`}>
                  {f.label}
                </span>
                <span className={`${f.sample} text-muted-foreground`}>Aa</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Effects */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Message Effects</h3>
          <button
            onClick={handleEffectsToggle}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
              messageEffects ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span className="text-sm text-foreground">Keyword animations (❤️ 🎉 ❄️)</span>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${messageEffects ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${messageEffects ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>

        {/* Dynamic Wallpaper */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dynamic Wallpaper</h3>
          
          {/* Live Sky option */}
          <button
            onClick={() => {
              const useSky = wallpaper !== "sky";
              setWallpaper(useSky ? "sky" : "none");
              setDynamicWallpaper(useSky);
              saveSettings({ wallpaper_url: useSky ? "sky" : null, dynamic_wallpaper: useSky });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all mb-2 ${
              wallpaper === "sky" ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🌅</span>
              <div className="text-left">
                <span className="text-sm font-medium text-foreground block">Live Sky</span>
                <span className="text-[10px] text-muted-foreground">Real-time sun/moon cycle with stars & clouds</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${wallpaper === "sky" ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${wallpaper === "sky" ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>

          {/* Gradient time-of-day option */}
          <button
            onClick={() => {
              const next = wallpaper === "sky" ? false : !dynamicWallpaper;
              setDynamicWallpaper(next);
              if (next) setWallpaper("none");
              saveSettings({ dynamic_wallpaper: next, wallpaper_url: next ? null : (wallpaper === "sky" ? null : wallpaper === "none" ? null : wallpaper) });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all mb-3 ${
              dynamicWallpaper && wallpaper !== "sky" ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🎨</span>
              <div className="text-left">
                <span className="text-sm font-medium text-foreground block">Gradient Mode</span>
                <span className="text-[10px] text-muted-foreground">Auto-change colors by time of day</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${dynamicWallpaper && wallpaper !== "sky" ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${dynamicWallpaper && wallpaper !== "sky" ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>
          
          {dynamicWallpaper && wallpaper !== "sky" && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DYNAMIC_WALLPAPERS).map(([key, wp]) => (
                <div
                  key={key}
                  className={`aspect-video rounded-xl overflow-hidden relative ${key === getTimeOfDay() ? "ring-2 ring-primary" : ""}`}
                  style={{ background: wp.gradient }}
                >
                  <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-white drop-shadow">{wp.label}</span>
                  {key === getTimeOfDay() && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallpaper */}
        {!dynamicWallpaper && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chat Wallpaper</h3>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPER_PRESETS.map((wp) => (
                <button
                  key={wp.value}
                  onClick={() => handleWallpaperChange(wp.value)}
                  className={`relative aspect-[3/4] rounded-xl border-2 transition-all overflow-hidden ${
                    wallpaper === wp.value ? "border-primary shadow-md" : "border-border hover:border-primary/30"
                  }`}
                  style={wp.value === "none" ? {} : wp.style}
                >
                  {wp.value === "none" && (
                    <div className="absolute inset-0 bg-card flex items-center justify-center">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {wallpaper === wp.value && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="h-5 w-5 text-white drop-shadow" />
                    </div>
                  )}
                  <span className="absolute bottom-1 left-0 right-0 text-[9px] font-medium text-center drop-shadow-sm" style={{ color: wp.value === "#1a1a2e" ? "#fff" : "#333" }}>
                    {wp.label}
                  </span>
                </button>
              ))}

              {/* Custom upload */}
              <button
                onClick={() => fileRef.current?.click()}
                className={`relative aspect-[3/4] rounded-xl border-2 transition-all overflow-hidden ${
                  isCustom ? "border-primary shadow-md" : "border-dashed border-border hover:border-primary/30"
                }`}
              >
                {isCustom ? (
                  <>
                    <img src={wallpaper} alt="Custom" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="h-5 w-5 text-white drop-shadow" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-medium">Custom</span>
                  </div>
                )}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCustomUpload} />
          </div>
        )}

        {/* Scheduled Messages & Custom Features */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Features</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/scheduled-messages")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Scheduled Messages</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/custom-stickers")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Sticker className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">My Stickers</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/custom-touch-reactions")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Custom Touch Reactions</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/achievements")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Achievements</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/letter-collection")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Letter Collection</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Parallel Universe Mode */}
        <ThemePicker
          value={chatTheme}
          onChange={(id) => {
            setChatTheme(id);
            saveSettings({ chat_theme: id });
          }}
        />

        {/* Info */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
          <p className="text-xs text-muted-foreground">ChatRoom v2.0</p>
          <p className="text-xs text-muted-foreground mt-1">A private chat for two 💕</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsPage;
