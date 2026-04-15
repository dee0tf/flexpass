import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use Service Role to insert even if public (extra safety) or just use Anon
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
        }

        // 1. Save to Database
        const { error: dbError } = await supabase
            .from("newsletter_subscribers")
            .insert([{ email }]);

        if (dbError) {
            // Check for duplicate email (likely error code 23505)
            if (dbError.code === "23505") {
                return NextResponse.json({ message: "You are already subscribed!" }, { status: 200 });
            }
            throw dbError;
        }

        // 2. Send Welcome Email via Resend
        await resend.emails.send({
            from: 'FlexPass <hello@flexpasshq.com>',
            to: [email],
            subject: "You're on the list 🎟️",
            html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0812;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0812;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#120D1E;border-radius:16px;overflow:hidden;border:1px solid rgba(159,103,254,0.2);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#480082,#9F67FE);padding:40px 40px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">FlexPass</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Your all-access pass to Nigeria's hottest events</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#fff;font-size:22px;margin:0 0 12px;">You're in the inner circle 🎉</h2>
            <p style="color:rgba(240,238,248,0.7);font-size:15px;line-height:1.7;margin:0 0 24px;">
              Thanks for subscribing to FlexPass. You'll be the first to know about:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ["🔥", "The hottest concerts and events in Lagos"],
                ["🎫", "Early bird ticket access before anyone else"],
                ["🎁", "Exclusive discounts and giveaways"],
                ["📍", "New events dropping near you"],
              ].map(([icon, text]) => `
              <tr>
                <td width="36" style="vertical-align:top;padding-bottom:14px;font-size:18px;">${icon}</td>
                <td style="color:rgba(240,238,248,0.75);font-size:14px;padding-bottom:14px;line-height:1.5;">${text}</td>
              </tr>`).join("")}
            </table>
            <div style="margin:32px 0;text-align:center;">
              <a href="https://flexpasshq.com/events" style="display:inline-block;background:linear-gradient(135deg,#480082,#9F67FE);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
                Browse Events Now
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(240,238,248,0.3);font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} FlexPass &middot; Lagos, Nigeria<br/>
              <a href="https://flexpasshq.com/unsubscribe?email=${encodeURIComponent(email)}" style="color:rgba(159,103,254,0.5);text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });

        return NextResponse.json({ message: "Subscribed successfully! Check your inbox." });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
