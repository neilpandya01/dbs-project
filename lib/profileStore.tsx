"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { DEFAULT_BANNER, type Banner } from "./banners";
import { USER } from "./mock";

const KEY = "wingmates.profile.v1";

export type Profile = {
  name: string;
  /** Home city (metro area), not an airport. */
  home: string;
  /** Where the home city is, so we can find nearby airports for the news filter. Null for older saved profiles. */
  homePlace: { lat: number; lon: number } | null;
  bio: string;
  /** Square JPEG as a data URL, or null to show initials on a colour. */
  photo: string | null;
  color: string;
  /** Banner behind the profile header: an illustrated preset or the user's own photo. */
  banner: Banner;
};

export const AVATAR_COLORS = ["#3d96ff", "#e0572f", "#7a3fd1", "#0f9d6b", "#d14a8f", "#c27a00", "#127a8f", "#4a5568"];

const DEFAULT: Profile = { name: USER.name, home: "Chicago, IL", homePlace: { lat: 41.8781, lon: -87.6298 }, bio: "", photo: null, color: AVATAR_COLORS[0], banner: DEFAULT_BANNER };

type Ctx = {
  profile: Profile;
  update: (p: Profile) => void;
  openEditor: () => void;
};

const ProfileContext = createContext<Ctx | null>(null);

/**
 * Front-end stand-in for the profiles table: saved to this browser's localStorage.
 * Swap `update` for a Supabase call (and the photo for Storage) later.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Profile>) });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {}
  }, [profile, ready]);

  const update = useCallback((p: Profile) => setProfile(p), []);
  const openEditor = useCallback(() => setEditing(true), []);
  const value = useMemo(() => ({ profile, update, openEditor }), [profile, update, openEditor]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
      {editing && (
        <ProfileForm
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            update(p);
            setEditing(false);
          }}
        />
      )}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const c = useContext(ProfileContext);
  if (!c) throw new Error("useProfile must be used inside <ProfileProvider>");
  return c;
}
