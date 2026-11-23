import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Clerk -> us. When someone deletes their account (in the app's account settings), Clerk sends a signed
 * "user.deleted" event here and we erase their data from Supabase, so the username is freed and the same
 * email can sign up fresh. The signature is checked with CLERK_WEBHOOK_SIGNING_SECRET, so only Clerk can
 * trigger this. Other event types are acknowledged and ignored.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    const { error } = await supabaseAdmin().rpc("delete_user_data", { p_user_id: evt.data.id });
    // a non-2xx makes Clerk retry later, so a temporary database problem doesn't leave data behind
    if (error) return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
