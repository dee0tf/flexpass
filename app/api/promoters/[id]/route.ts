import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DELETE /api/promoters/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Only allow deleting own promoters
  const { data: promoter } = await db
    .from("event_promoters")
    .select("id, host_user_id")
    .eq("id", id)
    .single();

  if (!promoter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (promoter.host_user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.from("event_promoters").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}