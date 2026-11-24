/**
 * Checks that what the flight lookup returns for an aircraft lines up with the app's aircraft options.
 * Run: npm run check:aircraft
 */
import { AIRCRAFT_TYPES, canonicalAircraft } from "../lib/aircraft";

const names = new Set(AIRCRAFT_TYPES.map((t) => t.name));
let fails = 0;
const fail = (msg: string) => { fails++; console.error("FAIL", msg); };

// 1. every option in the picker maps to itself
for (const t of AIRCRAFT_TYPES) if (canonicalAircraft(t.name) !== t.name) fail(`name round-trip: "${t.name}" -> "${canonicalAircraft(t.name)}"`);

// 2. every ICAO code maps to an option that has that code
for (const t of AIRCRAFT_TYPES) {
  const got = canonicalAircraft(t.icao);
  const gotIcao = AIRCRAFT_TYPES.find((x) => x.name === got)?.icao;
  if (!got || gotIcao !== t.icao) fail(`ICAO ${t.icao} (${t.name}) -> "${got}"`);
}

// 3. strings a lookup is likely to send -> the option we expect (each must be a real picker option)
const CASES: [string, string][] = [
  ["Airbus A320", "Airbus A320"], ["Airbus A320-200", "Airbus A320"], ["Airbus A320-232", "Airbus A320"], ["Airbus A320 (sharklets)", "Airbus A320"],
  ["Airbus A320neo", "Airbus A320neo"], ["Airbus A320 NEO", "Airbus A320neo"], ["Airbus A320-271N", "Airbus A320neo"],
  ["Airbus A321-200", "Airbus A321"], ["Airbus A321-231", "Airbus A321"], ["Airbus A321neo", "Airbus A321neo"], ["Airbus A321-253NX", "Airbus A321neo"],
  ["Airbus A321neo XLR", "Airbus A321XLR"], ["Airbus A321XLR", "Airbus A321XLR"], ["Airbus A319-100", "Airbus A319"], ["Airbus A319-132", "Airbus A319"], ["Airbus A318", "Airbus A318"],
  ["Airbus A330-200", "Airbus A330-200"], ["Airbus A330-243", "Airbus A330-200"], ["Airbus A330-300", "Airbus A330-300"], ["Airbus A330-343", "Airbus A330-300"],
  ["Airbus A330-900", "Airbus A330-900neo"], ["Airbus A330-941", "Airbus A330-900neo"], ["Airbus A330-800", "Airbus A330-800neo"],
  ["Airbus A340-313", "Airbus A340-300"], ["Airbus A340-642", "Airbus A340-600"],
  ["Airbus A350-900", "Airbus A350-900"], ["Airbus A350-941", "Airbus A350-900"], ["Airbus A350-1000", "Airbus A350-1000"], ["Airbus A350-1041", "Airbus A350-1000"],
  ["Airbus A380-800", "Airbus A380-800"], ["Airbus A380-841", "Airbus A380-800"],
  ["Airbus A220-100", "Airbus A220-100"], ["Airbus A220-300", "Airbus A220-300"], ["Bombardier CS300", "Airbus A220-300"], ["Airbus BD-500-1A11", "Airbus A220-300"],
  ["Boeing 737-700", "Boeing 737-700"], ["Boeing 737-800", "Boeing 737-800"], ["Boeing 737-800 (winglets)", "Boeing 737-800"], ["Boeing 737-900", "Boeing 737-900"], ["Boeing 737-900ER", "Boeing 737-900"],
  ["Boeing 737-824", "Boeing 737-800"], ["Boeing 737-8AS", "Boeing 737-800"], ["Boeing 737-76N", "Boeing 737-700"], ["Boeing 737-924ER", "Boeing 737-900"], ["Boeing 737-8H4W", "Boeing 737-800"],
  ["Boeing 737 MAX 8", "Boeing 737 MAX 8"], ["Boeing 737-8 MAX", "Boeing 737 MAX 8"], ["Boeing 737-8", "Boeing 737 MAX 8"], ["Boeing 737 MAX 9", "Boeing 737 MAX 9"], ["Boeing 737-9", "Boeing 737 MAX 9"], ["Boeing 737MAX 8", "Boeing 737 MAX 8"],
  ["Boeing 737-400", "Boeing 737-400"], ["Boeing 737-300", "Boeing 737-300"], ["Boeing 737-200", "Boeing 737-200"],
  ["Boeing 747-400", "Boeing 747-400"], ["Boeing 747-8", "Boeing 747-8"], ["Boeing 747-8I", "Boeing 747-8"],
  ["Boeing 757-200", "Boeing 757-200"], ["Boeing 757-300", "Boeing 757-300"], ["Boeing 767-300", "Boeing 767-300"], ["Boeing 767-300ER", "Boeing 767-300ER"], ["Boeing 767-400ER", "Boeing 767-400ER"],
  ["Boeing 777-200", "Boeing 777-200"], ["Boeing 777-200ER", "Boeing 777-200ER"], ["Boeing 777-200LR", "Boeing 777-200LR"], ["Boeing 777-300ER", "Boeing 777-300ER"], ["Boeing 777-300", "Boeing 777-300"], ["Boeing 777F", "Boeing 777F"], ["Boeing 777-200F", "Boeing 777F"], ["Boeing 777-9", "Boeing 777-9"],
  ["Boeing 787-8", "Boeing 787-8"], ["Boeing 787-8 Dreamliner", "Boeing 787-8"], ["Boeing 787-9", "Boeing 787-9"], ["Boeing 787-9 Dreamliner", "Boeing 787-9"], ["Boeing 787-10", "Boeing 787-10"], ["Boeing 787-10 Dreamliner", "Boeing 787-10"],
  ["Boeing 717-200", "Boeing 717-200"], ["Boeing 727-200", "Boeing 727-200"],
  ["Embraer 170", "Embraer E170"], ["Embraer E170", "Embraer E170"], ["Embraer ERJ-170", "Embraer E170"], ["Embraer 175", "Embraer E175"], ["Embraer E175", "Embraer E175"], ["Embraer ERJ-175", "Embraer E175"], ["Embraer ERJ 175", "Embraer E175"], ["Embraer 175 STD", "Embraer E175"],
  ["Embraer 190", "Embraer E190"], ["Embraer ERJ-190", "Embraer E190"], ["Embraer 195", "Embraer E195"], ["Embraer E190-E2", "Embraer E190-E2"], ["Embraer E195-E2", "Embraer E195-E2"],
  ["Embraer ERJ 145", "Embraer ERJ 145"], ["Embraer ERJ-145", "Embraer ERJ 145"], ["Embraer ERJ-135", "Embraer ERJ 135"], ["Embraer EMB 120 Brasilia", "Embraer EMB 120 Brasilia"],
  ["Bombardier CRJ200", "Bombardier CRJ-200"], ["Bombardier CRJ-200", "Bombardier CRJ-200"], ["Canadair CRJ-200", "Bombardier CRJ-200"], ["Canadair CL-600-2B19", "Bombardier CRJ-200"],
  ["Bombardier CRJ700", "Bombardier CRJ-700"], ["Canadair CRJ-700", "Bombardier CRJ-700"], ["Bombardier CRJ-701", "Bombardier CRJ-700"],
  ["Bombardier CRJ900", "Bombardier CRJ-900"], ["Canadair CRJ-900", "Bombardier CRJ-900"], ["Bombardier CRJ-900ER", "Bombardier CRJ-900"], ["Bombardier CRJ1000", "Bombardier CRJ-1000"],
  ["Bombardier Q400", "De Havilland Dash 8-400"], ["De Havilland Canada DHC-8-400 Dash 8", "De Havilland Dash 8-400"], ["De Havilland Canada DHC-8-402", "De Havilland Dash 8-400"], ["Bombardier Dash 8 Q400", "De Havilland Dash 8-400"], ["De Havilland Canada Dash 8-300", "De Havilland Dash 8-300"],
  ["ATR 72-600", "ATR 72-600"], ["ATR 72-212A", "ATR 72-600"], ["ATR 42-600", "ATR 42-600"], ["ATR 42-500", "ATR 42-500"], ["ATR 72-500", "ATR 72-500"],
  ["McDonnell Douglas MD-82", "McDonnell Douglas MD-80"], ["McDonnell Douglas MD-83", "McDonnell Douglas MD-80"], ["McDonnell Douglas MD-88", "McDonnell Douglas MD-80"], ["McDonnell Douglas MD-90", "McDonnell Douglas MD-90"], ["McDonnell Douglas MD-11", "McDonnell Douglas MD-11"],
  ["Saab 340", "Saab 340"], ["Fokker 100", "Fokker 100"], ["Sukhoi Superjet 100", "Sukhoi Superjet 100"], ["Comac C919", "Comac C919"],
  ["A320", "Airbus A320"], ["a321", "Airbus A321"], ["B738", "Boeing 737-800"], ["B38M", "Boeing 737 MAX 8"], ["A20N", "Airbus A320neo"], ["E75L", "Embraer E175"], ["CRJ9", "Bombardier CRJ-900"], ["B789", "Boeing 787-9"], ["A359", "Airbus A350-900"],
];
for (const [raw, want] of CASES) {
  if (!names.has(want)) { fail(`test case expects "${want}", which is not a picker option`); continue; }
  const got = canonicalAircraft(raw);
  if (got !== want) fail(`"${raw}" -> "${got}" (expected "${want}")`);
}

// 4. unknown types are kept as typed (never dropped), empty input stays empty
if (canonicalAircraft("Gulfstream G650") !== "Gulfstream G650") fail("unknown type should come back unchanged");
if (canonicalAircraft("") !== undefined || canonicalAircraft(undefined) !== undefined) fail("empty input should give undefined");

console.log(fails ? `\n${fails} check(s) failed` : `All aircraft checks passed (${AIRCRAFT_TYPES.length} options, ${CASES.length} lookup strings).`);
process.exit(fails ? 1 : 0);
