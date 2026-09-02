import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traffic Analytics | RehabEstimator",
  description: "Live traffic tracking",
};

export default function TrafficLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // We don't apply ThemeProvider here so we can force dark mode easily 
  // via Tailwind class without NextThemes interfering for this specific page.
  return <>{children}</>;
}
