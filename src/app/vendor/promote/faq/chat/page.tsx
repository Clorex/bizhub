"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  atMs: number;
};

function safeText(v: any, max = 2000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trim();
}

function makeMsg(role: ChatMsg["role"], text: string): ChatMsg {
  return { role, text, atMs: Date.now() };
}

export default function VendorSupportChatPage() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    makeMsg("assistant", "Hi. I’m myBizHub support. Tell me what you’re trying to do, and what went wrong."),
  ]);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  const canSend = useMemo(() => !busy && safeText(text).length >= 2, [busy, text]);

  async function send() {
    const message = safeText(text);
    if (!message || busy) return;

    setErr(null);
    setBusy(true);
    setText("");

    const nextUser = makeMsg("user", message);

    // Keep short history
    const history = [...msgs, nextUser].slice(-12);
    setMsgs(history);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please login again to use support chat.");

      const r = await fetch("/api/vendor/support/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: history.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Support chat failed");

      const reply = safeText(data.reply || "I didn’t understand. Please try again.");

      setMsgs((prev): ChatMsg[] => [...prev, makeMsg("assistant", reply)].slice(-20));
    } catch (e: any) {
      setErr(e?.message || "Failed");
      setMsgs((prev): ChatMsg[] => [
        ...prev,
        makeMsg("assistant", "I couldn’t reply right now. Please try again in a moment."),
      ].slice(-20));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Support chat" subtitle="Explain your issue in simple words" showBack={true} />

      <div className="px-4 pb-28 space-y-3">
        {err ? <Card className="p-4 text-red-700">{err}</Card> : null}

        <div className="space-y-2">
          {msgs.map((m, idx) => (
            <div
              key={idx}
              className={[
                "rounded-2xl border border-biz-line p-3 text-sm",
                m.role === "user" ? "bg-white" : "bg-biz-cream",
              ].join(" ")}
            >
              <p className="text-[11px] text-gray-500 font-bold">{m.role === "user" ? "You" : "myBizHub support"}</p>
              <p className="mt-1 whitespace-pre-wrap text-gray-800">{m.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <Card className="p-4">
          <p className="text-[11px] text-biz-muted">Don’t share passwords, OTP codes, or private banking details.</p>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 border border-biz-line rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30"
              placeholder={busy ? "Replying…" : "Type your message…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={busy}
            />
            <Button onClick={send} disabled={!canSend} loading={busy}>
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}