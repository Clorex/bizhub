import { AuthGate } from "@/components/AuthGate";
import { VendorShell } from "@/components/vendor/VendorShell";
import { VendorAccessGate } from "@/components/vendor/VendorAccessGate";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate requireRole={["owner", "staff"]}>
      <VendorAccessGate>
        <VendorShell>{children}</VendorShell>
      </VendorAccessGate>
    </AuthGate>
  );
}