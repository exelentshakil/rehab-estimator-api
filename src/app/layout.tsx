import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Rehab Estimator API",
  description: "AI-powered property condition and rehab estimator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, "font-sans antialiased min-h-screen flex flex-col")}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {/* traffic hub pixel -- see exelentshakil/demo-traffic */}
          <img
            src="https://demo-traffic.vercel.app/api/px?p=rehab-estimator-api"
            alt=""
            width={1}
            height={1}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
