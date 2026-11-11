import type { Metadata } from "next";
import { NewsView } from "./NewsView";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  return (
    <>
      <div className="page-head">
        <h1>Aviation news</h1>
        <p>What’s happening at the airports and airlines you follow.</p>
      </div>
      <NewsView />
    </>
  );
}
