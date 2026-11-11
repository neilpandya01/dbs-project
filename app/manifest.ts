import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wingmates",
    short_name: "Wingmates",
    description: "Your flights, your spots, your crew.",
    start_url: "/profile",
    display: "standalone",
    background_color: "#eaf5ff",
    theme_color: "#1d5fd1",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
