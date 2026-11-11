"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { DEFAULT_BANNER, type Banner } from "./banners";
import { parseBanner } from "./db";
import { useSupabase } from "./supabase";
import { useMe } from "./useMe";

export type Profile = {
  name: string;
  /** Home city (metro area), not an airport. */
  home: string;
  /** Where the home city is, so we can find nearby airports for the news filter. */
  homePlace: { lat: number; lon: number } | null;
  bio: string;
  /** Square JPEG as a data URL, or null to show initials on a colour. */
  photo: string | null;
  color: string;
  /** Banner behind the profile header: an illustrated preset or the user's own photo. */
  banner: Banner;
};

export const AVATAR_COLORS = ["#3d96ff", "#e0572f", "#7a3fd1", "#0f9d6b", "#d14a8f", "#c27a00", "#127a8f", "#4a5568"];

const DEFAULT: Profile = { name: "", home: "", homePlace: null, bio: "", photo: null, color: AVATAR_COLORS[0], banner: DEFAULT_BANNER };

type Row = {
  display_name: string; bio: string; home_city: string; home_lat: number | null; home_lon: number | null;
  photo_url: string | null; avatar_color: string; banner: unknown;
};

/** Database row -> the shape the screens use (shared with friends' profiles). */
export const toProfile = (r: Row): Profile => ({
  name: r.display_name,
  home: r.home_city,
  homePlace: r.home_lat != null && r.home_lon != null ? { lat: r.home_lat, lon: r.home_lon } : null,
  bio: r.bio,
  photo: r.photo_url,
  color: r.avatar_color,
  banner: parseBanner(r.banner),
});

const toRow = (p: Profile) => ({
  display_name: p.name,
  bio: p.bio,
  home_city: p.home,
  home_lat: p.homePlace?.lat ?? null,
  home_lon: p.homePlace?.lon ?? null,
  photo_url: p.photo,
  avatar_color: p.color,
  banner: p.banner,
});

type Ctx = {
  profile: Profile;
  loading: boolean;
  error: string | null;
  /** Save changes. Returns an error message, or null when saved. */
  update: (p: Profile) => Promise<string | null>;
  openEditor: () => void;
};

const ProfileContext = createContext<Ctx | null>(null);

/** Your own profile, stored in Supabase `profiles` (the row is created on first sign-in). */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!me.id || !me.username || me.username === "you") return;
    let alive = true;
    setLoading(true);
    (async () => {
      let { data, error: e } = await supabase.from("profiles").select("*").eq("user_id", me.id).maybeSingle();
      if (!e && !data) {
        // first sign-in: create the row (the database takes the username from the sign-in token)
        const ins = await supabase.from("profiles").insert({ user_id: me.id, username: me.username, display_name: me.name }).select("*").single();
        data = ins.data;
        e = ins.error;
      } else if (!e && data && data.username !== me.username) {
        await supabase.from("profiles").update({ username: me.username }).eq("user_id", me.id);
      }
      if (!alive) return;
      if (e || !data) setError(e?.message ?? "Couldn't load your profile");
      else { setProfile(toProfile(data)); setError(null); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [me.id, me.username, me.name, supabase]);

  const update = useCallback(
    async (p: Profile) => {
      if (!me.id) return "Not signed in";
      const { error: e } = await supabase.from("profiles").update(toRow(p)).eq("user_id", me.id);
      if (e) return e.message;
      setProfile(p);
      return null;
    },
    [me.id, supabase]
  );
  const openEditor = useCallback(() => setEditing(true), []);

  const shown = useMemo(() => ({ ...profile, name: profile.name || me.name }), [profile, me.name]);
  const value = useMemo(() => ({ profile: shown, loading, error, update, openEditor }), [shown, loading, error, update, openEditor]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
      {editing && (
        <ProfileForm
          profile={shown}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            const err = await update(p);
            if (!err) setEditing(false);
            return err;
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
