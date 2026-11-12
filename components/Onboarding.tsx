"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { FlightForm } from "./FlightForm";
import { ProfileForm } from "./ProfileForm";
import { useFlights } from "@/lib/flightsStore";
import { useProfile } from "@/lib/profileStore";

/**
 * First-run setup, shown over the app until it's done:
 *   1. Profile (required, can't be skipped): display name and home city.
 *   2. "Add your first flight" (optional): skipping is remembered on the Clerk user so it isn't shown again.
 */
export function Onboarding() {
  const { user } = useUser();
  const { profile, loading: profileLoading, error, update } = useProfile();
  const { flights, loading: flightsLoading, add } = useFlights();
  const [skipped, setSkipped] = useState(false);

  if (profileLoading || flightsLoading || error || !user) return null;

  if (!profile.home || !profile.name.trim()) {
    return <ProfileForm onboarding profile={profile} username={profile.username} onSave={update} onClose={() => {}} />;
  }

  const skippedBefore = user.unsafeMetadata?.skippedFirstFlight === true;
  if (flights.length === 0 && !skipped && !skippedBefore) {
    const skip = () => {
      setSkipped(true);
      user.update({ unsafeMetadata: { ...user.unsafeMetadata, skippedFirstFlight: true } }).catch(() => {});
    };
    return <FlightForm onboarding flight={null} knownFlights={flights} onSave={add} onClose={skip} />;
  }
  return null;
}
