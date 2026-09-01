import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Condition & Rehab Estimator",
  description:
    "Vision-model condition scoring with deterministic, cost-book-controlled rehab pricing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
