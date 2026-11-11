import { Nav } from "@/components/Nav";
import { AirportsProvider } from "@/lib/airports";
import { FlightsProvider } from "@/lib/flightsStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { ProfileProvider } from "@/lib/profileStore";

/** The signed-in app: airports, then your profile, friends and flights from Supabase, then the screens. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AirportsProvider>
      <ProfileProvider>
        <FriendsProvider>
          <FlightsProvider>
            <div className="shell">
              <Nav />
              <main className="main">{children}</main>
            </div>
          </FlightsProvider>
        </FriendsProvider>
      </ProfileProvider>
    </AirportsProvider>
  );
}
