// FILE: src/app/vendor/reengagement/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { MessageCircle, AlertTriangle } from "lucide-react";

type Audience = "buyers" | "abandoned";

function waLink(phone: string, text: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function templateFor(a: Audience) {
  if (a === "abandoned") {
    return `Hello, I noticed you started an order but didn’t complete payment.

Do you still want it? I can help you complete it.`;
  }
  return `Hello, thank you for buying from my BizHub store.

If you need anything else or want to reorder, I’m available.`;
}

export default function VendorReengagementPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [audience, setAudience] = useState<Audience>("buyers");
  const [days, setDays] = useState<number>(30);

  const [people, setPeople] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [text, setText] = useState<string>(templateFor("buyers"));

  const [sending, setSending] = useState(false);
  const sendQueueRef = useRef<any[]>([]);
  const sendIdxRef = useRef<number>(0);

  const selectedPeople = useMemo(() => {
    return people.filter((p) => selected[p.key]);
  }, [people, selected]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function loadAudience() {
    setLoading(true);
    setMsg(null);

    try {
      const data = await authedFetch(
        `/api/vendor/reengagement/audience?audience=${encodeURIComponent(audience)}&days=${encodeURIComponent(String(days))}`
      );

      const list = Array.isArray(data.people) ? data.people : [];
      setPeople(list);

      const initSel: Record<string, boolean> = {};
      for (const p of list.slice(0, 50)) initSel[String(p.key)] = true;
      setSelected(initSel);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setPeople([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setText(templateFor(audience));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  useEffect(() => {
    loadAudience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, days]);

  function toggle(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const p of people) next[String(p.key)] = on;
    setSelected(next);
  }

  async function startSend() {
    if (!text.trim()) return;
    if (selectedPeople.length === 0) return;

    setSending(true);
    setMsg(null);

    try {
      const recipients = selectedPeople.slice(0, 500);

      const data = await authedFetch("/api/vendor/reengagement/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, text, people: recipients }),
      });

      const list: any[] = Array.isArray(data.recipients) ? data.recipients : [];
      if (list.length === 0) {
        setMsg("No recipients available under your plan limit today.");
        setSending(false);
        return;
      }

      // Queue: open WhatsApp tabs with delay (reduces vendor stress, but WhatsApp still opens)
      sendQueueRef.current = list;
      sendIdxRef.current = 0;

      setMsg(`Starting WhatsApp send… (${list.length} recipient(s))`);

      const tick = async () => {
        const i = sendIdxRef.current;
        const q = sendQueueRef.current;

        if (i >= q.length) {
          setSending(false);
          setMsg(`Done. Opened WhatsApp for ${q.length} recipient(s).`);
          return;
        }

        const r = q[i];
        const url = waLink(String(r.phone || ""), text);
        window.open(url, "_blank");

        sendIdxRef.current = i + 1;
        setTimeout(tick, 650);
      };

      tick();
    } catch (e: any) {
      setSending(false);
      setMsg(e?.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Re‑engagement" subtitle="Message past buyers and follow up" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className={String(msg).toLowerCase().includes("blocked") ? "p-4 text-red-700" : "p-4"}>{msg}</Card>
        ) : null}

        <SectionCard title="Audience" subtitle="Choose who you want to message">
          <SegmentedControl<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { value: "buyers", label: "Past buyers" },
              { value: "abandoned", label: "Not completed" },
            ]}
          />

          <div className="mt-2">
            <Input
              type="number"
              min={7}
              max={90}
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              placeholder="30"
              disabled={sending}
            />
            <p className="text-[11px] text-biz-muted mt-1">Buyers = paid or delivered. Not completed = unpaid.</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => toggleAll(true)} disabled={sending}>
              Select all
            </Button>
            <Button variant="secondary" onClick={() => toggleAll(false)} disabled={sending}>
              Clear all
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Message" subtitle="Edit before sending">
          <textarea
            className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            disabled={sending}
          />

          <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-biz-ink">Safety policy</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  Bullying/sexual harassment content is blocked and logged.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Recipients"
          subtitle={loading ? "Loading…" : `${people.length} found • ${selectedPeople.length} selected`}
          right={
            <Button size="sm" variant="secondary" onClick={loadAudience} disabled={loading || sending}>
              Refresh
            </Button>
          }
        >
          {loading ? <p className="text-sm text-biz-muted">Loading…</p> : null}

          {!loading && people.length === 0 ? <p className="text-sm text-biz-muted">No recipients found.</p> : null}

          {!loading && people.length > 0 ? (
            <div className="space-y-2">
              {people.slice(0, 80).map((p) => (
                <button
                  key={p.key}
                  className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
                  onClick={() => (!sending ? toggle(p.key) : undefined)}
                  type="button"
                  disabled={sending}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-biz-ink">{p.fullName || p.phone}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {p.phone} • Last order: {String(p.lastOrderId || "").slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={
                        selected[p.key]
                          ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
                      }
                    >
                      {selected[p.key] ? "Selected" : "Off"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <Button onClick={startSend} disabled={sending || !text.trim() || selectedPeople.length === 0}>
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  {sending ? "Sending…" : "Send"}
                </span>
              </Button>

              <Button variant="secondary" onClick={() => window.history.back()} disabled={sending}>
                Back
              </Button>
            </Card>
          </div>
        </div>

        <div className="h-28" />
      </div>
    </div>
  );
}