"use client";

import { useClerk } from "@clerk/nextjs";
import { ProfileLayout } from "./ProfileLayout";
import { useNow } from "./useNow";
import { useFlights } from "@/lib/flightsStore";
import { useFriends } from "@/lib/friendsStore";
import { useProfile } from "@/lib/profileStore";
import { useMe } from "@/lib/useMe";

/** Your own profile: the shared layout, plus the controls only you get. */
export function ProfileView() {
  const { flights, loading: flightsLoading, error: flightsError, openEditor } = useFlights();
  const { profile, loading: profileLoading, error: profileError, openEditor: editProfile } = useProfile();
  const { friends } = useFriends();
  const me = useMe();
  const { signOut, openUserProfile } = useClerk();
  const nowOrNull = useNow();
  // greeting only after mount so server and client markup match
  const h = nowOrNull?.getHours() ?? 0;
  const greeting = !nowOrNull ? "Welcome back" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  if (profileError || flightsError) {
    return (
      <div className="card empty" style={{ marginTop: 14 }} role="alert">
        <b>Couldn’t load your data</b>
        <p className="muted">{profileError ?? flightsError}</p>
        <button className="btn primary" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (profileLoading || flightsLoading) return <div className="loading-block" role="status">Loading your profile…</div>;

  return (
    <ProfileLayout
      who={{ ...profile, joined: me.joined }}
      subtitle={greeting}
      friendCount={friends.length}
      friendAvatars={friends}
      flights={flights}
      now={nowOrNull ?? new Date()}
      own={{ onAddFlight: () => openEditor(), onEditProfile: () => editProfile(), onManageAccount: () => openUserProfile(), onSignOut: () => signOut({ redirectUrl: "/sign-in" }) }}
    />
  );
}
