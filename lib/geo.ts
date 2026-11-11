export type LngLat = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceMiles(a: LngLat, b: LngLat): number {
  const [lon1, lat1] = [rad(a[0]), rad(a[1])];
  const [lon2, lat2] = [rad(b[0]), rad(b[1])];
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/** Point at fraction t (0..1) along the great circle from a to b. */
export function greatCirclePoint(a: LngLat, b: LngLat, t: number): LngLat {
  const [lon1, lat1] = [rad(a[0]), rad(a[1])];
  const [lon2, lat2] = [rad(b[0]), rad(b[1])];
  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );
  if (d === 0) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.sqrt(x * x + y * y)))];
}

export function greatCircleLine(a: LngLat, b: LngLat, steps = 64): LngLat[] {
  const pts: LngLat[] = [];
  let prevLon: number | null = null;
  let offset = 0;
  for (let i = 0; i <= steps; i++) {
    const p = greatCirclePoint(a, b, i / steps);
    // unwrap across the antimeridian so lines don't streak across the map
    if (prevLon !== null) {
      const diff = p[0] + offset - prevLon;
      if (diff > 180) offset -= 360;
      else if (diff < -180) offset += 360;
    }
    const lon = p[0] + offset;
    pts.push([lon, p[1]]);
    prevLon = lon;
  }
  return pts;
}

export function bearing(a: LngLat, b: LngLat): number {
  const [lon1, lat1, lon2, lat2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Position and heading (degrees clockwise from north) at fraction p along an unwrapped line. */
export function linePoint(line: LngLat[], p: number): { pos: LngLat; heading: number } {
  const last = line.length - 1;
  const i = Math.min(last - 1, Math.max(0, Math.round(p * last)));
  return { pos: line[i], heading: bearing(line[i], line[i + 1]) };
}
