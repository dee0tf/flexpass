"use client";

import React from "react";

interface LogoProps {
    className?: string;
    size?: number;
    type?: "full" | "icon";
    variant?: "gradient" | "white";
}

// The logo PNG is 1024×1024 but the actual logo content (F icon + "FlexPass" text)
// occupies roughly the center 55% of the width and 20% of the height.
// We use background-image cropping to display only the logo content area.
export default function Logo({ className = "", size = 40, type = "full", variant = "gradient" }: LogoProps) {
    // Logo content fractions within the 1024×1024 PNG
    const logoHeightFraction = 0.20;
    const logoWidthFraction = 0.55;

    // Scale image large enough so the logo fills `size` pixels in height
    const imageRenderSize = size / logoHeightFraction; // e.g. 44 / 0.20 = 220px

    // Container dimensions — slightly wider than the logo to avoid clipping
    const containerHeight = size;
    const containerWidth = type === "icon"
        ? size
        : Math.round(imageRenderSize * logoWidthFraction * 1.15);

    return (
        <div
            className={className}
            style={{
                width: containerWidth,
                height: containerHeight,
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo.png"
                alt="FlexPass"
                style={{
                    position: "absolute",
                    width: imageRenderSize,
                    height: imageRenderSize,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    filter: variant === "white" ? "brightness(0) invert(1)" : "none",
                    maxWidth: "none",
                }}
            />
        </div>
    );
}
