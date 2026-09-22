import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter, TabBar } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";
import { SyncBoundary } from "@/components/sync-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Heron", template: "%s · Heron" },
  description: "Your week, planned around the life you actually have. Free for students.",
  /**
   * Link previews, which are load-bearing here.
   *
   * Distribution is word of mouth: one student texts another a link. Without
   * these tags iMessage, Instagram DMs and Discord all render heron.study as a
   * bare blue URL, which reads as spam from a stranger. The preview is the
   * first impression far more often than the landing page is.
   *
   * `metadataBase` has to be absolute or Next emits relative OG URLs, which
   * most scrapers silently drop.
   */
  metadataBase: new URL("https://heron.study"),
  openGraph: {
    type: "website",
    siteName: "Heron",
    title: "A plan that survives you falling behind",
    description:
      "Heron works out when each piece of work actually happens, around class, work and sleep. Free, no account needed.",
    url: "https://heron.study",
  },
  twitter: {
    card: "summary_large_image",
    title: "A plan that survives you falling behind",
    description:
      "Heron works out when each piece of work actually happens, around class, work and sleep. Free, no account needed.",
  },
  applicationName: "Heron",
  appleWebApp: { capable: true, title: "Heron", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

/**
 * `viewportFit: 'cover'` plus the safe-area padding in globals.css is what stops
 * the layout hiding under the notch and the home indicator once the app is
 * installed and running without browser chrome.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider />
        <ServiceWorker />
        <SyncBoundary />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <TabBar />
      </body>
    </html>
  );
}
