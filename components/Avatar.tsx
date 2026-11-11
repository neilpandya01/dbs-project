/** Dark text on light backgrounds, white on dark ones (custom avatar colours can be anything). */
function textOn(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0d2340" : "#fff";
}

export function Avatar({ name, color = "#1d5fd1", size = 40, src }: { name: string; color?: string; size?: number; src?: string | null }) {
  const initials = name
    .split(/[\s,.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className="avatar" style={{ background: color, color: textOn(color), ["--s" as string]: `${size}px` }} aria-hidden="true">
      {src ? <img src={src} alt="" className="avatar-img" /> : initials}
    </span>
  );
}
