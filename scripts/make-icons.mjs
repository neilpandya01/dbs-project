// Generates the installable-app PNG icons into public/icons (run: node scripts/make-icons.mjs)
import sharp from "sharp";

const glyph = `<path d="M32 10c1.7 0 3 1.3 3 3v14l19 11v5l-19-5v10l5 4v4l-8-2-8 2v-4l5-4V38l-19 5v-5l19-11V13c0-1.7 1.3-3 3-3z" fill="#fff"/>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2a5b"/><stop offset="1" stop-color="#1d5fd1"/></linearGradient></defs>`;
// full-bleed square (the OS applies its own rounding / mask); `scale` shrinks the plane into the maskable safe zone
const svg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}<rect width="64" height="64" fill="url(#g)"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyph}</g></svg>`;

const out = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["maskable-192.png", 192, 0.72],
  ["maskable-512.png", 512, 0.72],
  ["apple-touch-icon.png", 180, 0.9],
];
for (const [name, size, scale] of out) {
  await sharp(Buffer.from(svg(scale)), { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log("icons written");
