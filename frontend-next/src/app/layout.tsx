import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "AI LENS - MBTI 맞춤 경제 뉴스",
    template: "%s | AI LENS",
  },
  description: "서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스. 나만의 성향에 맞는 뉴스를 만나보세요.",
  keywords: ["MBTI", "경제뉴스", "서울경제", "AI뉴스", "맞춤뉴스", "투자", "증권"],
  authors: [{ name: "서울경제신문" }],
  openGraph: {
    title: "AI LENS - MBTI 맞춤 경제 뉴스",
    description: "서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스",
    type: "website",
    locale: "ko_KR",
    siteName: "AI LENS",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI LENS - MBTI 맞춤 경제 뉴스",
    description: "서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="antialiased">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <a href="#main-content" className="skip-link">
            본문 바로가기
          </a>
          <div id="main-content" className="contents">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
