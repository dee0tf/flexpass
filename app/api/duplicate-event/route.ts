import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Fetch original event — must belong to this user
  const { data: original } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .single();

  if (!original) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Strip unique fields, create a copy
  const { id, created_at, ...rest } = original;
  void id; void created_at;

  const { data: copy, error } = await supabase
    .from("events")
    .insert({ ...rest, title: `${original.title} (Copy)`, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Duplicate ticket tiers if any
  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", eventId);

  if (tiers && tiers.length > 0) {
    const newTiers = tiers.map(({ id: _id, event_id: _eid, ...t }) => ({
      ...t,
      event_id: copy.id,
    }));
    await supabase.from("ticket_tiers").insert(newTiers);
  }

  return NextResponse.json({ newEventId: copy.id });
}
