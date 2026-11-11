import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { FlightsProvider } from "@/lib/flightsStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { ProfileProvider } from "@/lib/profileStore";
import "./globals.css";

const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Source_Serif_4({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wingmates", template: "%s · Wingmates" },
  description: "Your flights, your spots, your crew. A free social app for avgeeks.",
  applicationName: "Wingmates",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cfe9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#123566" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>
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
      </body>
    </html>
  );
}
