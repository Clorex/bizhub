// FILE: src/app/account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { loadOptOutPrefs, saveOptOutPrefs } from "@/lib/marketing/optOut";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const [optOutSlugs, setOptOutSlugs] = useState<string[]>([]);
  const [optOutInput, setOptOutInput] = useState("");
  const [optMsg, setOptMsg] = useState<string | null>(null);
  const [savingOpt, setSavingOpt] = useState(false);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  const continuePath = useMemo(() => {
    if (isAdmin) return "/admin";
    if (isOwner) return "/vendor";
    return "/orders";
  }, [isAdmin, isOwner]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setEmail(u?.email ?? null);
      if (!u) {
        setRole(null);
        return;
      }
      try {
        const token = await u.getIdToken();
        const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        setRole(data?.me?.role ?? null);

        // load local prefs for quick UI, then sync from server best-effort
        const local = loadOptOutPrefs();
        setOptOutSlugs(local.storeOptOutSlugs || []);

        try {
          const rr = await fetch("/api/marketing/optout", { headers: { Authorization: `Bearer ${token}` } });
          const jj = await rr.json().catch(() => ({}));
          if (rr.ok) {
            const slugs: string[] = Array.isArray(jj.storeOptOutSlugs) ? jj.storeOptOutSlugs : [];
            setOptOutSlugs(slugs);
            saveOptOutPrefs({ globalOptOut: false, storeOptOutSlugs: slugs, updatedAtMs: Date.now() });
          }
        } catch {
          // ignore
        }
      } catch {
        setRole(null);
      }
    });
  }, []);

  async function logout() {
    await signOut(auth);
    router.push("/market");
  }

  const initials = (email || "B").slice(0, 1).toUpperCase();

  async function updateOptOut(storeSlug: string, optOut: boolean) {
    const slug = String(storeSlug || "").trim().toLowerCase();
    if (!slug) return;

    setSavingOpt(true);
    setOptMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const r = await fetch("/api/marketing/optout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeSlug: slug, optOut }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed");

      const next = optOut
        ? Array.from(new Set([...optOutSlugs, slug]))
        : optOutSlugs.filter((x) => x !== slug);

      setOptOutSlugs(next);
      saveOptOutPrefs({ globalOptOut: false, storeOptOutSlugs: next, updatedAtMs: Date.now() });

      setOptMsg(optOut ? `Opted out from ${slug}` : `Opt-in restored for ${slug}`);
    } catch (e: any) {
      setOptMsg(e?.message || "Failed");
    } finally {
      setSavingOpt(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="relative">
        <div className="h-2 w-full bg-gradient-to-r from-[#FF6A00] to-[#FF8A00]" />
        <div className="px-4 pt-6 pb-12 bg-gradient-to-b from-[#FFE2B8] to-[#F6F7FB]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-extrabold text-[#111827]">
                Profile<span className="text-[#FF8A00]">.</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">Your BizHub account</p>
            </div>

            <button
              className="rounded-2xl border border-[#E7E7EE] bg-white px-4 py-2 text-xs font-extrabold"
              onClick={() => router.push("/market")}
            >
              Market
            </button>
          </div>
        </div>

        <div className="px-4 -mt-8">
          <div className="rounded-3xl p-4 text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center font-extrabold">
                {initials}
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold">{email ? "Welcome back" : "Welcome"}</p>
                <p className="text-xs opacity-95 mt-1 break-all">
                  {email || "Login when you want to checkout and track orders."}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Orders" value="View" onClick={() => router.push("/orders")} />
              <Stat label="Cart" value="Open" onClick={() => router.push("/cart")} />
              <Stat label={isOwner ? "Products" : "Market"} value="Go" onClick={() => router.push(isOwner ? "/vendor/products" : "/market")} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3 mt-3">
        <Card className="p-4">
          {!email ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                onClick={() => router.push("/account/login")}
              >
                Login
              </button>
              <button
                className="rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]"
                onClick={() => router.push("/account/register")}
              >
                Register
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                className="w-full rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]"
                onClick={() => router.push(continuePath)}
              >
                Continue
              </button>

              {isOwner ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                    onClick={() => router.push("/vendor/products")}
                  >
                    My Products
                  </button>
                  <button
                    className="rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                    onClick={() => router.push("/vendor/products/new")}
                  >
                    New Product
                  </button>
                  <button
                    className="col-span-2 rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                    onClick={() => router.push("/vendor/analytics")}
                  >
                    Business Analysis
                  </button>
                </div>
              ) : null}

              <button
                className="w-full rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          )}
        </Card>

        {email ? (
          <Card className="p-4">
            <p className="text-sm font-extrabold text-biz-ink">Message preferences</p>
            <p className="text-xs text-biz-muted mt-1">
              Stop messages from specific stores (per-store opt-out).
            </p>

            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
                placeholder="Enter store slug (e.g. miracle-store)"
                value={optOutInput}
                onChange={(e) => setOptOutInput(e.target.value)}
                disabled={savingOpt}
              />
              <button
                className="px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
                onClick={() => updateOptOut(optOutInput, true)}
                disabled={savingOpt || !optOutInput.trim()}
              >
                Block
              </button>
            </div>

            {optMsg ? <p className="mt-2 text-[11px] text-gray-700">{optMsg}</p> : null}

            <div className="mt-3">
              {optOutSlugs.length === 0 ? (
                <p className="text-sm text-biz-muted">No blocked stores.</p>
              ) : (
                <div className="space-y-2">
                  {optOutSlugs.slice(0, 50).map((s) => (
                    <div key={s} className="rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-biz-ink">{s}</p>
                        <p className="text-[11px] text-gray-500 mt-1">You opted out from this store.</p>
                      </div>
                      <button
                        className="text-xs font-extrabold text-biz-accent"
                        onClick={() => updateOptOut(s, false)}
                        disabled={savingOpt}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-biz-muted">
              Note: WhatsApp messages are initiated by the vendor using your phone number from checkout.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-white/15 p-3 text-left">
      <p className="text-[11px] opacity-95">{label}</p>
      <p className="text-sm font-extrabold mt-1">{value}</p>
    </button>
  );
}