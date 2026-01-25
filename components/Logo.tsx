"use client";

import React from "react";

interface LogoProps {
    className?: string;
    size?: number;
    type?: "full" | "icon";
}

export default function Logo({ className = "", size = 40, type = "full" }: LogoProps) {
    const iconContent = (
        <svg
            viewBox="0 0 100 120"
            className={className}
            width={size}
            height={size * 1.2}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#581c87" />
                </linearGradient>
                <mask id="ticket-mask">
                    <rect x="0" y="0" width="100" height="120" fill="white" />
                    {/* Ticket Perforations on the left */}
                    <circle cx="0" cy="20" r="6" fill="black" />
                    <circle cx="0" cy="40" r="6" fill="black" />
                    <circle cx="0" cy="60" r="9" fill="black" />
                    <circle cx="0" cy="80" r="6" fill="black" />
                    <circle cx="0" cy="100" r="6" fill="black" />
                </mask>
            </defs>

            {/* The F Shape */}
            <path
                d="M20 10H90V35H45V55H80V80H45V110H20V10Z"
                fill="url(#logo-gradient)"
                mask="url(#ticket-mask)"
            />
        </svg>
    );

    if (type === "icon") {
        return iconContent;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {iconContent}
            <span
                className="font-bold text-2xl tracking-tighter"
                style={{
                    background: 'linear-gradient(to bottom, #f97316, #581c87)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}
            >
                FlexPass
            </span>
        </div>
    );
}
