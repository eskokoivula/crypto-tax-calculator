import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CryptoTax Finland — Vero Tax Reporter",
  description: "Finnish crypto tax reporting with Moralis & AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
