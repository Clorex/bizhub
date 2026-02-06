import "./globals.css";
import "./cropper.css";

import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";
import PageHelpFloating from "@/components/PageHelpFloating";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <AppShell>{children}</AppShell>

          {/* ✅ Help button on every page
              - First 7 days: page helper (Groq) with search/ask + actions
              - After 7 days: redirects to Help & support AI only
          */}
          <PageHelpFloating />
        </CartProvider>

        {/* Register SW only in production */}
        <PWARegister />
      </body>
    </html>
  );
}