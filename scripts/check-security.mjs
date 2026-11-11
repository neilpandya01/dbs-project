// Cross-user security test. Creates two TEMPORARY users in Clerk, signs each into Supabase with a real
// Clerk token, then tries to read / change / impersonate the other. Cleans up after itself.
// Never prints a key or token.   Run:  npm run check:security
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SK = process.env.CLERK_SECRET_KEY;
if (!SB_URL || !ANON || !SVC || !CLERK_SK) {
  console.log("Missing Supabase/Clerk variables. Run `npm run check:supabase` first.");
  process.exit(2);
}

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.log(`  ✗ ${m}`); };
const info = (m) => console.log(`  · ${m}`);
const check = (cond, good, bad) => (cond ? pass(good) : fail(bad));

const clerk = async (path, method = "GET", body) => {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${CLERK_SK}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`clerk ${method} ${path} -> ${res.status}`);
  return json;
};

const admin = createClient(SB_URL, SVC, { auth: { persistSession: false } });
const asUser = (jwt) => createClient(SB_URL, ANON, { accessToken: async () => jwt, auth: { persistSession: false } });
const anon = createClient(SB_URL, ANON, { auth: { persistSession: false } });
const claimsOf = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

const tag = Math.random().toString(36).slice(2, 7);
const made = [];

async function makeUser(label) {
  const username = `e2e_sec_${label}_${tag}`;
  const u = await clerk("/users", "POST", {
    username,
    first_name: label.toUpperCase(),
    last_name: "Tester",
    email_address: [`${username}@example.com`],
    password: `Wm-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}!`,
    skip_password_checks: true,
  });
  made.push(u.id);
  const session = await clerk("/sessions", "POST", { user_id: u.id });
  const { jwt } = await clerk(`/sessions/${session.id}/tokens`, "POST");
  return { id: u.id, username, jwt, claims: claimsOf(jwt), db: asUser(jwt) };
}

function scanBundle(dir, needles) {
  const hits = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|css|html|json|map|txt)$/.test(name)) {
        const text = readFileSync(p, "utf8");
        for (const [label, n] of needles) if (n instanceof RegExp ? n.test(text) : n && text.includes(n)) hits.push(`${label} in ${p}`);
      }
    }
  };
  walk(dir);
  return hits;
}

console.log("Wingmates security check (no keys or tokens are printed)\n");

try {
  console.log("Secrets in the built app");
  const staticDir = join(process.cwd(), ".next", "static");
  if (existsSync(staticDir)) {
    const hits = scanBundle(staticDir, [
      ["Supabase secret/service key", SVC],
      ["Clerk secret key", CLERK_SK],
      ["a key-shaped Supabase secret (sb_secret_…)", /sb_secret_[A-Za-z0-9_-]{20,}/],
      ["a key-shaped Clerk secret (sk_test_/sk_live_…)", /sk_(test|live)_[A-Za-z0-9]{20,}/],
    ]);
    check(hits.length === 0, "no secret keys appear in the files sent to browsers (.next/static)", `LEAK: ${hits.join("; ")}`);
  } else info("no build found; run `npm run build` first to scan the browser bundle");

  // ---- 0. is the database set up? -----------------------------------------------------------
  const probe = await admin.from("profiles").select("user_id", { head: true, count: "exact" });
  if (probe.error) {
    console.log("The `profiles` table doesn't exist yet. Run supabase/migrations/*.sql in the Supabase SQL Editor, then re-run this.");
    process.exit(2);
  }

  console.log("\nSetup");
  const A = await makeUser("a");
  const B = await makeUser("b");
  pass("created two temporary users and signed both in");
  const hasRole = A.claims.role === "authenticated";
  const hasUsername = typeof A.claims.username === "string" && A.claims.username.length > 0;
  check(hasRole, "Clerk token carries role=authenticated (Supabase integration is active)", "token has no role=authenticated: activate Clerk's Supabase integration");
  check(hasUsername, "Clerk token carries the username claim", "token has NO username claim: add {\"username\": \"{{user.username}}\"} in Clerk → Sessions → Customize session token");

  // seed both rows server-side so the isolation tests don't depend on the client insert path
  await admin.from("profiles").delete().in("user_id", [A.id, B.id]);
  const seed = await admin.from("profiles").insert([
    { user_id: A.id, username: A.username, display_name: "Alice (private)", bio: "A's private bio", home_city: "A-Town" },
    { user_id: B.id, username: B.username, display_name: "Bob (private)", bio: "B's private bio", home_city: "B-Town" },
  ]);
  if (seed.error) throw new Error("seeding failed: " + seed.error.message);

  console.log("\nReading other people's data");
  const own = await A.db.from("profiles").select("*");
  check(!own.error && own.data.length === 1 && own.data[0].user_id === A.id, "A sees exactly one profile row: their own", `A sees ${own.data?.length ?? "?"} rows (${own.error?.message ?? ""})`);
  const peek = await A.db.from("profiles").select("*").eq("user_id", B.id);
  check(!peek.error && peek.data.length === 0, "A cannot read B's row by asking for it directly", "A could read B's row!");
  const peekBio = await A.db.from("profiles").select("bio, home_city").eq("username", B.username);
  check(!peekBio.error && peekBio.data.length === 0, "A cannot read B's bio or home city by searching their username", "A could read B's private fields!");

  console.log("\nChanging other people's data");
  const upd = await A.db.from("profiles").update({ display_name: "HACKED", bio: "HACKED" }).eq("user_id", B.id).select();
  const afterUpd = await admin.from("profiles").select("display_name, bio").eq("user_id", B.id).single();
  check(afterUpd.data?.display_name === "Bob (private)" && afterUpd.data?.bio === "B's private bio" && !(upd.data?.length), "A cannot edit B's profile", "A changed B's profile!");
  const steal = await A.db.from("profiles").update({ user_id: B.id }).eq("user_id", A.id).select();
  const stillA = await admin.from("profiles").select("user_id").eq("user_id", A.id);
  check(!!steal.error || !steal.data?.length, "A cannot re-point their own row at B's id", "A re-pointed a row!");
  check(stillA.data?.length === 1, "A's row is intact after that attempt", "A's row went missing");
  const del = await A.db.from("profiles").delete().eq("user_id", B.id).select();
  const bStill = await admin.from("profiles").select("user_id").eq("user_id", B.id);
  check(bStill.data?.length === 1 && !del.data?.length, "A cannot delete B's profile", "A deleted B's profile!");

  console.log("\nImpersonation");
  const fake = await A.db.from("profiles").insert({ user_id: `user_victim_${tag}`, username: `victim_${tag}`, display_name: "Fake" });
  check(!!fake.error, "A cannot create a row owned by someone else's id", "A created a row for another id!");
  if (hasUsername) {
    const take = await A.db.from("profiles").update({ username: B.username }).eq("user_id", A.id).select("username");
    const nowA = await admin.from("profiles").select("username").eq("user_id", A.id).single();
    check(nowA.data?.username === A.username, "A cannot take B's username (the database uses the one in A's token)", `A's username became ${nowA.data?.username}`);
    void take;
  } else info("skipped the username-impersonation test (token has no username claim yet)");

  console.log("\nFinding people (friend search)");
  const look = await A.db.rpc("lookup_profile", { p_username: B.username });
  check(!look.error && look.data?.length === 1 && Object.keys(look.data[0]).sort().join() === "display_name,user_id,username", "A can find B by exact username, and only gets id + username + display name", `lookup returned ${JSON.stringify(look.data ? Object.keys(look.data[0] ?? {}) : look.error?.message)}`);
  const partial = await A.db.rpc("lookup_profile", { p_username: `e2e_sec_b` });
  check(!partial.error && partial.data?.length === 0, "a partial name finds nobody (no browsing or scraping the user list)", "partial search returned users");

  console.log("\nSigned-out visitors");
  const aProfiles = await anon.from("profiles").select("*");
  check(!!aProfiles.error || aProfiles.data?.length === 0, "signed-out visitor sees no profiles", "signed-out visitor could read profiles!");
  const aLook = await anon.rpc("lookup_profile", { p_username: B.username });
  check(!!aLook.error, "signed-out visitor cannot use friend lookup", "signed-out visitor could use lookup!");
  const aIns = await anon.from("profiles").insert({ user_id: `user_anon_${tag}`, username: `anon_${tag}` });
  check(!!aIns.error, "signed-out visitor cannot create profiles", "signed-out visitor created a row!");


  // =============================================================================================
  // Core tables: flights, friendships, tracked flights, reports, news, airports
  // =============================================================================================
  const core = await admin.from("flights").select("id").limit(1);
  if (core.error) {
    console.log("\nThe core tables don't exist yet. Run supabase/migrations/20261113000000_core_tables.sql in the SQL Editor, then re-run this.");
    throw new Error("core tables missing");
  }
  // flights need two real airports; make sure two exist (the full list comes from `npm run import:airports`)
  await admin.from("airports").upsert([
    { code: "ORD", name: "Chicago O'Hare International Airport", city: "Chicago", country: "United States", country_code: "US", continent: "North America", lat: 41.9742, lon: -87.9048, kind: "large" },
    { code: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "United States", country_code: "US", continent: "North America", lat: 33.9425, lon: -118.4081, kind: "large" },
  ], { onConflict: "code", ignoreDuplicates: true });

  const C = await makeUser("c");
  const D = await makeUser("d");
  pass("created two more temporary users (C: a stranger, D: a spare)");
  await admin.from("profiles").upsert([
    { user_id: C.id, username: C.username, display_name: "Carol" },
    { user_id: D.id, username: D.username, display_name: "Dave" },
  ]);
  const aFlight = { flown_on: "2026-01-10", from_airport: "ORD", to_airport: "LAX", flight_number: "UA 1" };

  console.log("\nFlights: strangers see nothing");
  const a1 = await A.db.from("flights").insert({ ...aFlight }).select().single();
  const a2 = await A.db.from("flights").insert({ ...aFlight, flight_number: "UA 2", hidden: true }).select().single();
  const b1 = await B.db.from("flights").insert({ ...aFlight, flight_number: "BB 1" }).select().single();
  check(!a1.error && !a2.error && !b1.error, "A and B can each add their own flights", `inserts failed: ${a1.error?.message ?? a2.error?.message ?? b1.error?.message}`);
  const bSeesA = await B.db.from("flights").select("*").eq("user_id", A.id);
  check(!bSeesA.error && bSeesA.data.length === 0, "B (not A's friend) sees none of A's flights", `B saw ${bSeesA.data?.length} of A's flights!`);
  const cAll = await C.db.from("flights").select("*");
  check(!cAll.error && cAll.data.length === 0, "C (a stranger) sees no flights at all", `C saw ${cAll.data?.length} flights!`);
  const aAll = await A.db.from("flights").select("*");
  check(!aAll.error && aAll.data.length === 2 && aAll.data.every((f) => f.user_id === A.id), "A sees only their own 2 flights", `A saw ${aAll.data?.length}`);

  console.log("\nFlights: nobody can change someone else's");
  const updB = await A.db.from("flights").update({ flight_number: "HACK" }).eq("id", b1.data.id).select();
  const delB = await A.db.from("flights").delete().eq("id", b1.data.id).select();
  const stillB = await admin.from("flights").select("flight_number").eq("id", b1.data.id).single();
  check(!updB.data?.length && !delB.data?.length && stillB.data?.flight_number === "BB 1", "A cannot edit or delete B's flight", "A changed B's flight!");
  const spoof = await A.db.from("flights").insert({ ...aFlight, user_id: B.id });
  check(!!spoof.error, "A cannot add a flight in B's name", "A added a flight for B!");
  const stealFlight = await A.db.from("flights").update({ user_id: B.id }).eq("id", a1.data.id).select();
  check(!!stealFlight.error || !stealFlight.data?.length, "A cannot hand their flight to B", "A re-owned a flight!");
  const same = await A.db.from("flights").insert({ ...aFlight, to_airport: "ORD" });
  check(!!same.error, "a flight from an airport to itself is rejected", "same-airport flight accepted");

  console.log("\nFriend requests");
  const sendSelf = await A.db.rpc("send_friend_request", { p_username: A.username });
  check(!!sendSelf.error, "you cannot friend yourself", "self-request accepted");
  const sendGhost = await A.db.rpc("send_friend_request", { p_username: `nobody_${tag}` });
  check(!!sendGhost.error, "requesting an unknown username fails cleanly", "unknown user accepted");
  const direct = await A.db.from("friendships").insert({ requester: A.id, addressee: B.id, status: "accepted" });
  check(!!direct.error, "A cannot write the friendships table directly (e.g. forge an accepted friendship)", "direct friendship insert worked!");
  const req = await A.db.rpc("send_friend_request", { p_username: B.username });
  check(!req.error && typeof req.data === "string", "A can send B a request", `request failed: ${req.error?.message}`);
  const dup = await A.db.rpc("send_friend_request", { p_username: B.username });
  check(!!dup.error, "a second request to the same person is refused", "duplicate request accepted");
  const bInbox = await B.db.rpc("friend_summaries");
  const inc = bInbox.data?.find((x) => x.other_user_id === A.id);
  check(inc?.direction === "incoming" && inc?.status === "pending" && !("bio" in inc), "B sees A's request with safe fields only (no bio / home city)", `unexpected summary: ${JSON.stringify(inc && Object.keys(inc))}`);
  const selfAccept = await A.db.rpc("respond_friend_request", { p_id: req.data, p_accept: true });
  check(!!selfAccept.error, "A cannot accept their own request", "requester accepted their own request!");
  const cAccept = await C.db.rpc("respond_friend_request", { p_id: req.data, p_accept: true });
  check(!!cAccept.error, "C (a stranger) cannot accept it either", "stranger accepted someone else's request!");
  const pendingFlights = await B.db.from("flights").select("*").eq("user_id", A.id);
  const pendingProfile = await B.db.from("profiles").select("*").eq("user_id", A.id);
  check(pendingFlights.data?.length === 0 && pendingProfile.data?.length === 0, "a PENDING request gives B no access to A's flights or profile", "pending request leaked data!");

  console.log("\nFriends can see each other, strangers still can't");
  const acc = await B.db.rpc("respond_friend_request", { p_id: req.data, p_accept: true });
  check(!acc.error, "B accepts", `accept failed: ${acc.error?.message}`);
  const bFlights = await B.db.from("flights").select("*").eq("user_id", A.id);
  check(!bFlights.error && bFlights.data.length === 1 && bFlights.data[0].flight_number === "UA 1", "B now sees A's visible flight, but NOT the one A hid", `B saw ${bFlights.data?.map((f) => f.flight_number)}`);
  const bProfile = await B.db.from("profiles").select("bio, home_city").eq("user_id", A.id);
  check(bProfile.data?.length === 1 && bProfile.data[0].bio === "A's private bio", "B can now read A's profile (friends share it)", "friend couldn't read profile");
  const aSeesB = await A.db.from("flights").select("*").eq("user_id", B.id);
  check(aSeesB.data?.length === 1, "and it works both ways (A sees B's flight)", `A saw ${aSeesB.data?.length}`);
  const cFlights = await C.db.from("flights").select("*").in("user_id", [A.id, B.id]);
  const cProfiles = await C.db.from("profiles").select("*").in("user_id", [A.id, B.id]);
  check(cFlights.data?.length === 0 && cProfiles.data?.length === 0, "C, who is nobody's friend, still sees nothing", "stranger saw friends' data!");
  const friendEdit = await B.db.from("flights").update({ flight_number: "HACK" }).eq("user_id", A.id).select();
  check(!friendEdit.data?.length, "being friends does NOT let B edit A's flights", "friend edited a flight!");
  const aSum = await A.db.rpc("friend_summaries");
  const fresh = aSum.data?.find((x) => x.other_user_id === B.id);
  check(fresh?.status === "accepted" && fresh?.requester_seen === false, "A is told B accepted (the red-dot flag is set)", `flag was ${fresh?.requester_seen}`);
  await A.db.rpc("mark_friend_accepts_seen");
  const aSum2 = await A.db.rpc("friend_summaries");
  check(aSum2.data?.find((x) => x.other_user_id === B.id)?.requester_seen === true, "and opening Friends clears the flag", "flag not cleared");

  console.log("\nUnfriending");
  const unf = await B.db.rpc("remove_friendship", { p_id: req.data });
  const afterUnf = await B.db.from("flights").select("*").eq("user_id", A.id);
  check(!unf.error && afterUnf.data?.length === 0, "after B removes the friendship, B can no longer see A's flights", "access survived unfriending!");
  const cRemove = await C.db.rpc("remove_friendship", { p_id: req.data });
  void cRemove;

  console.log("\nTracked flights (stars)");
  const star = await A.db.from("tracked_flights").insert({ flight_id: a1.data.id });
  check(!star.error, "A can star a flight", `star failed: ${star.error?.message}`);
  const bStars = await B.db.from("tracked_flights").select("*");
  check(bStars.data?.length === 0, "B cannot see A's stars", "stars leaked!");
  const bUnstar = await B.db.from("tracked_flights").delete().eq("flight_id", a1.data.id).select();
  const starStill = await admin.from("tracked_flights").select("flight_id").eq("user_id", A.id);
  check(!bUnstar.data?.length && starStill.data?.length === 1, "B cannot remove A's star", "B removed A's star");

  console.log("\nReports (News tab)");
  const rep = await A.db.from("reports").insert({ title: "Test report", body: "hello", airport: "ORD", author_username: "somebody_else" }).select().single();
  check(!rep.error && rep.data?.author_username === A.username, "A posts a report; the author name comes from A's token, not from what the browser sent", `author was ${rep.data?.author_username} (${rep.error?.message ?? ""})`);
  const bRead = await B.db.from("reports").select("*").eq("id", rep.data?.id);
  check(bRead.data?.length === 1, "everyone signed in can read the community feed", "report not readable");
  const bDel = await B.db.from("reports").delete().eq("id", rep.data?.id).select();
  check(!bDel.data?.length, "B cannot delete A's report", "B deleted A's report!");
  const bEdit = await B.db.from("reports").update({ title: "HACK" }).eq("id", rep.data?.id).select();
  check(!!bEdit.error || !bEdit.data?.length, "nobody can edit a posted report", "report was edited!");
  const v1 = await B.db.from("report_votes").insert({ report_id: rep.data?.id });
  const v2 = await B.db.from("report_votes").insert({ report_id: rep.data?.id });
  const afterVote = await B.db.from("reports").select("helpful").eq("id", rep.data?.id).single();
  check(!v1.error && !!v2.error && afterVote.data?.helpful === 1, "B can mark it helpful once (a second vote is refused, count is 1)", `helpful=${afterVote.data?.helpful}, second vote error=${!!v2.error}`);
  const fakeVote = await C.db.from("report_votes").insert({ report_id: rep.data?.id, user_id: B.id });
  check(!!fakeVote.error, "C cannot vote in B's name", "voted as someone else!");
  await B.db.rpc("flag_report", { p_id: rep.data?.id });
  await C.db.rpc("flag_report", { p_id: rep.data?.id });
  await D.db.rpc("flag_report", { p_id: rep.data?.id });
  const hiddenFromB = await B.db.from("reports").select("id").eq("id", rep.data?.id);
  const authorStill = await A.db.from("reports").select("id").eq("id", rep.data?.id);
  check(hiddenFromB.data?.length === 0 && authorStill.data?.length === 1, "after 3 different people flag it, others stop seeing it (the author still does)", `visible to B: ${hiddenFromB.data?.length}, to author: ${authorStill.data?.length}`);
  const anonRep = await anon.from("reports").select("*");
  check(!!anonRep.error || anonRep.data?.length === 0, "signed-out visitors cannot read reports", "reports public!");

  console.log("\nNews feed and airports are read-only");
  const seedNews = await admin.from("news_items").insert({ kind: "headline", title: `Test ${tag}`, source: "test" }).select().single();
  const readNews = await A.db.from("news_items").select("id").eq("id", seedNews.data?.id);
  check(readNews.data?.length === 1, "signed-in users can read news items", "news not readable");
  const writeNews = await A.db.from("news_items").insert({ kind: "headline", title: "FAKE", source: "x" });
  const editNews = await A.db.from("news_items").update({ title: "FAKE" }).eq("id", seedNews.data?.id).select();
  check(!!writeNews.error && !editNews.data?.length, "but nobody can post or edit news from the app (only the background workers can)", "news writable by users!");
  await admin.from("news_items").delete().eq("id", seedNews.data?.id);
  const apt = await A.db.from("airports").select("code").eq("code", "ORD");
  const aptWrite = await A.db.from("airports").update({ name: "HACK" }).eq("code", "ORD").select();
  check(apt.data?.length === 1 && !aptWrite.data?.length, "airports are readable but not editable", "airports editable!");
  const anonApt = await anon.from("airports").select("*").limit(1);
  check(!!anonApt.error || anonApt.data?.length === 0, "signed-out visitors cannot read airports", "airports public");
} catch (e) {
  fail(`test could not finish: ${e.message}`);
} finally {
  // ---- cleanup ------------------------------------------------------------------------------
  try {
    if (made.length) {
      await admin.from("reports").delete().in("user_id", made);
      await admin.from("flights").delete().in("user_id", made);
      await admin.from("friendships").delete().or(made.map((id) => `requester.eq.${id}`).join(",") + "," + made.map((id) => `addressee.eq.${id}`).join(","));
      await admin.from("profiles").delete().in("user_id", made);
    }
    await admin.from("profiles").delete().like("user_id", "user_victim_%");
    for (const id of made) await clerk(`/users/${id}`, "DELETE").catch(() => {});
    if (made.length) console.log("\nCleanup: temporary users and rows removed");
  } catch (e) {
    console.log(`\nCleanup problem: ${e.message}`);
  }
}

console.log(failures ? `\nResult: ${failures} problem(s) ✗` : "\nResult: all checks passed ✓");
process.exit(failures ? 1 : 0);
