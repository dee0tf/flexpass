"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleUnsubscribe = async () => {
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Failed to connect. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="h-1.5 w-full grad-brand" />
        <div className="p-10 flex flex-col items-center gap-5 text-center">
          <div className="h-20 w-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(72,0,130,0.12)", border: "2px solid var(--brand-indigo)" }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-indigo)" }} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              You&apos;ve been unsubscribed
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{email}</span> has been removed from the FlexPass newsletter.
              You won&apos;t receive any more emails from us.
            </p>
          </div>
          <Link href="/"
            className="mt-2 text-sm font-semibold px-6 py-2.5 rounded-xl transition hover:opacity-80 text-white"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            Back to FlexPass
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="h-1.5 w-full grad-brand" />
      <div className="p-8">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-6"
          style={{ backgroundColor: "rgba(72,0,130,0.1)" }}>
          <MailX className="h-6 w-6" style={{ color: "var(--brand-indigo)" }} />
        </div>

        <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Unsubscribe
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Sorry to see you go. Confirm your email below to be removed from our newsletter.
        </p>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
              style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
            />
          </div>

          {status === "error" && (
            <p className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
              <AlertCircle size={15} /> {message}
            </p>
          )}

          <button
            onClick={handleUnsubscribe}
            disabled={!email || status === "loading"}
            className="w-full py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 text-white"
            style={{ backgroundColor: "var(--brand-indigo)" }}
          >
            {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Unsubscribe me"}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Changed your mind?{" "}
            <Link href="/" className="underline hover:no-underline" style={{ color: "var(--brand-indigo)" }}>
              Stay subscribed
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={44} variant="gradient" />
        </div>
        <Suspense fallback={
          <div className="rounded-3xl p-10 flex justify-center" style={{ backgroundColor: "var(--card-bg)" }}>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} />
          </div>
        }>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  );
}
