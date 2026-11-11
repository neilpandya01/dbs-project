"use client";

import { ProfileLayout } from "./ProfileLayout";
import { useNow } from "./useNow";
import { useFlights } from "@/lib/flightsStore";
import { useFriends } from "@/lib/friendsStore";
import { useProfile } from "@/lib/profileStore";
import { USER } from "@/lib/mock";

/** Your own profile: the shared layout, plus the controls only you get. */
export function ProfileView() {
  const { flights, openEditor, reset } = useFlights();
  const { profile, openEditor: editProfile } = useProfile();
  const { friends } = useFriends();
  const nowOrNull = useNow();
  // greeting only after mount so server and client markup match
  const h = nowOrNull?.getHours() ?? 0;
  const greeting = !nowOrNull ? "Welcome back" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  return (
    <ProfileLayout
      who={{ ...profile, username: USER.username, joined: USER.joined }}
      subtitle={greeting}
      friendCount={friends.length}
      friendAvatars={friends}
      flights={flights}
      now={nowOrNull ?? new Date()}
      own={{ onAddFlight: () => openEditor(), onEditProfile: () => editProfile(), onReset: reset }}
    />
  );
}
