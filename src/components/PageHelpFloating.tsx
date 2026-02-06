"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { HelpCircle, Search, X } from "lucide-react";

const INSTALL_KEY = "mybizhub_install_ts_v1";
const CACHE_KEY = "mybizhub_pagehelp_cache_v2"; // bump version so new UI uses fresh cache

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

  // Small per-page hints (kept short on purpose)
  const pageMeta = useMemo(() => {
    const map: Record<string, { title: string; hint: string }> = {
      "/vendor": { title: "Dashboard", hint: "Sales overview, quick actions, mood tip." },
      "/vendor/orders": { title: "Orders", hint: "View and manage orders." },
      "/vendor/products": { title: "Products", hint: "Create and manage products." },
      "/vendor/wallet": { title: "Balance", hint: "Earnings and withdrawals." },
      "/vendor/more": { title: "More", hint: "Tools, staff, payouts, support." },
      "/vendor/store": { title: "Store settings", hint: "Brand info and WhatsApp settings." },
      "/vendor/reengagement": { title: "Re‑engagement", hint: "Follow up with past buyers." },
    };

    const base = pathname.startsWith("/vendor/orders/") ? "/vendor/orders" : pathname;
    return map[base] || { title: "Help", hint: "Explain what this page does and what to do here." };
  }, [pathname]);

  useEffect(() => {
    setInstallTs(loadInstallTs());
  }, []);

  async function ask(question: string, useCache = false) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const cache = loadCache();
    const cacheKey = `${pathname}::${trimmed.toLowerCase()}`;

    if (useCache) {
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
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Help failed");

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

  function openHelp() {
    // After 7 days, we keep it very minimal: go straight to Help & support AI
    if (!showContextHelp) {
      router.push("/vendor/promote/faq/chat");
      return;
    }

    setOpen(true);
    setQ("");
    setRes(null);
  }

  return (
    <>
      {/* Minimal floating button (icon-only) */}
      <button
        type="button"
        onClick={openHelp}
        className="fixed bottom-20 right-4 z-[60] h-11 w-11 rounded-full border border-biz-line bg-white shadow-float inline-flex items-center justify-center"
        aria-label="Help"
        title="Help"
      >
        <HelpCircle className="h-5 w-5 text-gray-700" />
      </button>

      {/* Minimal bottom sheet */}
      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] flex items-end justify-center p-4">
          <div className="w-full max-w-xl">
            <Card className="p-4 rounded-[26px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">Help</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {pageMeta.title} • Ask one quick question.
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
                  placeholder="Search / Ask…"
                  className="flex-1 rounded-2xl border border-biz-line px-3 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => ask(q, false)}
                  disabled={busy}
                  className="rounded-2xl border border-biz-line bg-white px-3 py-3 text-sm font-bold text-biz-ink disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {busy ? "…" : "Ask"}
                </button>
              </div>

              {/* Minimal helper actions */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => ask("Explain what this page does and what I should do here.", true)}
                  disabled={busy}
                  className="text-[11px] font-bold text-gray-600 underline underline-offset-2 disabled:opacity-50"
                >
                  Explain this page
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/vendor/promote/faq/chat")}
                  className="ml-auto text-[11px] font-bold text-gray-600 underline underline-offset-2"
                >
                  Open support AI
                </button>
              </div>

              <div className="mt-3">
                {res?.ok ? (
                  <div className="space-y-3">
                    {res.answer ? <p className="text-sm text-gray-700">{res.answer}</p> : null}

                    {/* Keep steps minimal */}
                    {Array.isArray(res.quickSteps) && res.quickSteps.length ? (
                      <div>
                        <p className="text-[11px] font-extrabold text-gray-700">Quick steps</p>
                        <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
                          {res.quickSteps.slice(0, 3).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Keep action buttons minimal */}
                    {Array.isArray(res.actions) && res.actions.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {res.actions.slice(0, 2).map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              router.push(a.url);
                            }}
                            className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : res?.error ? (
                  <p className="text-sm text-gray-600">{res.error}</p>
                ) : (
                  <p className="text-sm text-gray-500">Ask a question to get help.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}