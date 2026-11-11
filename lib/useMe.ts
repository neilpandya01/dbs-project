"use client";

import { useUser } from "@clerk/nextjs";

/** Who is signed in, from Clerk. `id` is Clerk's user id (a string like "user_2abc..."), not a UUID. */
export function useMe() {
  const { user, isLoaded } = useUser();
  const created = user?.createdAt ? new Date(user.createdAt) : null;
  return {
    isLoaded,
    id: user?.id ?? null,
    username: user?.username ?? "you",
    name: user?.fullName || user?.username || "You",
    imageUrl: user?.imageUrl ?? null,
    joined: created ? created.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
  };
}
