import { ImageResponse } from "next/og";

export const alt = "FlexPass — Nigeria's Premier Ticketing Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0E0D0D 0%, #480082 55%, #0E0D0D 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          gap: "24px",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "700px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(159,103,254,0.35) 0%, transparent 70%)",
          }}
        />

        {/* Logo mark + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px", zIndex: 1 }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              background: "#FFB700",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              fontWeight: "900",
              color: "#0E0D0D",
            }}
          >
            F
          </div>
          <span style={{ fontSize: "56px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>
            FlexPass
          </span>
        </div>

        {/* Tagline */}
        <p style={{ fontSize: "26px", color: "rgba(255,255,255,0.65)", margin: "0", zIndex: 1 }}>
          Nigeria&apos;s Premier Ticketing Platform
        </p>

        {/* Brand line */}
        <p style={{ fontSize: "20px", color: "#FFB700", margin: "0", zIndex: 1, fontWeight: "600" }}>
          Tap, Flex, Enter. Repeat.
        </p>

        {/* URL */}
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.3)", margin: "0", zIndex: 1 }}>
          flexpasshq.com
        </p>
      </div>
    ),
    { ...size }
  );
}
