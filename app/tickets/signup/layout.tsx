import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join FlexPass to discover and host events in Nigeria.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
