import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function sanitize(s: string) {
  return String(s).replace(/[<>"']/g, "").slice(0, 2000);
}

export async function POST(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { eventId?: string; subject?: string; message?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, subject, message } = body;
  if (!eventId || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "eventId, subject and message are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the token belongs to the event owner
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event } = await supabase
    .from("events").select("title, user_id, date, location").eq("id", eventId).single();
  if (!event || event.user_id !== user.id)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: tickets } = await supabase
    .from("tickets")
    .select("user_email, user_name, tier_name")
    .eq("event_id", eventId)
    .eq("status", "valid");

  if (!tickets || tickets.length === 0)
    return NextResponse.json({ error: "No attendees for this event yet" }, { status: 400 });

  const uniqueEmails = [...new Set(tickets.map((t) => t.user_email as string))];
  const safeSubject = sanitize(subject);
  const safeMessage = sanitize(message).replace(/\n/g, "<br>");
  const eventDate = new Date(event.date).toLocaleDateString("en-NG", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:580px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#480082,#9F67FE);padding:28px 32px}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .header p{color:rgba(255,255,255,.7);margin:6px 0 0;font-size:14px}
  .body{padding:32px}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9F67FE;font-weight:600;margin-bottom:4px}
  .message{background:#f9f8ff;border-left:3px solid #9F67FE;padding:16px 18px;border-radius:0 8px 8px 0;font-size:15px;line-height:1.65;color:#1a1a2e}
  .meta{margin-top:24px;display:flex;gap:16px;flex-wrap:wrap}
  .meta-item{font-size:13px;color:#666;background:#f4f4f4;padding:8px 14px;border-radius:20px}
  .footer{padding:20px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Message from your event organiser</h1>
    <p>${sanitize(event.title)}</p>
  </div>
  <div class="body">
    <div class="label">Message</div>
    <div class="message">${safeMessage}</div>
    <div class="meta">
      <span class="meta-item">📅 ${eventDate}</span>
      <span class="meta-item">📍 ${sanitize(event.location)}</span>
    </div>
  </div>
  <div class="footer">
    You received this because you have a ticket for <strong>${sanitize(event.title)}</strong> on FlexPass.<br>
    <a href="https://www.flexpasshq.com" style="color:#480082">www.flexpasshq.com</a>
  </div>
</div>
</body></html>`;

  let sent = 0;
  const failed: string[] = [];

  // Send in batches of 8 to stay within rate limits
  for (let i = 0; i < uniqueEmails.length; i += 8) {
    const batch = uniqueEmails.slice(i, i + 8);
    await Promise.all(
      batch.map(async (email) => {
        try {
          await resend.emails.send({
            from: "FlexPass <tickets@flexpasshq.com>",
            to: [email],
            subject: `${sanitize(event.title)}: ${safeSubject}`,
            html,
          });
          sent++;
        } catch {
          failed.push(email);
        }
      })
    );
  }

  return NextResponse.json({ sent, failed: failed.length, total: uniqueEmails.length });
}
