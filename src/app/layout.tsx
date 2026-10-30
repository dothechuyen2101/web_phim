import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Suspense } from "react";
import { BackToTop } from "@/components/back-to-top";
import { BottomNav } from "@/components/bottom-nav";
import { PwaPrompt } from "@/components/pwa";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – Xem phim online Vietsub, Thuyết minh`, template: `%s | ${SITE_NAME}` },
  description: "Tổng hợp phim lẻ, phim bộ, hoạt hình, anime Vietsub và thuyết minh, cập nhật liên tục.",
  openGraph: { siteName: SITE_NAME, locale: "vi_VN", type: "website" },
  // Cài lên màn hình chính iPhone/iPad (manifest ở app/manifest.ts dùng cho Android / desktop)
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-20 font-sans md:pb-0">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Suspense>
          <BottomNav />
        </Suspense>
        <BackToTop />
        <PwaPrompt siteName={SITE_NAME} />
      </body>
    </html>
  );
}
