// FILE: src/app/admin/layout.tsx
"use client";

import { AuthGate } from "@/components/AuthGate";
import { AdminSecurityGate } from "@/components/admin/AdminSecurityGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate requireRole="admin">
      <AdminSecurityGate>{children}</AdminSecurityGate>
    </AuthGate>
  );
}