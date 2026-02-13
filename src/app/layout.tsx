// FILE: src/app/layout.tsx
import "./globals.css";
import "./cropper.css";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";
import { Toaster } from "@/components/ui/Toaster";
import SplashIntro from "@/components/SplashIntro";
import PageHelpFloating from "@/components/PageHelpFloating";
import PushBellFloating from "@/components/PushBellFloating";

const THEME_COLOR = "#FF2D00";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={THEME_COLOR} />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body>
        <SplashIntro />

        <CartProvider>
          <AppShell>{children}</AppShell>
          <Toaster />

          {/* These components self-limit (they decide when to show) */}
          <PushBellFloating />
          <PageHelpFloating />
        </CartProvider>

        <PWARegister />
      </body>
    </html>
  );
}