import { imageSrc } from "@/lib/threads";

/** Photos attached to a thread or comment. Each opens full size in a new tab. */
export function Photos({ images, size = "small" }: { images: string[]; size?: "small" | "large" }) {
  const list = images.map((p) => ({ p, src: imageSrc(p) })).filter((x): x is { p: string; src: string } => !!x.src);
  if (list.length === 0) return null;
  return (
    <div className={`photos ${size}`}>
      {list.map(({ p, src }) => (
        <a key={p} href={src} target="_blank" rel="noopener noreferrer" aria-label="Open photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
