import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function GET(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: requests, error } = await db
    .from("delete_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve user emails via admin API (service role bypasses RLS on auth.users)
  const userIds = [...new Set((requests || []).map((r: any) => r.user_id as string))];
  const emailMap = new Map<string, string>();

  await Promise.all(
    userIds.map(async (uid) => {
      const { data: { user } } = await db.auth.admin.getUserById(uid);
      if (user?.email) emailMap.set(uid, user.email);
    })
  );

  const enriched = (requests || []).map((r: any) => ({
    ...r,
    user_email: emailMap.get(r.user_id) || `${r.user_id.slice(0, 8)}…`,
  }));

  return NextResponse.json({ requests: enriched });
}
