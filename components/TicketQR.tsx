"use client";

import { QRCodeSVG } from "qrcode.react";

interface TicketQRProps {
    ticketId: string;
    className?: string;
    // ms before the QR starts "decoding" in
    revealDelay?: number;
}

// The QR value is a URL to the check-in verification page.
// The ticket ID itself is the unique identifier — the check-in page
// does server-side HMAC verification to confirm authenticity.
export default function TicketQR({ ticketId, className = "", revealDelay = 0 }: TicketQRProps) {
    const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://flexpass.ng";

    const qrValue = `${baseUrl}/checkin/verify?t=${ticketId}`;

    return (
        // Rotating gold/purple ring around a plain white box. The ring sits
        // OUTSIDE the white quiet zone, and the scan sweep only runs twice on
        // reveal, so nothing is left moving over the code at the door.
        <div className={`relative rounded-[22px] p-[3px] overflow-hidden ${className}`}>
            <div
                className="fp-spin absolute left-1/2 top-1/2 h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2"
                style={{ background: "conic-gradient(from 0deg, #FFB700, #9F67FE, #480082, #FFB700)" }}
                aria-hidden
            />
            <div className="relative rounded-[19px] bg-white p-4">
                <div className="fp-wipe relative" style={{ animationDelay: `${revealDelay}ms` }}>
                    <QRCodeSVG
                        value={qrValue}
                        size={220}
                        level="H"
                        marginSize={2}
                        imageSettings={{
                            src: "/logo.png",
                            x: undefined,
                            y: undefined,
                            height: 34,
                            width: 34,
                            excavate: true,
                        }}
                    />
                    <span
                        className="fp-scan pointer-events-none absolute left-0 right-0 h-8 -translate-y-1/2 opacity-0"
                        style={{
                            animationDelay: `${revealDelay + 900}ms`,
                            background: "linear-gradient(to bottom, transparent, rgba(159,103,254,0.35), transparent)",
                        }}
                        aria-hidden
                    />
                </div>
            </div>
        </div>
    );
}
