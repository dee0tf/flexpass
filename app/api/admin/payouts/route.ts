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
    .select("id, amount, status, created_at, transfer_code, user_id")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((payouts || []).map((p: any) => p.user_id as string).filter(Boolean))];

  // Resolve emails and bank accounts in parallel, keyed by user_id
  const emailMap = new Map<string, string>();
  const bankMap = new Map<string, { bank_name: string; account_number: string; account_name: string } | null>();

  await Promise.all([
    ...userIds.map(async (uid) => {
      try {
        const { data: { user } } = await db.auth.admin.getUserById(uid);
        if (user?.email) emailMap.set(uid, user.email);
      } catch { /* skip */ }
    }),
    db.from("bank_accounts")
      .select("user_id, bank_name, account_number, account_name")
      .in("user_id", userIds.length > 0 ? userIds : ["__none__"])
      .then(({ data }) => {
        for (const b of data || []) {
          bankMap.set(b.user_id, { bank_name: b.bank_name, account_number: b.account_number, account_name: b.account_name });
        }
      }),
  ]);

  const enriched = (payouts || []).map((p: any) => ({
    ...p,
    user_email:   emailMap.get(p.user_id) || `${String(p.user_id).slice(0, 8)}…`,
    bank_accounts: bankMap.get(p.user_id) || null,
  }));

  return NextResponse.json({ payouts: enriched });
}
