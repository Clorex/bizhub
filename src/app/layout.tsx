import "./globals.css";
import "./cropper.css";

import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";
import PageHelpFloating from "@/components/PageHelpFloating";
import PushBellFloating from "@/components/PushBellFloating";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <AppShell>{children}</AppShell>

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