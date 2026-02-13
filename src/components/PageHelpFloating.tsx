// FILE: src/components/PageHelpFloating.tsx
"use client";

/**
 * B5-1: This component is NO LONGER rendered globally.
 * It is only mounted inside vendor pages that explicitly include it.
 *
 * The floating button has been removed. Instead, this is rendered inline
 * (e.g. inside vendor "More" page or vendor layout header).
 *
 * Usage:
 *   import PageHelpInline from "@/components/PageHelpFloating";
 *   <PageHelpInline />
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { HelpCircle, Search, X } from "lucide-react";

const CACHE_KEY = "mybizhub_pagehelp_cache_v2";

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

function loadCache(): Record<
  string,
  { ts: number; answer: string; quickSteps: string[]; actions: any[] }
> {
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

export default function PageHelpInline() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<HelpRes | null>(null);

  const pageMeta = useMemo(() => {
    const map: Record<string, { title: string; hint: string }> = {
      "/vendor": {
        title: "Dashboard",
        hint: "Sales overview, quick actions, mood tip.",
      },
      "/vendor/orders": {
        title: "Orders",
        hint: "View and manage orders.",
      },
      "/vendor/products": {
        title: "Products",
        hint: "Create and manage products.",
      },
      "/vendor/wallet": {
        title: "Balance",
        hint: "Earnings and withdrawals.",
      },
      "/vendor/more": {
        title: "More",
        hint: "Tools, staff, payouts, support.",
      },
      "/vendor/store": {
        title: "Store settings",
        hint: "Brand info and WhatsApp settings.",
      },
      "/vendor/reengagement": {
        title: "Re\u2011engagement",
        hint: "Follow up with past buyers.",
      },
    };

    const base = pathname.startsWith("/vendor/orders/")
      ? "/vendor/orders"
      : pathname;
    return (
      map[base] || {
        title: "Help",
        hint: "Explain what this page does and what to do here.",
      }
    );
  }, [pathname]);

  async function ask(question: string, useCache = false) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const cache = loadCache();
    const cacheKey = `${pathname}::${trimmed.toLowerCase()}`;

    if (useCache) {
      const cached = cache[cacheKey];
      if (cached && nowMs() - Number(cached.ts || 0) < 24 * 3600 * 1000) {
        setRes({
          ok: true,
          answer: cached.answer,
          quickSteps: cached.quickSteps,
          actions: cached.actions,
        });
        return;
      }
    }

    try {
      setBusy(true);
      setRes(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setRes({ ok: false, error: "Please log in again." });
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
      if (!r.ok || !j?.ok)
        throw new Error(j?.error || "Help failed");

      setRes(j);

      if (useCache) {
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

  // B5-1: Render as an inline card/button, NOT a floating FAB
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setQ("");
          setRes(null);
        }}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Help & Support
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Get help with {pageMeta.title.toLowerCase()}
          </p>
        </div>
      </button>

      {/* Bottom sheet modal */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] flex items-end justify-center p-4">
          <div className="w-full max-w-xl">
            <Card className="p-4 rounded-[26px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">
                    Help
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {pageMeta.title} \u2022 Ask one quick question.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 rounded-2xl border border-gray-200 bg-white inline-flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search / Ask\u2026"
                  className="flex-1 rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") ask(q, false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => ask(q, false)}
                  disabled={busy}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-900 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {busy ? "\u2026" : "Ask"}
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    ask(
                      "Explain what this page does and what I should do here.",
                      true
                    )
                  }
                  disabled={busy}
                  className="text-[11px] font-bold text-gray-600 underline underline-offset-2 disabled:opacity-50"
                >
                  Explain this page
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/vendor/promote/faq/chat")
                  }
                  className="ml-auto text-[11px] font-bold text-gray-600 underline underline-offset-2"
                >
                  Open support AI
                </button>
              </div>

              <div className="mt-3">
                {res?.ok ? (
                  <div className="space-y-3">
                    {res.answer && (
                      <p className="text-sm text-gray-700">
                        {res.answer}
                      </p>
                    )}

                    {Array.isArray(res.quickSteps) &&
                      res.quickSteps.length > 0 && (
                        <div>
                          <p className="text-[11px] font-extrabold text-gray-700">
                            Quick steps
                          </p>
                          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
                            {res.quickSteps.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(res.actions) &&
                      res.actions.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {res.actions.slice(0, 2).map((a, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                router.push(a.url);
                              }}
                              className="rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ) : res?.error ? (
                  <p className="text-sm text-gray-600">{res.error}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Ask a question to get help.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}