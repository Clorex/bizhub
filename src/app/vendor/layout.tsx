/* FILE: src/app/vendor/layout.tsx */

export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { VendorShell } from "@/components/vendor/VendorShell";
import { VendorAccessGate } from "@/components/vendor/VendorAccessGate";
import { AchievementProvider } from "@/components/AchievementProvider";

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate requireRole={["owner", "staff"]}>
      <VendorAccessGate>
        <AchievementProvider role="vendor">
          <VendorShell>{children}</VendorShell>
        </AchievementProvider>
      </VendorAccessGate>
    </AuthGate>
  );
}
