import type { Metadata } from "next";
import { NewsView } from "./NewsView";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  return (
    <>
      <div className="page-head">
        <h1>News</h1>
        <p>What’s happening at airports, reported by people on Wingmates.</p>
      </div>
      <NewsView />
    </>
  );
}
