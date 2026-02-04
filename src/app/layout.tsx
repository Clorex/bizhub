import "./globals.css";
import "./cropper.css";

import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";
import { PWARegister } from "@/components/PWARegister";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <AppShell>{children}</AppShell>
        </CartProvider>

        {/* Register SW only in production */}
        <PWARegister />
      </body>
    </html>
  );
}