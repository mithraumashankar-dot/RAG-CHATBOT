import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RegBot — PMIST CSE Department Regulation Assistant",
  description:
    "Chatbot for Periyar Maniammai Institute of Science & Technology CSE Department regulations: B.Tech R-2024, PG R-2024 (M.Tech) and Ph.D. 2024 rules, attendance, exams, CGPA and percentage calculators.",
  keywords: [
    "PMIST",
    "CSE Department",
    "RegBot",
    "college regulations",
    "B.Tech R-2024",
    "M.Tech regulations",
    "Ph.D. regulations",
    "attendance calculator",
    "CGPA calculator",
  ],
  authors: [{ name: "PMIST CSE Department" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
