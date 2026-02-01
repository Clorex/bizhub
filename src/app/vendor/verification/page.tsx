// FILE: src/app/vendor/verification/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { ImageUploader } from "@/components/vendor/ImageUploader";

type IdType = "nin" | "drivers_licence" | "voters_card" | "passport";

function TierPill({ tier }: { tier: number }) {
  const t = Number(tier || 0);
  const cls =
    t >= 3
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : t === 2
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : t === 1
          ? "bg-orange-50 text-orange-700 border-orange-100"
          : "bg-white text-gray-700 border-biz-line";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
      Tier {t || 0}
    </span>
  );
}

export default function VendorVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tier, setTier] = useState<number>(0);
  const [verification, setVerification] = useState<any>(null);
  const [trust, setTrust] = useState<any>(null);

  // Tier 1
  const [selfieUrls, setSelfieUrls] = useState<string[]>([]);

  // Tier 2
  const [idType, setIdType] = useState<IdType>("nin");
  const [idNumber, setIdNumber] = useState<string>("");

  // Tier 3
  const [proofUrls, setProofUrls] = useState<string[]>([]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/vendor/verification");
      setTier(Number(data.verificationTier || 0));
      setVerification(data.verification || null);
      setTrust(data.trust || null);

      const t1 = data?.verification?.tier1;
      if (t1?.selfieUrls?.length) setSelfieUrls(t1.selfieUrls);

      const t2 = data?.verification?.tier2;
      if (t2?.idType) setIdType(String(t2.idType) as any);
      if (t2?.idNumber) setIdNumber(String(t2.idNumber));

      const t3 = data?.verification?.tier3;
      if (t3?.proofUrls?.length) setProofUrls(t3.proofUrls);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setVerification(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t1Status = String(verification?.tier1?.status || "not_started");
  const t2Status = String(verification?.tier2?.status || "not_started");
  const t3Status = String(verification?.tier3?.status || "not_started");

  const openDisputes = Number(trust?.openDisputes || 0);

  async function submitTier1() {
    setSaving(true);
    setMsg(null);
    try {
      await authedFetch("/api/vendor/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "tier1", selfieUrls }),
      });
      setMsg("Tier 1 updated.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitTier2() {
    setSaving(true);
    setMsg(null);
    try {
      await authedFetch("/api/vendor/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "tier2", idType, idNumber }),
      });
      setMsg("Tier 2 submitted. Admin review can take up to 8 hours.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitTier3() {
    setSaving(true);
    setMsg(null);
    try {
      await authedFetch("/api/vendor/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "tier3", proofUrls }),
      });
      setMsg("Tier 3 submitted. Admin review can take up to 8 hours.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  const showVisibilityNote = useMemo(() => {
    return "Important: vendors with higher tiers appear more in the marketplace. Tier 0 is reduced visibility.";
  }, []);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Verification" subtitle="Tier system for trust + visibility" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {!loading ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Your verification</p>
              <div className="mt-2 flex items-center gap-2">
                <TierPill tier={tier} />
                {openDisputes > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border bg-red-50 text-red-700 border-red-100">
                    Open disputes: {openDisputes}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] opacity-95 mt-3">{showVisibilityNote}</p>
            </div>

            <SectionCard title="Tier 1 — Face check" subtitle="Upload clear selfies (bright light)">
              <p className="text-[11px] text-biz-muted">
                Guidance: take a clear photo of your face (front), and if you can, add extra angles.
              </p>

              <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
                <ImageUploader
                  label="Upload selfie photos"
                  multiple={true}
                  onUploaded={(urls) => setSelfieUrls((prev) => [...prev, ...urls].slice(0, 6))}
                />

                {selfieUrls.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {selfieUrls.map((u) => (
                      <div key={u} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Selfie" className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-biz-muted">
                  Status: <b className="text-biz-ink">{t1Status}</b>
                </span>
                <Button onClick={submitTier1} loading={saving} disabled={saving || selfieUrls.length < 1}>
                  Save Tier 1
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Tier 2 — ID number" subtitle="Enter your verification number (no photo)">
              <SegmentedControl<IdType>
                value={idType}
                onChange={setIdType}
                options={[
                  { value: "nin", label: "NIN" },
                  { value: "drivers_licence", label: "Driver’s" },
                  { value: "voters_card", label: "Voter’s" },
                  { value: "passport", label: "Passport" },
                ]}
              />

              <div className="mt-2">
                <Input
                  placeholder="Enter your ID number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-biz-muted">
                  Status: <b className="text-biz-ink">{t2Status}</b>
                </span>
                <Button onClick={submitTier2} loading={saving} disabled={saving || idNumber.trim().length < 5}>
                  Submit Tier 2
                </Button>
              </div>

              {verification?.tier2?.adminNote ? (
                <p className="mt-2 text-[11px] text-red-700">Admin note: {String(verification.tier2.adminNote)}</p>
              ) : null}
            </SectionCard>

            <SectionCard title="Tier 3 — Proof of address" subtitle="Upload a document showing your address">
              <div className="rounded-2xl border border-biz-line bg-white p-3">
                <ImageUploader
                  label="Upload proof of address"
                  multiple={true}
                  onUploaded={(urls) => setProofUrls((prev) => [...prev, ...urls].slice(0, 6))}
                />

                {proofUrls.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {proofUrls.map((u) => (
                      <div key={u} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Proof" className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-biz-muted">
                  Status: <b className="text-biz-ink">{t3Status}</b>
                </span>
                <Button onClick={submitTier3} loading={saving} disabled={saving || proofUrls.length < 1}>
                  Submit Tier 3
                </Button>
              </div>

              {verification?.tier3?.adminNote ? (
                <p className="mt-2 text-[11px] text-red-700">Admin note: {String(verification.tier3.adminNote)}</p>
              ) : null}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}