"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface TicketQRProps {
    ticketId: string;
    className?: string;
}

export default function TicketQR({ ticketId, className = "" }: TicketQRProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner ${className}`}>
            <QRCodeSVG
                value={JSON.stringify({ ticketId })}
                size={180}
                level={"H"}
                includeMargin={true}
                imageSettings={{
                    src: "/Logo-icon.jpg",
                    x: undefined,
                    y: undefined,
                    height: 30,
                    width: 30,
                    excavate: true,
                }}
                className="rounded-lg"
            />
            <p className="mt-4 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                #{ticketId.slice(0, 18)}
            </p>
        </div>
    );
}
