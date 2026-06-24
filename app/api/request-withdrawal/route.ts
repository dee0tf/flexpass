import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount } = await request.json();
    if (!amount || typeof amount !== "number" || amount < 1000) {
      return NextResponse.json({ error: "Minimum withdrawal is ₦1,000" }, { status: 400 });
    }

    // Look up bank details
    const { data: bank } = await db
      .from("bank_accounts")
      .select("bank_name, account_number, account_name")
      .eq("user_id", user.id)
      .single();

    if (!bank) return NextResponse.json({ error: "No bank account saved. Please add your bank details first." }, { status: 400 });

    // Insert payout
    const { error: insertError } = await db.from("payouts").insert({
      user_id: user.id,
      amount,
      status: "pending",
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Fire notification email (non-blocking — don't fail the request if email fails)
    const now = new Date().toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    resend.emails.send({
      from: "FlexPass <tickets@flexpasshq.com>",
      to: ["flexpasshome@gmail.com"],
      subject: `💸 New Withdrawal Request — ₦${amount.toLocaleString()}`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0812;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0812;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#120D1E;border-radius:16px;overflow:hidden;border:1px solid rgba(159,103,254,0.2);">
        <tr>
          <td style="background:linear-gradient(135deg,#480082,#9F67FE);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">FlexPass Admin</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">New Withdrawal Request</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#fff;font-size:22px;margin:0 0 24px;">₦${amount.toLocaleString()} <span style="color:#9F67FE;">withdrawal requested</span></h2>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(72,0,130,0.18);border:1px solid rgba(159,103,254,0.25);border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(159,103,254,0.15);">
                  <p style="margin:0;color:rgba(240,238,248,0.45);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Creator</p>
                  <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${user.email}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(159,103,254,0.15);">
                  <p style="margin:0;color:rgba(240,238,248,0.45);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Amount</p>
                  <p style="margin:4px 0 0;color:#FFB700;font-size:20px;font-weight:800;">₦${amount.toLocaleString()}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(159,103,254,0.15);">
                  <p style="margin:0;color:rgba(240,238,248,0.45);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Bank</p>
                  <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${bank.bank_name}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(159,103,254,0.15);">
                  <p style="margin:0;color:rgba(240,238,248,0.45);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Account Number</p>
                  <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:700;letter-spacing:2px;">${bank.account_number}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0;color:rgba(240,238,248,0.45);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Account Name</p>
                  <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${bank.account_name}</p>
                </td>
              </tr>
            </table>

            <p style="color:rgba(240,238,248,0.4);font-size:12px;margin:0 0 24px;">Submitted: ${now} (WAT)</p>

            <div style="text-align:center;">
              <a href="https://flexpasshq.com/admin" style="display:inline-block;background:linear-gradient(135deg,#480082,#9F67FE);color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px;">
                Review in Admin Panel →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(240,238,248,0.25);font-size:12px;margin:0;">FlexPass &middot; Admin Notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => { /* don't fail the request if email errors */ });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
