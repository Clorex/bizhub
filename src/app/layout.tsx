// FILE: src/app/layout.tsx
import "./globals.css";
import "./cropper.css";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";
import { Toaster } from "@/components/ui/Toaster";
import PageHelpFloating from "@/components/PageHelpFloating";
import PushBellFloating from "@/components/PushBellFloating";

const THEME_COLOR = "#FF2D00"; // tailwind: biz.orange

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
        <CartProvider>
          <AppShell>{children}</AppShell>

          <Toaster />
          <PushBellFloating />
          <PageHelpFloating />
        </CartProvider>

        <PWARegister />
      </body>
    </html>
  );
}