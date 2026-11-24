import { Nav } from "@/components/Nav";
import { PwaSetup } from "@/components/PwaSetup";
import { Onboarding } from "@/components/Onboarding";
import { AirportsProvider } from "@/lib/airports";
import { FlightsProvider } from "@/lib/flightsStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { MentionsProvider } from "@/lib/mentionsStore";
import { ProfileProvider } from "@/lib/profileStore";

/** The signed-in app: airports, then your profile, friends and flights from Supabase, then the screens. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AirportsProvider>
      <ProfileProvider>
        <FriendsProvider>
          <FlightsProvider>
            <MentionsProvider>
            <div className="shell">
              <Nav />
              <main className="main">{children}</main>
            <Onboarding />
              <PwaSetup />
            </div>
          </MentionsProvider>
          </FlightsProvider>
        </FriendsProvider>
      </ProfileProvider>
    </AirportsProvider>
  );
}
