"use client";

import { QRCodeSVG } from "qrcode.react";

interface TicketQRProps {
    ticketId: string;
    className?: string;
}

// The QR value is a URL to the check-in verification page.
// The ticket ID itself is the unique identifier — the check-in page
// does server-side HMAC verification to confirm authenticity.
export default function TicketQR({ ticketId, className = "" }: TicketQRProps) {
    const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://flexpass.ng";

    const qrValue = `${baseUrl}/checkin/verify?t=${ticketId}`;

    return (
        <div className={`flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner ${className}`}>
            <QRCodeSVG
                value={qrValue}
                size={200}
                level="H"
                marginSize={4}
                imageSettings={{
                    src: "/logo.png",
                    x: undefined,
                    y: undefined,
                    height: 32,
                    width: 32,
                    excavate: true,
                }}
            />
            <p className="mt-4 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                #{ticketId.slice(0, 18).toUpperCase()}
            </p>
        </div>
    );
}
