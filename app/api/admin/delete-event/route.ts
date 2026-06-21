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

  // Save the request record upfront — needed if cascade deletion removes it when we delete the event
  const { data: reqRecord } = await db
    .from("delete_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (action === "approve") {
    if (!eventId) {
      return NextResponse.json({ error: "eventId required for approval" }, { status: 400 });
    }

    // Break potential CASCADE DELETE: null the event_id FK before deleting the event.
    // If event_id is nullable this prevents the delete_request row from being cascade-deleted.
    // If event_id is NOT NULL this silently fails — handled via re-insert below.
    await db.from("delete_requests").update({ event_id: null }).eq("id", requestId);

    // Delete related tickets first (foreign key constraint)
    const { error: ticketErr } = await db
      .from("tickets")
      .delete()
      .eq("event_id", eventId);

    if (ticketErr) {
      console.error("[delete-event] ticket delete error:", ticketErr);
      return NextResponse.json({ error: "Failed to delete tickets: " + ticketErr.message }, { status: 500 });
    }

    // Delete the event
    const { error: eventErr } = await db
      .from("events")
      .delete()
      .eq("id", eventId);

    if (eventErr) {
      console.error("[delete-event] event delete error:", eventErr);
      return NextResponse.json({ error: "Failed to delete event: " + eventErr.message }, { status: 500 });
    }
  }

  // Update the request status
  const newStatus = action === "approve" ? "approved" : "denied";
  const { data: updateResult, error: updateErr } = await db
    .from("delete_requests")
    .update({ status: newStatus })
    .eq("id", requestId)
    .select("id");

  if (updateErr) {
    // Log but don't fail — the event was already successfully deleted
    console.error("[delete-event] request update error:", updateErr);
  }

  // If update matched 0 rows the record was cascade-deleted when we deleted the event.
  // Re-insert it as an audit record so it appears in the Deleted tab.
  const wasDeleted = Array.isArray(updateResult) && updateResult.length === 0;
  if (action === "approve" && wasDeleted && reqRecord) {
    console.log("[delete-event] Cascade deleted the request record — re-inserting audit record");

    // Try with event_id = null (breaks the FK so insert succeeds even though event is gone)
    const { error: insertErr } = await db.from("delete_requests").insert({
      id: reqRecord.id,
      user_id: reqRecord.user_id,
      event_id: null,
      event_title: reqRecord.event_title,
      reason: reqRecord.reason,
      status: "approved",
      created_at: reqRecord.created_at,
    });

    if (insertErr) {
      // event_id is NOT NULL — insert without it
      console.error("[delete-event] null event_id insert failed:", insertErr.message);
      await db.from("delete_requests").insert({
        user_id: reqRecord.user_id,
        event_title: reqRecord.event_title,
        reason: reqRecord.reason,
        status: "approved",
        created_at: reqRecord.created_at,
      }).catch((e: any) => console.error("[delete-event] fallback insert also failed:", e));
    }
  }

  return NextResponse.json({
    success: true,
    message: action === "approve"
      ? "Event and all its tickets deleted successfully."
      : "Delete request denied.",
  });
}
