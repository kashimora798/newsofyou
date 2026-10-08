import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/uploadImage";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";

const Profile: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <ProfileView userId={user.id} />;
};

const ProfileView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser(userId);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name ?? "");
      setBio(currentUser.bio ?? "");
    }
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from("user_status")
      .update({ name, bio })
      .eq("user_id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Shrunk before it leaves the phone — an avatar is 96 px on screen.
      const up = await uploadImage(file, { prefix: `avatars`, maxDimension: 512 });
      await supabase.from("user_status").update({ profileurl: up.url }).eq("user_id", userId);
    } catch (err) {
      console.error("avatar upload failed", err);
    }
    setUploading(false);
    if (e.target) e.target.value = "";
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">Profile</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-28 w-28">
              <AvatarImage src={currentUser?.profileurl ?? ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                {currentUser?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md hover:opacity-90 transition-opacity">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
              ) : (
                <Camera className="h-4 w-4 text-primary-foreground" />
              )}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{currentUser?.name ?? "..."}</p>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">About</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Write something about yourself..."
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
