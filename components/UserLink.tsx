import Link from "next/link";

/**
 * Opens someone's profile page. For a friend that's their full profile; for anyone else it's their banner, name and
 * username, with the button that fits where things stand (add friend, requested, accept...). Your own name goes to your profile.
 */
export function UserLink({ username, children }: { username: string; children: React.ReactNode }) {
  return (
    <Link href={`/friends/${encodeURIComponent(username)}`} className="user-link" aria-label={`View @${username}’s profile`}>
      {children}
    </Link>
  );
}
