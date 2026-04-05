import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Event | FlexPass",
  description: "Host your event on FlexPass and start selling tickets instantly.",
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
