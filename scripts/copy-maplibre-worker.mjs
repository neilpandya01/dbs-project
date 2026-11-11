// MapLibre v6 loads its web worker from a URL; serve it from /public so bundlers don't have to.
import { cpSync, mkdirSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist";
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) cpSync(`${src}/${f}`, `public/maplibre/${f}`);
