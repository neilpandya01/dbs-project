// Sanity-check the Supabase env vars WITHOUT ever printing a value.
// Run:  npm run check:supabase   (env files are loaded by node's --env-file flags, see package.json)
import { execFileSync } from "node:child_process";

const URL_VAR = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failed = true; console.log(`  ✗ ${m}`); };
const warn = (m) => console.log(`  ! ${m}`);

/** What kind of key is this, judged only from its shape? (never prints the key) */
function kind(key) {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.split(".").length === 3 && key.startsWith("eyJ")) {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
      return role === "service_role" ? "legacy-service-role" : role === "anon" ? "legacy-anon" : `legacy-${role}`;
    } catch {
      return "unreadable-jwt";
    }
  }
  return "unknown";
}

console.log("Supabase environment check (values are never printed)\n");

console.log("Variables");
if (!URL_VAR) bad("NEXT_PUBLIC_SUPABASE_URL is not set");
else if (/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(URL_VAR)) ok("NEXT_PUBLIC_SUPABASE_URL looks like a hosted project URL");
else if (/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(URL_VAR)) ok("NEXT_PUBLIC_SUPABASE_URL points at a local Supabase (supabase start)");
else bad("NEXT_PUBLIC_SUPABASE_URL doesn't look right (expected https://<20-letter-ref>.supabase.co, no path)");

const anonKind = kind(ANON);
if (anonKind === "missing") bad("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
else if (anonKind === "publishable") ok("anon var holds a publishable key (sb_publishable_…)");
else if (anonKind === "legacy-anon") ok("anon var holds a legacy anon key (eyJ…, role anon)");
else if (anonKind === "secret" || anonKind === "legacy-service-role")
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a SECRET/service-role key. It is shipped to every browser. Put the publishable/anon key here instead and rotate the leaked one.");
else bad(`NEXT_PUBLIC_SUPABASE_ANON_KEY has an unexpected format (${anonKind})`);

const svcKind = kind(SERVICE);
if (svcKind === "missing") warn("SUPABASE_SERVICE_ROLE_KEY not set (only needed later for background workers)");
else if (svcKind === "secret" || svcKind === "legacy-service-role") ok("service var holds a secret/service-role key (server-only)");
else if (svcKind === "publishable" || svcKind === "legacy-anon") bad("SUPABASE_SERVICE_ROLE_KEY holds the PUBLIC key; it should be the secret/service-role one");
else bad(`SUPABASE_SERVICE_ROLE_KEY has an unexpected format (${svcKind})`);

console.log("\nGit safety");
try {
  const tracked = execFileSync("git", ["ls-files", "--", ".env", ".env.local"], { encoding: "utf8" }).trim();
  if (tracked) bad(`a secrets file is TRACKED by git: ${tracked.split("\n").join(", ")}. Run: git rm --cached <file>`);
  else ok("no .env file is tracked by git");
} catch {
  warn("couldn't ask git (not a repo?)");
}

if (URL_VAR && ANON && anonKind !== "secret" && anonKind !== "legacy-service-role") {
  console.log("\nConnection");
  try {
    const res = await fetch(`${URL_VAR.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: ANON },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const s = await res.json().catch(() => ({}));
      ok(`reached the project and the key was accepted (HTTP ${res.status})`);
      if (s.external) {
        const on = Object.entries(s.external).filter(([, v]) => v === true).map(([k]) => k);
        console.log(`    sign-in methods enabled: ${on.length ? on.join(", ") : "none listed"}${s.disable_signup ? " (new sign-ups are disabled)" : ""}`);
      }
    } else if (res.status === 401 || res.status === 403)
      bad(`project reached, but the key was rejected (HTTP ${res.status}). Re-copy the anon/publishable key from Project Settings → API Keys.`);
    else if (res.status === 404)
      bad("HTTP 404: the URL doesn't match an active project. Check the project ref, and that the project isn't paused (free projects pause after inactivity).");
    else bad(`unexpected HTTP ${res.status} from the project`);
  } catch (e) {
    bad(`couldn't reach the project (${e.cause?.code ?? e.name}). Check the URL, your network, and whether the project is paused.`);
  }
}

// ---- Clerk -------------------------------------------------------------------------------------
const CLERK_PK = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CLERK_SK = process.env.CLERK_SECRET_KEY;
console.log("\nClerk");
const pkOk = !!CLERK_PK && /^pk_(test|live)_/.test(CLERK_PK);
const skOk = !!CLERK_SK && /^sk_(test|live)_/.test(CLERK_SK);
if (!CLERK_PK) bad("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
else if (!pkOk) bad("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY should start with pk_test_ or pk_live_");
else ok(`publishable key looks right (${CLERK_PK.startsWith("pk_live_") ? "production" : "development"} instance)`);
if (!CLERK_SK) bad("CLERK_SECRET_KEY is not set");
else if (!skOk) bad("CLERK_SECRET_KEY should start with sk_test_ or sk_live_");
else ok("secret key looks right");
if (pkOk && skOk && CLERK_PK.slice(3, 7) !== CLERK_SK.slice(3, 7)) bad("publishable key and secret key are from different modes (test vs live)");

if (skOk) {
  try {
    const res = await fetch("https://api.clerk.com/v1/users/count", {
      headers: { Authorization: `Bearer ${CLERK_SK}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) ok(`Clerk accepted the secret key (${(await res.json()).total_count ?? "?"} user(s) so far)`);
    else bad(`Clerk rejected the secret key (HTTP ${res.status}). Re-copy it from Clerk → API Keys.`);
  } catch (e) {
    bad(`couldn't reach Clerk (${e.cause?.code ?? e.name})`);
  }
}

console.log(failed ? "\nResult: needs attention (see ✗ above)" : "\nResult: env looks good ✓");
process.exit(failed ? 1 : 0);
