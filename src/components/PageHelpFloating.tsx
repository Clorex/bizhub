"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { HelpCircle, Search, X } from "lucide-react";

const INSTALL_KEY = "mybizhub_install_ts_v1";
const CACHE_KEY = "mybizhub_pagehelp_cache_v1";

type HelpRes = {
  ok: boolean;
  answer?: string;
  quickSteps?: string[];
  actions?: { label: string; url: string }[];
  error?: string;
};

function nowMs() {
  return Date.now();
}

function daysSince(ts: number) {
  return Math.floor((nowMs() - ts) / 86400000);
}

function loadInstallTs(): number {
  if (typeof window === "undefined") return nowMs();
  const raw = localStorage.getItem(INSTALL_KEY);
  const v = Number(raw || 0);
  if (v > 0) return v;
  const t = nowMs();
  localStorage.setItem(INSTALL_KEY, String(t));
  return t;
}

function loadCache(): Record<string, { ts: number; answer: string; quickSteps: string[]; actions: any[] }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function saveCache(v: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(v));
}

export default function PageHelpFloating() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [open, setOpen] = useState(false);
  const [installTs, setInstallTs] = useState<number>(() => loadInstallTs());

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<HelpRes | null>(null);

  const showContextHelp = useMemo(() => daysSince(installTs) < 7, [installTs]);

  // simple page hint map (you can expand later)
  const pageMeta = useMemo(() => {
    const map: Record<string, { title: string; hint: string }> = {
      "/vendor": { title: "Dashboard", hint: "Business overview, sales, quick actions, check-in and nudges." },
      "/vendor/orders": { title: "Orders", hint: "View and manage orders. Update status, confirm transfers, handle disputes." },
      "/vendor/products": { title: "Products", hint: "Create and manage products, pricing, stock, and visibility." },
      "/vendor/wallet": { title: "Balance", hint: "Earnings, pending/available amounts and withdrawals." },
      "/vendor/more": { title: "More", hint: "Tools, settings, staff, payouts, support." },
      "/vendor/store": { title: "Store settings", hint: "Business info, WhatsApp, banner, checkout/chat settings." },
      "/vendor/reengagement": { title: "Re‑engagement", hint: "Message past buyers and follow up." },
    };

    // fallback for dynamic routes
    const base = pathname.startsWith("/vendor/orders/") ? "/vendor/orders" : pathname;
    return map[base] || { title: "This page", hint: "Explain what this page does and what to do here." };
  }, [pathname]);

  useEffect(() => {
    // refresh installTs from storage in case it changes
    setInstallTs(loadInstallTs());
  }, []);

  async function ask(question: string, useCacheForExplain = false) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const cache = loadCache();
    const cacheKey = `${pathname}::${trimmed.toLowerCase()}`;

    if (useCacheForExplain) {
      const cached = cache[cacheKey];
      if (cached && nowMs() - Number(cached.ts || 0) < 24 * 3600 * 1000) {
        setRes({ ok: true, answer: cached.answer, quickSteps: cached.quickSteps, actions: cached.actions });
        return;
      }
    }

    try {
      setBusy(true);
      setRes(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setRes({ ok: false, error: "Please log in to use help." });
        return;
      }

      const r = await fetch("/api/help/page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: pathname,
          pageTitle: pageMeta.title,
          pageHint: pageMeta.hint,
          question: trimmed,
        }),
      });

      const j = (await r.json().catch(() => ({}))) as HelpRes;
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Help failed");

      setRes(j);

      // cache explain-style queries
      if (useCacheForExplain) {
        cache[cacheKey] = {
          ts: nowMs(),
          answer: String(j.answer || ""),
          quickSteps: Array.isArray(j.quickSteps) ? j.quickSteps : [],
          actions: Array.isArray(j.actions) ? j.actions : [],
        };
        saveCache(cache);
      }
    } catch (e: any) {
      setRes({ ok: false, error: e?.message || "Help failed" });
    } finally {
      setBusy(false);
    }
  }

  function openHelp() {
    if (!showContextHelp) {
      // after 7 days: go to Help & Support AI only
      router.push("/vendor/promote/faq/chat");
      return;
    }

    setOpen(true);

    // auto-load explanation on open
    const explainQ = "Explain what this page does and how to use it.";
    ask(explainQ, true);
    setQ("");
  }

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={openHelp}
        className="fixed bottom-20 right-4 z-[60] rounded-2xl border border-biz-line bg-white shadow-float px-3 py-3 inline-flex items-center gap-2"
      >
        <HelpCircle className="h-5 w-5 text-orange-700" />
        <span className="text-sm font-extrabold text-biz-ink">Help</span>
      </button>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-xl">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">{pageMeta.title} help</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Ask anything confusing on this page. I’ll point you to the right place.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 rounded-2xl border border-biz-line bg-white inline-flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search / Ask a question..."
                  className="flex-1 rounded-2xl border border-biz-line px-3 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => ask(q, false)}
                  disabled={busy}
                  className="rounded-2xl border border-biz-line bg-white px-3 py-3 text-sm font-bold text-biz-ink disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {busy ? "..." : "Ask"}
                </button>
              </div>

              <div className="mt-3">
                {res?.ok ? (
                  <div className="space-y-3">
                    {res.answer ? <p className="text-sm text-gray-800">{res.answer}</p> : null}

                    {Array.isArray(res.quickSteps) && res.quickSteps.length ? (
                      <div>
                        <p className="text-xs font-extrabold text-biz-ink">Quick steps</p>
                        <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                          {res.quickSteps.slice(0, 5).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Array.isArray(res.actions) && res.actions.length ? (
                      <div className="flex flex-wrap gap-2">
                        {res.actions.slice(0, 4).map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              router.push(a.url);
                            }}
                            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold text-orange-700"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => router.push("/vendor/promote/faq/chat")}
                      className="w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
                    >
                      Open Help & support AI
                    </button>
                  </div>
                ) : res?.error ? (
                  <p className="text-sm text-red-700">{res.error}</p>
                ) : (
                  <p className="text-sm text-biz-muted">Ask a question to get help.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}