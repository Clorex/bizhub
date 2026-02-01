"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";

type Role = "owner" | "staff" | "admin";

export function AuthGate({
  requireRole,
  children,
}: {
  requireRole: Role | Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const roles = Array.isArray(requireRole) ? requireRole : [requireRole];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setError(null);

        if (!u) {
          router.replace(`/account/login`);
          return;
        }

        const token = await u.getIdToken();
        const r = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Unauthorized");

        const role = data?.me?.role as string;
        const emailVerified = !!data?.me?.emailVerified;

        if (!emailVerified) {
          router.replace(`/account/verify?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!roles.includes(role as any)) {
          throw new Error(`Not allowed. Required role: ${roles.join(" or ")}`);
        }

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message || "Not authorized");
      }
    });

    return () => unsub();
  }, [router, pathname, roles.join("|")]);

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-biz-bg">
        <Card className="p-4">Loading…</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 bg-biz-bg">
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Access denied</p>
          <p className="text-sm text-gray-700 mt-2">{error}</p>
          <button
            className="mt-4 w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold"
            onClick={() => router.replace("/account")}
          >
            Go to account
          </button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}