import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "mbti-admin.sedaily.ai",
  description: "AI LENS admin console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col text-slate-900 antialiased font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
