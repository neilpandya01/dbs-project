"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { useFriends } from "@/lib/friendsStore";
import { useProfile } from "@/lib/profileStore";

const icons = {
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5Z" />,
  map: <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Zm0 2.3 4.5 2.3v11l-4.5-2.3v-11Z" />,
  flights: <path d="M4 5h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V6a1 1 0 0 1 1-1Zm4 3v8h2V8H8Zm4 0v8h5V8h-5Z" />,
  friends: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 13c-3.3 0-6 1.7-6 4.5V19h12v-1.5C15 14.700 12.3 13 9 13Zm8 1c-.5 0-1 .1-1.5.2 1.1.9 1.800 2.100 2 3.5V19h4v-1.5c0-2-2-3.5-4.5-3.5Z" />,
  news: <path d="M4 5h13a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm1 2v10h12V7H5Zm2 2h8v2H7V9Zm0 3h8v2H7v-2Z" />,
};

const LINKS = [
  { href: "/profile", label: "Profile", icon: icons.profile },
  { href: "/flights", label: "Flights", icon: icons.flights },
  { href: "/map", label: "Map", icon: icons.map },
  { href: "/friends", label: "Friends", icon: icons.friends },
  { href: "/news", label: "News", icon: icons.news },
];

export function Nav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { badge } = useFriends();
  return (
    <>
      <header className="topbar">
        <Link href="/profile" className="brand">
          <span className="brand-mark" aria-hidden="true">✈</span> Wingmates
        </Link>
        <span className="spacer" />
        <Link href="/profile" className="me" aria-label="Your profile">
          <Avatar name={profile.name} size={30} color={profile.color} src={profile.photo} />
          <span className="me-name">{profile.name}</span>
        </Link>
      </header>
      <nav className="dock" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{l.icon}</svg>
              {l.href === "/friends" && badge > 0 && (
                <span className="nav-badge" role="status">
                  <span className="sr-only">{badge} new friend update{badge === 1 ? "" : "s"}</span>
                </span>
              )}
            </span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
