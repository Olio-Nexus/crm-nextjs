import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import HolyLoader from "holy-loader";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

// Same typeface as the Plattera storefront.
const monaSans = Mona_Sans({
  variable: "--font-mona",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Plattera CRM",
  description: "Plattera e-commerce CRM admin panel",
  icons: {
    // Same theme-aware favicon as the storefront; favicon.ico stays the fallback.
    icon: [
      {
        url: "/favicon-light.png",
        media: "(prefers-color-scheme: light)",
        type: "image/png",
      },
      {
        url: "/favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
        type: "image/png",
      },
    ],
    apple: "/favicon-light.png",
  },
};

/**
 * Applied before paint so the saved theme doesn't flash light-then-dark.
 * Falls back to the OS preference when nothing is saved.
 */
const themeScript = `
(function(){try{
  var t = localStorage.getItem('crm-theme');
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above adds `dark` to <html> before
    // React hydrates, which would otherwise look like a mismatch.
    <html lang="en" className={monaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {/* Global top navigation loader — immediate feedback on every link click. */}
        <HolyLoader color="#295a4f" height={3} speed={250} easing="ease-out" showSpinner={false} />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
