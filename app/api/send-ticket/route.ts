import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, eventTitle, ticketId, amount } = body;

    // Send the email
    const { data, error } = await resend.emails.send({
      from: 'FlexPass <onboarding@resend.dev>', // Use this default for testing
      to: [email], // In test mode, this MUST be the email you signed up to Resend with
      subject: `You're going to ${eventTitle}! 🎟️`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #581c87;">Access Granted! ✅</h1>
          <p>Hi there,</p>
          <p>Your ticket for <strong>${eventTitle}</strong> is confirmed.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Ticket ID</p>
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 18px;">${ticketId}</p>
            
            <br/>
            
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Amount Paid</p>
            <p style="margin: 5px 0 0 0; font-weight: bold;">₦${amount.toLocaleString()}</p>
          </div>

          <p>Please show this email or your QR code at the entrance.</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">FlexPass Ticketing System</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}