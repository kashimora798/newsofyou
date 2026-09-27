import React, { useState, useEffect } from "react";
import { X, Image as ImageIcon, FileText, Film, Download, Play } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatLastSeen } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import ImageLightbox from "./ImageLightbox";
import type { Tables } from "@/integrations/supabase/types";

interface ProfilePanelProps {
  partner: Tables<"user_status"> | null;
  onClose: () => void;
}

type MediaTab = "images" | "videos" | "files";

const TABS: { key: MediaTab; label: string; icon: React.ReactNode }[] = [
  { key: "images", label: "Photos", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { key: "videos", label: "Videos", icon: <Film className="h-3.5 w-3.5" /> },
  { key: "files", label: "Files", icon: <FileText className="h-3.5 w-3.5" /> },
];

const ProfilePanel: React.FC<ProfilePanelProps> = ({ partner, onClose }) => {
  const [activeTab, setActiveTab] = useState<MediaTab>("images");
  const [media, setMedia] = useState<Tables<"messages">[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      let query = supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(200);

      if (activeTab === "images") {
        query = query.not("image_url", "is", null).neq("image_url", "");
      } else if (activeTab === "videos") {
        query = query.eq("video", true).not("vidUrl", "is", null).neq("vidUrl", "");
      } else {
        query = query.not("file_url", "is", null).neq("file_url", "");
      }

      const { data } = await query;
      setMedia(data ?? []);
      setLoading(false);
    };
    fetchMedia();
  }, [activeTab]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif" }}
    >
      {/* Dimmed + blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-apple-backdrop"
        onClick={onClose}
      />

      {/* Sheet (mobile) / card (desktop) */}
      <div className="relative w-full sm:max-w-md max-h-[88vh] flex flex-col bg-card rounded-t-[28px] sm:rounded-[24px] overflow-hidden ring-1 ring-border/50 shadow-[0_12px_40px_rgba(0,0,0,0.18)] animate-apple-sheet sm:animate-apple-modal">
        {/* Grabber (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-9 rounded-full bg-foreground/15" />
        </div>

        {/* Close (desktop) */}
        <button
          onClick={onClose}
          className="hidden sm:flex absolute top-4 right-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-muted/70 hover:bg-muted text-muted-foreground tappable"
        >
          <X className="h-[18px] w-[18px]" />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Hero */}
          <div className="flex flex-col items-center pt-5 pb-6 px-6">
            <div className="relative">
              <Avatar className="h-28 w-28 ring-1 ring-border/50 shadow-sm">
                <AvatarImage src={partner?.profileurl ?? ""} alt={partner?.name ?? ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-semibold">
                  {partner?.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              {partner?.is_online && partner?.activity_state !== "offline" && (
                <span className={`absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full border-[3px] border-card ${
                  partner?.activity_state === "away" || partner?.activity_state === "idle"
                    ? "bg-amber-400"
                    : "bg-online"
                }`} />
              )}
            </div>
            <h2 className="text-[22px] font-bold text-foreground mt-3 tracking-tight">{partner?.name ?? "..."}</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {partner?.is_online && partner?.activity_state !== "offline"
                ? partner?.activity_state === "away" || partner?.activity_state === "idle"
                  ? "Away"
                  : "Online now"
                : `Last seen ${formatLastSeen(partner?.last_seen ?? null)}`}
            </p>
            {partner?.bio && (
              <p className="text-[14px] text-muted-foreground/90 mt-3 text-center leading-relaxed max-w-xs">{partner.bio}</p>
            )}
          </div>

          {/* Shared media */}
          <div className="px-4 pb-4 pt-1">
            <p className="px-2 pb-2 text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Shared Media</p>

            {/* Segmented control */}
            <div className="flex p-1 rounded-[14px] bg-muted/60 mb-3">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[11px] text-[13px] font-medium transition-all ease-spring duration-200 ${
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="min-h-[140px]">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : media.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-10">No {activeTab} shared yet</p>
              ) : activeTab === "files" ? (
                <div className="space-y-1.5">
                  {media.map((m) => (
                    <a
                      key={m.id}
                      href={m.file_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/60 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate text-foreground">{m.file_name ?? "File"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(m.created_at ?? "").toLocaleDateString()}
                        </p>
                      </div>
                      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((m) => (
                    <button
                      key={m.id}
                      className="aspect-square rounded-xl overflow-hidden bg-muted tappable"
                      onClick={() => {
                        if (activeTab === "images" && m.image_url) {
                          setLightboxSrc(m.image_url);
                          setLightboxType("image");
                        } else if (activeTab === "videos" && m.vidUrl) {
                          setLightboxSrc(m.vidUrl);
                          setLightboxType("video");
                        }
                      }}
                    >
                      {activeTab === "images" ? (
                        <img
                          src={m.image_url!}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="relative w-full h-full group/vid flex items-center justify-center">
                          <video 
                            src={m.vidUrl!} 
                            className="w-full h-full object-cover block" 
                            preload="metadata" 
                            playsInline 
                            muted 
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover/vid:bg-black/45">
                            <div className="h-9 w-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-black hover:scale-105 transition-transform">
                              <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          type={lightboxType}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
};

export default ProfilePanel;
