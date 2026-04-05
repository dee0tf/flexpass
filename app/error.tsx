"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error tracking service here (e.g. Sentry)
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: "var(--background)" }}>
      <p className="text-5xl mb-4">⚠️</p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Something went wrong
      </h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-xl font-bold text-white hover:opacity-90 transition"
        style={{ backgroundColor: "var(--brand-indigo)" }}
      >
        Try again
      </button>
    </div>
  );
}
