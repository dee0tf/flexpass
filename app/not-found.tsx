import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: "var(--background)" }}>
      <p className="text-8xl font-bold mb-4" style={{ color: "var(--brand-indigo)" }}>404</p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Page not found
      </h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        This page doesn't exist or was moved.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-bold text-white hover:opacity-90 transition"
        style={{ backgroundColor: "var(--brand-indigo)" }}
      >
        Back to Home
      </Link>
    </div>
  );
}
