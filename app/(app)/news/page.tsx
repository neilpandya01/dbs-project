import type { Metadata } from "next";
import { NewsView } from "./NewsView";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  return (
    <>
      <div className="page-head">
        <h1>News</h1>
        <p>Reports from Wingmates users about what’s happening at airports.</p>
      </div>
      <NewsView />
    </>
  );
}
