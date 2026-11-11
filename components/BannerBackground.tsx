import { BannerArt, type Banner } from "@/lib/banners";

/** The banner picture itself: an illustrated preset, or the user's photo with a soft fade for legible text. */
export function BannerBackground({ banner }: { banner: Banner }) {
  if (banner.kind === "preset") return <BannerArt id={banner.id} />;
  return (
    <>
      <img src={banner.src} alt="" style={{ objectPosition: `50% ${banner.focusY ?? 50}%` }} />
      <div className="hero-scrim" />
    </>
  );
}
