export type BannerId = "clouds" | "sunrise" | "golden" | "desert" | "mountains" | "wing" | "night" | "aurora" | "city" | "storm" | "contrails" | "runway";

/** focusY (0-100) picks which part of a tall photo stays visible in the wide banner. */
export type Banner = { kind: "preset"; id: BannerId } | { kind: "photo"; src: string; focusY?: number };

export const BANNER_PRESETS: { id: BannerId; name: string }[] = [
  { id: "clouds", name: "Clear skies" },
  { id: "sunrise", name: "Sunrise climb" },
  { id: "golden", name: "Golden hour" },
  { id: "desert", name: "Desert dawn" },
  { id: "mountains", name: "Over the peaks" },
  { id: "wing", name: "Window seat" },
  { id: "night", name: "Night flight" },
  { id: "aurora", name: "Northern lights" },
  { id: "city", name: "City lights" },
  { id: "storm", name: "Thunderheads" },
  { id: "contrails", name: "Contrails" },
  { id: "runway", name: "Runway at dusk" },
];

export const DEFAULT_BANNER: Banner = { kind: "preset", id: "clouds" };

// same airliner silhouette the map uses (points up; rotate to bank it)
const PLANE = "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

function Cloud({ x, y, s = 1, o = 0.9, fill = "#fff" }: { x: number; y: number; s?: number; o?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} opacity={o}>
      <ellipse cx="0" cy="0" rx="70" ry="17" />
      <ellipse cx="-34" cy="-9" rx="32" ry="16" />
      <ellipse cx="22" cy="-15" rx="38" ry="19" />
    </g>
  );
}

function Plane({ x, y, r, s, fill, o = 1 }: { x: number; y: number; r: number; s: number; fill: string; o?: number }) {
  return <path d={PLANE} transform={`translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-12 -12)`} fill={fill} opacity={o} />;
}

const stars = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 173 + 41) % 800,
  y: (i * 97 + 13) % 190,
  r: i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.8,
  o: 0.45 + ((i * 31) % 50) / 100,
}));

/** Illustrated, aviation-themed backdrops drawn in SVG so they stay crisp and tiny. */
export function BannerArt({ id }: { id: BannerId }) {
  const common = { viewBox: "0 0 800 300", preserveAspectRatio: "xMidYMid slice", width: "100%", height: "100%", "aria-hidden": true } as const;
  switch (id) {
    case "clouds":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-clouds" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#9fd2ff" /><stop offset="1" stopColor="#e9f5ff" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-clouds)" />
          <path d="M -20 250 Q 400 -70 820 190" fill="none" stroke="#fff" strokeWidth="2.4" strokeDasharray="6 11" opacity=".75" />
          <Cloud x={120} y={235} s={1.5} o={0.95} /><Cloud x={640} y={90} s={1.9} o={0.85} /><Cloud x={420} y={270} s={1.4} o={0.9} />
          <Plane x={470} y={68} r={72} s={1.7} fill="#ffffff" o={0.9} />
        </svg>
      );
    case "sunrise":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="b-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8cc4ff" /><stop offset=".55" stopColor="#ffd9b4" /><stop offset="1" stopColor="#ffab84" /></linearGradient>
            <radialGradient id="b-sun-glow"><stop offset="0" stopColor="#fff6cf" /><stop offset="1" stopColor="#fff6cf" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="800" height="300" fill="url(#b-sun)" />
          <circle cx="610" cy="215" r="120" fill="url(#b-sun-glow)" /><circle cx="610" cy="215" r="40" fill="#fff4c9" />
          <Cloud x={160} y={245} s={1.6} fill="#ffe9d6" o={0.95} /><Cloud x={560} y={262} s={1.9} fill="#ffe0cc" o={0.95} /><Cloud x={700} y={120} s={1.2} fill="#fff1e6" o={0.8} />
          <Plane x={330} y={100} r={58} s={1.6} fill="#0d2340" o={0.7} />
          <path d="M 120 205 Q 230 160 318 108" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        </svg>
      );
    case "golden":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9b3" /><stop offset=".5" stopColor="#ffc47e" /><stop offset="1" stopColor="#f69169" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-gold)" />
          <circle cx="170" cy="190" r="58" fill="#fff0c2" opacity=".85" />
          <Cloud x={420} y={225} s={2} fill="#ffd9b0" o={0.9} /><Cloud x={700} y={255} s={1.6} fill="#ffcda0" o={0.9} /><Cloud x={300} y={282} s={1.7} fill="#f9b48a" o={0.95} />
          <Plane x={560} y={90} r={80} s={1.7} fill="#6a2f1a" o={0.6} />
          <path d="M 380 112 L 540 96" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
        </svg>
      );
    case "mountains":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a3d4ff" /><stop offset="1" stopColor="#e2f1ff" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-mtn)" />
          <Cloud x={620} y={70} s={1.5} o={0.85} />
          <path d="M0 300 V210 L120 150 L210 205 L330 120 L450 215 L560 160 L680 225 L800 170 V300Z" fill="#b9d5f0" />
          <path d="M0 300 V245 L90 205 L190 250 L300 190 L420 255 L540 205 L660 262 L800 215 V300Z" fill="#8fb7e0" />
          <Cloud x={200} y={262} s={1.8} o={0.95} /><Cloud x={560} y={285} s={2.1} o={0.95} />
          <Plane x={380} y={62} r={74} s={1.6} fill="#ffffff" o={0.95} />
        </svg>
      );
    case "night":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="b-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#040b20" /><stop offset="1" stopColor="#173b78" /></linearGradient>
            <radialGradient id="b-moon"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="800" height="300" fill="url(#b-night)" />
          {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
          <circle cx="660" cy="70" r="70" fill="url(#b-moon)" /><circle cx="660" cy="70" r="24" fill="#fff8e2" />
          <path d="M -10 215 Q 300 210 520 130" fill="none" stroke="#cfe3ff" strokeWidth="2.4" strokeDasharray="2 8" strokeLinecap="round" opacity=".7" />
          <Plane x={522} y={128} r={62} s={1.5} fill="#dcebff" />
          <circle cx="508" cy="141" r="2.6" fill="#ff5c5c" /><circle cx="538" cy="117" r="2.6" fill="#5cff9d" />
          <Cloud x={150} y={290} s={2} fill="#274d8c" o={0.7} /><Cloud x={600} y={296} s={2.4} fill="#274d8c" o={0.7} />
        </svg>
      );
    case "desert":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-des" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffeed4" /><stop offset="1" stopColor="#ffc999" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-des)" />
          <circle cx="620" cy="150" r="46" fill="#fff6dd" opacity=".95" /><circle cx="620" cy="150" r="80" fill="#fff6dd" opacity=".35" />
          <path d="M0 300 V225 C140 190 260 235 400 215 S650 185 800 225 V300Z" fill="#eab585" />
          <path d="M0 300 V262 C160 230 300 275 450 252 S680 232 800 262 V300Z" fill="#d79563" />
          <Cloud x={190} y={80} s={1.3} fill="#fff6e8" o={0.8} />
          <Plane x={380} y={92} r={70} s={1.5} fill="#7a3d20" o={0.6} />
        </svg>
      );
    case "wing":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b88e6" /><stop offset="1" stopColor="#cfe8ff" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-wing)" />
          <Cloud x={560} y={250} s={2.6} o={0.95} /><Cloud x={760} y={190} s={1.8} o={0.9} /><Cloud x={420} y={285} s={2} o={0.95} />
          <path d="M -20 300 L -20 205 L 340 138 L 540 90 L 566 98 L 470 190 L 410 300 Z" fill="#e4ebf4" />
          <path d="M -20 205 L 340 138 L 540 90" fill="none" stroke="#fff" strokeWidth="3" opacity=".9" />
          <path d="M 540 90 L 566 98 L 556 40 Z" fill="#2459a8" />
          <path d="M 120 228 L 330 190" stroke="#b9c6d8" strokeWidth="3" strokeDasharray="14 10" />
        </svg>
      );
    case "aurora":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="b-aur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#020816" /><stop offset="1" stopColor="#0d2d52" /></linearGradient>
            <linearGradient id="b-rib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#58ffb6" stopOpacity=".05" /><stop offset=".5" stopColor="#58ffb6" stopOpacity=".7" /><stop offset="1" stopColor="#3ad0ff" stopOpacity=".1" /></linearGradient>
          </defs>
          <rect width="800" height="300" fill="url(#b-aur)" />
          {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
          <path d="M -20 150 C 150 30 260 190 420 80 S 700 50 830 120 L 830 215 C 700 160 560 215 420 175 S 150 125 -20 235 Z" fill="url(#b-rib)" />
          <path d="M -20 110 C 120 20 300 150 460 60 S 720 30 830 80 L 830 130 C 700 100 560 150 420 120 S 160 80 -20 160 Z" fill="#a47bff" opacity=".28" />
          <path d="M0 300 V250 L110 215 L220 255 L340 205 L470 260 L610 220 L720 258 L800 232 V300Z" fill="#050f22" />
          <Plane x={640} y={96} r={64} s={1.3} fill="#e8f3ff" /><circle cx="628" cy="108" r="2.2" fill="#ff5c5c" />
        </svg>
      );
    case "city":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-city" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1230" /><stop offset=".6" stopColor="#3a3a82" /><stop offset="1" stopColor="#c8648a" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-city)" />
          {stars.slice(0, 22).map((s, i) => <circle key={i} cx={s.x} cy={s.y * 0.7} r={s.r} fill="#fff" opacity={s.o * 0.8} />)}
          {Array.from({ length: 18 }, (_, i) => {
            const w = 34 + ((i * 17) % 26), h = 70 + ((i * 53) % 110), x = i * 46 - 10;
            return (
              <g key={i}>
                <rect x={x} y={300 - h} width={w} height={h} fill="#0b1030" />
                {Array.from({ length: Math.floor(h / 16) }, (_, r) => (r * 7 + i) % 3 === 0 ? <rect key={r} x={x + 6 + ((r * 5) % 14)} y={300 - h + 8 + r * 14} width="4" height="5" fill="#ffd36b" opacity=".9" /> : null)}
              </g>
            );
          })}
          <Plane x={470} y={92} r={76} s={1.4} fill="#f2f6ff" /><circle cx="458" cy="102" r="2.3" fill="#ff5c5c" />
        </svg>
      );
    case "storm":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-storm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141a3c" /><stop offset="1" stopColor="#5b5f9a" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-storm)" />
          <Cloud x={120} y={95} s={2.6} fill="#2a3060" o={0.95} /><Cloud x={420} y={70} s={3} fill="#323a72" o={0.95} /><Cloud x={700} y={110} s={2.4} fill="#2a3060" o={0.95} />
          <Cloud x={250} y={250} s={2.8} fill="#7d82b8" o={0.9} /><Cloud x={620} y={270} s={3} fill="#8a8fc4" o={0.9} />
          <path d="M 470 88 L 440 160 L 468 160 L 436 232" fill="none" stroke="#ffe27a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          <Plane x={640} y={170} r={70} s={1.3} fill="#e7eeff" />
        </svg>
      );
    case "contrails":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-con" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0a3786" /><stop offset="1" stopColor="#3b97f5" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-con)" />
          <g fill="none" stroke="#fff" strokeLinecap="round">
            <path d="M -20 260 Q 300 190 560 70 T 830 -10" strokeWidth="5" opacity=".7" />
            <path d="M -20 285 Q 300 215 560 95 T 830 15" strokeWidth="3" opacity=".4" />
            <path d="M 80 -10 Q 260 120 470 150 T 830 260" strokeWidth="4" opacity=".55" />
            <path d="M 160 -20 Q 330 100 520 130 T 830 235" strokeWidth="2.4" opacity=".3" />
          </g>
          <Plane x={560} y={72} r={52} s={1.4} fill="#fff" /><Plane x={470} y={150} r={102} s={1.1} fill="#fff" o={0.9} />
        </svg>
      );
    case "runway":
      return (
        <svg {...common}>
          <defs><linearGradient id="b-run" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141a4a" /><stop offset=".62" stopColor="#6a4a8c" /><stop offset=".8" stopColor="#f08a6a" /><stop offset="1" stopColor="#1c2145" /></linearGradient></defs>
          <rect width="800" height="300" fill="url(#b-run)" />
          <rect y="226" width="800" height="74" fill="#12163a" />
          <path d="M 400 226 L 120 300 M 400 226 L 680 300" stroke="#f6c453" strokeWidth="2" opacity=".5" />
          {Array.from({ length: 8 }, (_, i) => {
            const t = (i + 1) / 8, y = 226 + 74 * t * t, dx = 280 * t * t;
            return <g key={i}><circle cx={400 - dx} cy={y} r={1.6 + 3 * t} fill="#ffcf6b" /><circle cx={400 + dx} cy={y} r={1.6 + 3 * t} fill="#ffcf6b" /></g>;
          })}
          <Plane x={560} y={92} r={74} s={1.5} fill="#e9f1ff" o={0.95} /><circle cx="548" cy="102" r="2.4" fill="#ff5c5c" />
        </svg>
      );
  }
}
