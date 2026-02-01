import "./globals.css";
import { CartProvider } from "@/lib/cart/CartContext";
import { AppShell } from "@/components/AppShell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <AppShell>{children}</AppShell>
        </CartProvider>
      </body>
    </html>
  );
}