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

  const { data: payouts, error } = await db
    .from("payouts")
    .select("*, bank_accounts(bank_name, account_number, account_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve host emails via admin API
  const userIds = [...new Set((payouts || []).map((p: any) => p.user_id as string))];
  const emailMap = new Map<string, string>();

  await Promise.all(
    userIds.map(async (uid) => {
      const { data: { user } } = await db.auth.admin.getUserById(uid);
      if (user?.email) emailMap.set(uid, user.email);
    })
  );

  const enriched = (payouts || []).map((p: any) => ({
    ...p,
    user_email: emailMap.get(p.user_id) || `${p.user_id.slice(0, 8)}…`,
  }));

  return NextResponse.json({ payouts: enriched });
}
