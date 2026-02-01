"use client";

import { useEffect, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const j = await api("/api/admin/reports/daily");
      setReport(j.report || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function sendNow() {
    setSending(true);
    setMsg(null);
    try {
      const j = await api("/api/admin/reports/daily", { method: "POST" });
      setMsg(`Sent to ${j.sentTo}`);
    } catch (e: any) {
      setMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Reports" subtitle="Daily email report" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {!loading && report ? (
          <>
            <Card className="p-4">
              <p className="text-sm font-bold text-biz-ink">Today’s report</p>
              <p className="text-xs text-biz-muted mt-1">
                Day: <b className="text-biz-ink">{report.dayKey}</b>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={sendNow} loading={sending}>
                  Send now (email)
                </Button>
                <Button variant="secondary" onClick={load}>
                  Refresh
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                Automation is optional. If you want free daily automation, use GitHub Actions to call the POST endpoint with a token.
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-bold text-biz-ink">Preview</p>
              <pre className="mt-3 text-[12px] whitespace-pre-wrap text-gray-800">
{report.text}
              </pre>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}