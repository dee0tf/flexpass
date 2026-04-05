"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {}, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-96 text-center px-4">
      <p className="text-4xl mb-4">⚠️</p>
      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Dashboard error
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Something went wrong loading this page.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-90 transition"
        style={{ backgroundColor: "var(--brand-indigo)" }}
      >
        Try again
      </button>
    </div>
  );
}
