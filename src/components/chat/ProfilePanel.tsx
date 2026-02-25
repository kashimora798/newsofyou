import React, { useState, useEffect } from "react";
import { X, Image, FileText, Film, ChevronRight } from "lucide-react";
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

  const tabs: { key: MediaTab; label: string; icon: React.ReactNode }[] = [
    { key: "images", label: "Photos", icon: <Image className="h-4 w-4" /> },
    { key: "videos", label: "Videos", icon: <Film className="h-4 w-4" /> },
    { key: "files", label: "Files", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <>
      <div className="flex flex-col h-full bg-card border-l border-border w-80 shrink-0 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Contact Info</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Profile */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-border">
          <Avatar className="h-24 w-24 mb-3">
            <AvatarImage src={partner?.profileurl ?? ""} alt={partner?.name ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {partner?.name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold text-foreground">{partner?.name ?? "..."}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {partner?.is_online ? "online" : `last seen ${formatLastSeen(partner?.last_seen ?? null)}`}
          </p>
          {partner?.bio && (
            <p className="text-xs text-muted-foreground mt-2 text-center">{partner.bio}</p>
          )}
        </div>

        {/* Media Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : media.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No {activeTab} shared yet</p>
          ) : activeTab === "files" ? (
            <div className="space-y-1">
              {media.map((m) => (
                <a
                  key={m.id}
                  href={m.file_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <FileText className="h-8 w-8 text-primary/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.file_name ?? "File"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at ?? "").toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {media.map((m) => (
                <div
                  key={m.id}
                  className="aspect-square rounded-md overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
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
                    <video src={m.vidUrl!} className="w-full h-full object-cover" preload="metadata" />
                  )}
                </div>
              ))}
            </div>
          )}
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
    </>
  );
};

export default ProfilePanel;
