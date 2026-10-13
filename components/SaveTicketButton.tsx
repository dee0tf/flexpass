"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Check, Loader2 } from "lucide-react";

interface Props {
  ticketId: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel: string | null;
  venueLabel: string;
  tierName: string;
  holderName: string | null;
  gender: { letter: string; color: string } | null;
}

const W = 1080;
const H = 1720;
const FONT = "'Space Grotesk', system-ui, sans-serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  }
  return lines;
}

/**
 * Renders the ticket (QR included) to a PNG the buyer can keep on their
 * phone — no login, works offline at the door from the photo gallery.
 * Mobile gets the native share sheet ("Save Image"); desktop downloads it.
 */
export default function SaveTicketButton(p: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  async function save() {
    const qr = qrRef.current;
    if (!qr) return;
    setState("working");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Ticket body — same gradient as the on-screen ticket
      const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
      g.addColorStop(0, "#9F67FE");
      g.addColorStop(0.45, "#6A23B8");
      g.addColorStop(1, "#480082");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 64);
      ctx.fill();

      const pad = 80;
      ctx.fillStyle = "#FFB700";
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText("FLEXPASS", pad, 120);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(p.tierName.toUpperCase(), pad, 180);

      // Title (leave room on the right for the gender badge)
      const titleWidth = W - pad * 2 - (p.gender ? 180 : 0);
      ctx.fillStyle = "#fff";
      ctx.font = `700 76px ${FONT}`;
      const titleLines = wrap(ctx, p.eventTitle, titleWidth, 3);
      titleLines.forEach((l, i) => ctx.fillText(l, pad, 290 + i * 88));
      let y = 290 + titleLines.length * 88 + 20;

      if (p.gender) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(W - pad - 150, 220, 150, 150, 32);
        ctx.fill();
        ctx.fillStyle = p.gender.color;
        ctx.font = `700 120px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(p.gender.letter, W - pad - 75, 338);
        ctx.textAlign = "left";
      }

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `500 40px ${FONT}`;
      for (const line of [p.dateLabel, p.timeLabel, p.venueLabel].filter(Boolean) as string[]) {
        for (const l of wrap(ctx, line, W - pad * 2, 2)) {
          ctx.fillText(l, pad, y);
          y += 54;
        }
        y += 6;
      }
      if (p.holderName) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `600 32px ${FONT}`;
        ctx.fillText("ADMIT", pad, y + 24);
        ctx.fillStyle = "#fff";
        ctx.font = `700 42px ${FONT}`;
        ctx.fillText(wrap(ctx, p.holderName, W - pad * 2 - 140, 1)[0], pad + 130, y + 26);
        y += 60;
      }

      // Tear line
      const tearY = Math.max(y + 40, 860);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(pad, tearY);
      ctx.lineTo(W - pad, tearY);
      ctx.stroke();
      ctx.setLineDash([]);

      // QR on a white card
      const qrSize = 560;
      const qrX = (W - qrSize) / 2;
      const qrY = tearY + 60;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(qrX - 36, qrY - 36, qrSize + 72, qrSize + 72, 40);
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 52px ui-monospace, Menlo, monospace`;
      ctx.fillText(p.ticketId.slice(0, 8).toUpperCase().split("").join(" "), W / 2, qrY + qrSize + 120);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `500 32px ${FONT}`;
      ctx.fillText("Show this at the door to check in", W / 2, qrY + qrSize + 175);

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("render failed");
      const name = `FlexPass-ticket-${p.ticketId.slice(0, 8).toUpperCase()}.png`;
      const file = new File([blob], name, { type: "image/png" });

      // Phones: share sheet has "Save Image" / "Save to Photos"
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: p.eventTitle });
          setState("done");
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") { setState("idle"); return; }
          // Share failed for another reason — fall through to a download
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setState("done");
    } catch {
      setState("idle");
    }
  }

  const qrValue = `${typeof window !== "undefined" ? window.location.origin : "https://flexpasshq.com"}/checkin/verify?t=${p.ticketId}`;

  return (
    <>
      {/* Off-screen source for the saved image's QR — same value as TicketQR */}
      <div className="hidden" aria-hidden>
        <QRCodeCanvas ref={qrRef} value={qrValue} size={560} level="H" marginSize={2} />
      </div>
      <button
        onClick={save}
        disabled={state === "working"}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "var(--brand-amber)", color: "#1A0F00" }}
      >
        {state === "working" ? <Loader2 className="h-4 w-4 animate-spin" />
          : state === "done" ? <Check className="h-4 w-4" />
          : <Download className="h-4 w-4" />}
        {state === "done" ? "Saved — check your photos or downloads" : "Save ticket to phone"}
      </button>
    </>
  );
}
