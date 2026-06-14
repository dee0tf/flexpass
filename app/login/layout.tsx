import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | FlexPass",
  description: "Sign in to FlexPass to manage your events and tickets.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
