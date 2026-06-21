import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Service role bypasses RLS — required to delete any event regardless of owner
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyAdmin(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function POST(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, eventId, action } = await request.json();

  if (!requestId || !action || !["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
  }

  if (action === "approve") {
    if (!eventId) {
      return NextResponse.json({ error: "eventId required for approval" }, { status: 400 });
    }

    // Delete related tickets first (foreign key constraint), then the event
    const { error: ticketErr } = await db
      .from("tickets")
      .delete()
      .eq("event_id", eventId);

    if (ticketErr) {
      console.error("[delete-event] ticket delete error:", ticketErr);
      return NextResponse.json({ error: "Failed to delete tickets: " + ticketErr.message }, { status: 500 });
    }

    const { error: eventErr } = await db
      .from("events")
      .delete()
      .eq("id", eventId);

    if (eventErr) {
      console.error("[delete-event] event delete error:", eventErr);
      return NextResponse.json({ error: "Failed to delete event: " + eventErr.message }, { status: 500 });
    }
  }

  // Update the request status (only columns that exist in the schema)
  const newStatus = action === "approve" ? "approved" : "denied";
  const { error: updateErr } = await db
    .from("delete_requests")
    .update({ status: newStatus })
    .eq("id", requestId);

  if (updateErr) {
    console.error("[delete-event] request update error:", updateErr);
    return NextResponse.json({ error: "Failed to update request: " + updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: action === "approve"
      ? "Event and all its tickets deleted successfully."
      : "Delete request denied.",
  });
}
