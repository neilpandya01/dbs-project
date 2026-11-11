import type { Metadata } from "next";
import { FriendsView } from "./FriendsView";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  return (
    <>
      <div className="page-head">
        <h1>Friends</h1>
        <p>Mutual follows only. Friends see your flights and live position while you’re in the air.</p>
      </div>
      <FriendsView />
    </>
  );
}
