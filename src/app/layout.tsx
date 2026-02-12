// FILE: src/app/layout.tsx
import "./globals.css";
import "./cropper.css";

import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";
import PageHelpFloating from "@/components/PageHelpFloating";
import PushBellFloating from "@/components/PushBellFloating";
import { Toaster } from "@/components/ui/Toaster";
import SplashIntro from "@/components/SplashIntro";

const THEME_COLOR = "#FF2D00"; // tailwind: biz.orange

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={THEME_COLOR} />

        {/* Icons */}
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body>
        {/* 1-second intro splash inside the app */}
        <SplashIntro />

        <CartProvider>
          <AppShell>{children}</AppShell>

          {/* Global in-app notifications */}
          <Toaster />

          {/* Floating notifications enable/disable */}
          <PushBellFloating />

          {/* Floating page help (7-day onboarding) */}
          <PageHelpFloating />
        </CartProvider>

        {/* Register SW only in production */}
        <PWARegister />
      </body>
    </html>
  );
}