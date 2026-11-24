import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Wingmates",
    short_name: "Wingmates",
    description: "Your flights, your spots, your crew. A free social app for avgeeks.",
    start_url: "/profile",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eaf5ff",
    theme_color: "#1d5fd1",
    categories: ["travel", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Flights", url: "/flights", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Live map", url: "/map", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Friends", url: "/friends", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
