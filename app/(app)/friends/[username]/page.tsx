import type { Metadata } from "next";
import { FriendProfile } from "./FriendProfile";

export const metadata: Metadata = { title: "Friend" };

export default async function FriendPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FriendProfile username={decodeURIComponent(username)} />;
}
