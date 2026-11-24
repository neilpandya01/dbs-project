import type { Metadata } from "next";
import { FriendMapView } from "./FriendMapView";

export const metadata: Metadata = { title: "Their flights" };

export default async function FriendMapPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username);
  return (
    <>
      <div className="page-head map-head">
        <h1>@{name}’s flights</h1>
        <p>Where they’ve flown. This is their map, separate from yours.</p>
      </div>
      <FriendMapView username={name} />
    </>
  );
}
