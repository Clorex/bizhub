// FILE: src/app/vendor/layout.tsx
import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { VendorShell } from "@/components/vendor/VendorShell";
import { VendorAccessGate } from "@/components/vendor/VendorAccessGate";

/**
 * Nested layout (vendor):
 * - DO NOT import "./globals.css" here
 * - DO NOT render <html> or <body> here
 */
export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate requireRole={["owner", "staff"]}>
      <VendorAccessGate>
        <VendorShell>{children}</VendorShell>
      </VendorAccessGate>
    </AuthGate>
  );
}