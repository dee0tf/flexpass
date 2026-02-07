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
            from: 'FlexPass Team <hello@resend.dev>', // Update this if you have a custom domain
            to: [email],
            subject: 'Welcome to the inner circle! 🚀',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f97316;">You're in! 🎉</h1>
          <p>Hi there,</p>
          <p>Thanks for subscribing to the FlexPass newsletter.</p>
          <p>You'll be the first to know about:</p>
          <ul>
            <li>🔥 The hottest upcoming concerts</li>
            <li>🎫 Early bird ticket access</li>
            <li>🎁 Exclusive discounts and giveaways</li>
          </ul>
          <p>Stay tuned!</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">FlexPass - Lagos, Nigeria</p>
        </div>
      `,
        });

        return NextResponse.json({ message: "Subscribed successfully! Check your inbox." });
    } catch (error: any) {
        console.error("Subscription Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
