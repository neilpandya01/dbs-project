/**
 * Commercial aircraft catalog. One canonical name per type, so the form's picker, the flight lookup and the
 * stats all agree ("Airbus A320-200" from the lookup and "A320" typed by hand both become "Airbus A320").
 * Each row: [canonical name, ICAO type code, ...other spellings].
 */
type Row = [name: string, icao: string, ...aliases: string[]];

const ROWS: Row[] = [
  // --- Airbus
  ["Airbus A220-100", "BCS1", "A220-100", "A221", "Bombardier CS100", "CS100", "BD-500-1A10"],
  ["Airbus A220-300", "BCS3", "A220-300", "A223", "Bombardier CS300", "CS300", "BD-500-1A11"],
  ["Airbus A300-600", "A306", "A300", "A300B4", "A300-600R"],
  ["Airbus A310", "A310", "A310-300"],
  ["Airbus A318", "A318", "A318-100"],
  ["Airbus A319", "A319", "A319-100"],
  ["Airbus A319neo", "A19N", "A319 NEO"],
  ["Airbus A320", "A320", "A320-200", "A320ceo"],
  ["Airbus A320neo", "A20N", "A320 NEO", "A320-251N", "A320-271N"],
  ["Airbus A321", "A321", "A321-200", "A321ceo"],
  ["Airbus A321neo", "A21N", "A321 NEO", "A321-251N", "A321-271N"],
  ["Airbus A321XLR", "A21N", "A321-XLR", "A321neo XLR", "A321 NEO XLR", "A321neoXLR"],
  ["Airbus A330-200", "A332", "A330"],
  ["Airbus A330-300", "A333"],
  ["Airbus A330-800neo", "A338", "A330-800", "A330-800 NEO", "A330-841"],
  ["Airbus A330-900neo", "A339", "A330-900", "A330-900 NEO", "A330-941"],
  ["Airbus A340-200", "A342"],
  ["Airbus A340-300", "A343", "A340"],
  ["Airbus A340-500", "A345"],
  ["Airbus A340-600", "A346"],
  ["Airbus A350-900", "A359", "A350"],
  ["Airbus A350-1000", "A35K"],
  ["Airbus A380-800", "A388", "A380"],
  // --- Boeing
  ["Boeing 717-200", "B712", "717"],
  ["Boeing 727-200", "B722", "727"],
  ["Boeing 737-300", "B733"],
  ["Boeing 737-400", "B734"],
  ["Boeing 737-500", "B735"],
  ["Boeing 737-600", "B736"],
  ["Boeing 737-700", "B737", "737-700/W"],
  ["Boeing 737-800", "B738", "737-800/W", "737"],
  ["Boeing 737-900", "B739", "737-900ER", "B739ER"],
  ["Boeing 737 MAX 7", "B37M", "737-7", "737 MAX-7", "737-7 MAX", "737 MAX7"],
  ["Boeing 737 MAX 8", "B38M", "737-8", "737 MAX-8", "737MAX8", "737 MAX", "737-8 MAX", "737 MAX8", "737-8200", "737-8-200"],
  ["Boeing 737 MAX 9", "B39M", "737-9", "737 MAX-9", "737MAX9", "737-9 MAX", "737 MAX9"],
  ["Boeing 737 MAX 10", "B3XM", "737-10", "737 MAX-10", "737-10 MAX", "737 MAX10"],
  ["Boeing 747-200", "B742"],
  ["Boeing 747-300", "B743"],
  ["Boeing 747-400", "B744", "747"],
  ["Boeing 747-8", "B748", "747-8I", "747-8 Intercontinental"],
  ["Boeing 757-200", "B752", "757"],
  ["Boeing 757-300", "B753"],
  ["Boeing 767-200", "B762"],
  ["Boeing 767-300", "B763", "767"],
  ["Boeing 767-300ER", "B763", "767-300 ER"],
  ["Boeing 767-400ER", "B764", "767-400"],
  ["Boeing 777-200", "B772"],
  ["Boeing 777-200ER", "B772", "777-200 ER", "777"],
  ["Boeing 777-200LR", "B77L"],
  ["Boeing 777-300", "B773"],
  ["Boeing 777-300ER", "B77W", "777-300 ER"],
  ["Boeing 777-8", "B778", "777-8X"],
  ["Boeing 777-9", "B779", "777-9X"],
  ["Boeing 777F", "B77F", "777-200F", "777 Freighter"],
  ["Boeing 787-8", "B788", "787-8 Dreamliner"],
  ["Boeing 787-9", "B789", "787-9 Dreamliner", "787"],
  ["Boeing 787-10", "B78X", "787-10 Dreamliner"],
  // --- Embraer
  ["Embraer ERJ 135", "E135", "ERJ-135", "EMB-135"],
  ["Embraer ERJ 145", "E145", "ERJ-145", "EMB-145"],
  ["Embraer E170", "E170", "ERJ-170", "ERJ 170", "ERJ170", "Embraer 170", "E-170"],
  ["Embraer E175", "E75L", "E75S", "E175", "Embraer 175", "ERJ-175", "ERJ 175", "ERJ175", "EMB-175", "E-175", "Embraer 175 STD"],
  ["Embraer E190", "E190", "Embraer 190", "ERJ-190", "ERJ 190", "ERJ190", "EMB-190", "E-190", "Embraer 190 STD"],
  ["Embraer E195", "E195", "Embraer 195", "ERJ-195", "ERJ 195", "ERJ195", "E-195"],
  ["Embraer E175-E2", "E75L", "E175-E2", "Embraer 175 E2", "E175 E2", "E2-175"],
  ["Embraer E190-E2", "E290", "E190-E2", "Embraer 190 E2", "E190 E2", "E2-190"],
  ["Embraer E195-E2", "E295", "E195-E2", "Embraer 195 E2", "E195 E2", "E2-195"],
  // --- Bombardier / De Havilland Canada / Mitsubishi
  ["Bombardier CRJ-200", "CRJ2", "CRJ200", "CRJ 200", "CRJ-100", "CRJ100", "CRJ-200ER", "CL-600-2B19", "CL600"],
  ["Bombardier CRJ-700", "CRJ7", "CRJ700", "CRJ 700", "CRJ-701", "CRJ-702", "CL-600-2C10"],
  ["Bombardier CRJ-900", "CRJ9", "CRJ900", "CRJ 900", "CRJ-900ER", "CRJ-900LR", "CL-600-2D24"],
  ["Bombardier CRJ-1000", "CRJX", "CRJ1000", "CRJ 1000", "CL-600-2E25"],
  ["De Havilland Dash 8-100", "DH8A", "Dash 8-100", "Q100", "DHC-8-100", "DHC8-100", "DHC-8-102"],
  ["De Havilland Dash 8-300", "DH8C", "Dash 8-300", "Q300", "DHC-8-300", "DHC8-300", "DHC-8-311"],
  ["De Havilland Dash 8-400", "DH8D", "Dash 8-400", "Q400", "Dash 8 Q400", "Bombardier Q400", "Bombardier Dash 8 Q400", "DHC-8-400", "DHC8-400", "DHC-8-402", "Dash 8-Q400"],
  ["Mitsubishi SpaceJet M90", "MRJ9", "MRJ90"],
  // --- ATR / Saab / Fokker / BAe / others
  ["ATR 42-500", "AT45", "ATR 42", "ATR42"],
  ["ATR 42-600", "AT46"],
  ["ATR 72-500", "AT75", "ATR 72", "ATR72"],
  ["ATR 72-600", "AT76", "ATR72-600", "ATR 72-212A", "ATR 72-212A (600)"],
  ["Saab 340", "SF34", "SAAB 340B"],
  ["Saab 2000", "SB20"],
  ["Fokker 50", "F50"],
  ["Fokker 70", "F70"],
  ["Fokker 100", "F100"],
  ["BAe 146-200", "B462", "BAe 146", "Avro RJ85"],
  ["Avro RJ100", "B463", "BAe 146-300"],
  ["Beechcraft 1900D", "B190", "Beech 1900"],
  ["Cessna 208 Caravan", "C208", "Caravan", "Grand Caravan"],
  ["Dornier 328", "D328"],
  ["Embraer EMB 120 Brasilia", "E120", "EMB-120"],
  ["Britten-Norman Islander", "BN2P", "BN-2"],
  ["De Havilland Twin Otter", "DHC6", "DHC-6", "Twin Otter"],
  // --- Russian / Chinese / regional jets
  ["Sukhoi Superjet 100", "SU95", "SSJ100", "Superjet"],
  ["Comac C919", "C919"],
  ["Comac ARJ21", "AR21", "ARJ21"],
  ["Irkut MC-21", "MC21", "MC-21-300"],
  ["Ilyushin Il-96", "IL96"],
  ["Tupolev Tu-154", "T154"],
  ["Tupolev Tu-204", "T204"],
  ["Antonov An-148", "A148"],
  ["Yakovlev Yak-42", "YK42"],
  // --- Classics
  ["McDonnell Douglas DC-9", "DC93", "DC-9"],
  ["McDonnell Douglas DC-10", "DC10", "DC-10-30"],
  ["McDonnell Douglas MD-11", "MD11", "MD-11"],
  ["McDonnell Douglas MD-80", "MD82", "MD-82", "MD-83", "MD-88", "MD80", "MD-87", "MD-81", "MD-80", "MD-83/88"],
  ["McDonnell Douglas MD-90", "MD90", "MD-90-30"],
  ["Boeing 737-200", "B732"],
  ["Lockheed L-1011 TriStar", "L101", "L-1011"],
  ["Concorde", "CONC"],
  ["Boeing 707", "B703"],
  ["Boeing 720", "B720"],
];

export type AircraftType = { name: string; icao: string };

export const AIRCRAFT_TYPES: AircraftType[] = ROWS.map(([name, icao]) => ({ name, icao }));

/** Lowercase letters and digits only, so "A320-200", "a320 200" and "A320200" compare equal. */
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Manufacturer words a lookup may put in front of the model ("Canadair CRJ-900", "McDonnell Douglas MD-82"). */
const MAKER_PREFIX = /^(airbus|boeing|embraer|bombardier|canadair regional jet|canadair|de havilland canada|de havilland|dehavilland|mcdonnell douglas|mcdonnell|douglas|lockheed|fokker|saab|bae|british aerospace|avro|cessna|beechcraft|beech|dornier|mitsubishi|sukhoi|comac|irkut|ilyushin|tupolev|antonov|yakovlev)\s+/i;
const withoutMaker = (s: string) => s.replace(MAKER_PREFIX, "");

const byKey = new Map<string, string>();
const byIcao = new Map<string, string>();
for (const [name, icao, ...aliases] of ROWS) {
  for (const text of [name, ...aliases]) {
    for (const k of [key(text), key(withoutMaker(text))]) if (!byKey.has(k)) byKey.set(k, name);
  }
  if (!byIcao.has(icao)) byIcao.set(icao, name);
}

/**
 * Registry/customer codes that name a type by its "series" digit: 737-824 is a 737-800, 737-7H4 a 737-700, A330-343 an
 * A330-300, A350-941 an A350-900. Without this, shortening "737-824" to "737-8" would wrongly land on the 737 MAX 8.
 */
function bySeries(s: string): string | undefined {
  const t = withoutMaker(s).replace(/\s+/g, "").toUpperCase();
  const b = /^(7[0-9]7)-?([1-9])([0-9A-Z]{2})(ER|W)?$/.exec(t);
  if (b && ["737", "747", "757", "767", "777"].includes(b[1])) {
    return byKey.get(key(`${b[1]}-${b[2]}00`));
  }
  const a = /^(A3[34]0)-?([0-9])[0-9]{2}$/.exec(t);
  if (a) return byKey.get(key(`${a[1]}-${a[2]}00`));
  const a5 = /^A350-?(9|10)[0-9]{2}$/.exec(t);
  if (a5) return byKey.get(key(`A350-${a5[1] === "9" ? "900" : "1000"}`));
  const a8 = /^A380-?8[0-9]{2}$/.exec(t);
  if (a8) return byKey.get(key("A380-800"));
  // the narrow-body family with an N suffix (A321-253NX, A320-271N) is the neo
  const n = /^(A31[89]|A32[01])-?[0-9]{3}N[X]?$/.exec(t);
  if (n) return byKey.get(key(`${n[1]} NEO`));
  return undefined;
}

const MAKERS = ["Boeing", "Airbus", "Embraer", "Bombardier", "De Havilland", "McDonnell Douglas", "Boeing", "Lockheed", "Fokker", "Saab", "ATR"];

/**
 * Turns whatever a lookup or a person typed into a catalog name. Tries the exact name, then an ICAO code,
 * then drops trailing words (variants like "Airbus A320-232 (sharklets)"). Unknown types come back
 * unchanged, so nothing is ever lost.
 */
export function canonicalAircraft(raw?: string | null): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  const direct = byKey.get(key(s)) ?? byKey.get(key(withoutMaker(s))) ?? byIcao.get(s.toUpperCase());
  if (direct) return direct;
  const series = bySeries(s);
  if (series) return series;
  // "Airbus A320-232 (sharklets)" -> try shorter and shorter prefixes of the text
  const words = s.replace(/\(.*?\)/g, " ").split(/\s+/).filter(Boolean);
  for (let n = words.length; n >= 2; n--) {
    const text = words.slice(0, n).join(" ");
    const hit = byKey.get(key(text)) ?? byKey.get(key(withoutMaker(text)));
    if (hit) return hit;
    const ser = bySeries(text);
    if (ser) return ser;
  }
  // "DHC-8-400 Dash 8", "ERJ-175 STD": the model code alone, after the maker
  const model = withoutMaker(words.join(" ")).split(/\s+/)[0];
  if (model && model.length >= 3) {
    const hit = byKey.get(key(model)) ?? bySeries(model);
    if (hit) return hit;
  }
  // "A320-232": same type family with an engine/customer suffix -> shorten the last token
  const last = words[words.length - 1] ?? "";
  for (let n = last.length - 1; n >= 3; n--) {
    const hit = byKey.get(key([...words.slice(0, -1), last.slice(0, n)].join(" ")));
    if (hit) return hit;
  }
  return s;
}

export function manufacturerOf(type: string) {
  const t = type.toLowerCase();
  if (/^(bombardier|de havilland|dash)/.test(t)) return "Bombardier / De Havilland";
  return MAKERS.find((m) => t.startsWith(m.toLowerCase())) ?? "Other";
}
