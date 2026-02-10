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
import { Shield, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type IdType = "nin" | "drivers_licence" | "voters_card" | "passport";

function TierBadge({ tier }: { tier: number }) {
  const t = Number(tier || 0);

  const config = {
    0: { label: "Unverified", cls: "bg-gray-50 text-gray-600 border-gray-200" },
    1: { label: "Basic Verified", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    2: { label: "Verified Information Submitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    3: { label: "Trusted Vendor", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  }[t] || { label: "Unverified", cls: "bg-gray-50 text-gray-600 border-gray-200" };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border", config.cls)}>
      <Shield className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
        <Clock className="w-3.5 h-3.5" />
        Under Review
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
        <AlertCircle className="w-3.5 h-3.5" />
        Needs Resubmission
      </span>
    );
  }
  return (
    <span className="text-xs font-bold text-gray-500">Not started</span>
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
      setMsg("Basic verification completed. Your trust level has increased.");
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
      setMsg("Information submitted. Our team will review within 8 hours.");
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
      setMsg("Address documentation submitted. Our team will review within 8 hours.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="Verification"
        subtitle="Build trust with your customers"
        showBack={true}
      />

      <div className="px-4 pb-24 space-y-4 pt-4">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">{msg}</p>
          </Card>
        ) : null}

        {!loading ? (
          <>
            {/* Status Card */}
            <div className="rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-100">
                  Your Trust Level
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <TierBadge tier={tier} />
                  {openDisputes > 0 && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border bg-red-50 text-red-700 border-red-100">
                      <AlertCircle className="w-3 h-3" />
                      {openDisputes} open dispute{openDisputes !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-orange-100 mt-3 leading-relaxed">
                  Verification helps customers feel safer and improves your visibility in the marketplace.
                </p>
              </div>
            </div>

            {/* ── Tier 1: Basic Presence ── */}
            <SectionCard
              title="Basic Verified"
              subtitle="Confirm your presence with a clear selfie"
              right={<StatusPill status={t1Status} />}
            >
              <p className="text-xs text-gray-500 leading-relaxed">
                Take a clear photo of your face in good lighting. This confirms a real person
                is behind your store and helps prevent fake accounts.
              </p>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
                <ImageUploader
                  label="Upload selfie photo"
                  multiple={true}
                  onUploaded={(urls) => setSelfieUrls((prev) => [...prev, ...urls].slice(0, 6))}
                />

                {selfieUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {selfieUrls.map((u) => (
                      <div key={u} className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Selfie" className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {t1Status !== "verified" && (
                <div className="mt-3 flex justify-end">
                  <Button onClick={submitTier1} loading={saving} disabled={saving || selfieUrls.length < 1}>
                    Submit
                  </Button>
                </div>
              )}

              {t1Status === "verified" && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-xs text-green-700 font-medium">
                    ✓ Basic verification complete. You can now list products.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* ── Tier 2: Identity Information ── */}
            <SectionCard
              title="Verified Information Submitted"
              subtitle="Submit your government-issued ID number"
              right={<StatusPill status={t2Status} />}
            >
              <p className="text-xs text-gray-500 leading-relaxed">
                Providing your ID information raises accountability and unlocks full marketplace visibility.
                Your information is submitted and reviewed — myBizHub does not claim identity is confirmed.
              </p>

              <div className="mt-3">
                <SegmentedControl<IdType>
                  value={idType}
                  onChange={setIdType}
                  options={[
                    { value: "nin", label: "NIN" },
                    { value: "drivers_licence", label: "Driver's" },
                    { value: "voters_card", label: "Voter's" },
                    { value: "passport", label: "Passport" },
                  ]}
                />
              </div>

              <div className="mt-2">
                <Input
                  placeholder="Enter your ID number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  disabled={t2Status === "verified"}
                />
              </div>

              {verification?.tier2?.adminNote && (
                <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs text-red-700">
                    <b>Note:</b> {String(verification.tier2.adminNote)}
                  </p>
                </div>
              )}

              {t2Status !== "verified" && (
                <div className="mt-3 flex justify-end">
                  <Button onClick={submitTier2} loading={saving} disabled={saving || idNumber.trim().length < 5}>
                    Submit for Review
                  </Button>
                </div>
              )}

              {t2Status === "verified" && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-xs text-green-700 font-medium">
                    ✓ Information submitted and reviewed. You have full marketplace access.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* ── Tier 3: Address Confidence ── */}
            <SectionCard
              title="Trusted Vendor"
              subtitle="Provide proof of address for premium trust status"
              right={<StatusPill status={t3Status} />}
            >
              <p className="text-xs text-gray-500 leading-relaxed">
                This is optional but recommended. Upload a utility bill, bank statement, or similar
                document showing your address. Trusted Vendors receive higher ranking and a trust badge.
              </p>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
                <ImageUploader
                  label="Upload proof of address"
                  multiple={true}
                  onUploaded={(urls) => setProofUrls((prev) => [...prev, ...urls].slice(0, 6))}
                />

                {proofUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {proofUrls.map((u) => (
                      <div key={u} className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Proof" className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {verification?.tier3?.adminNote && (
                <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs text-red-700">
                    <b>Note:</b> {String(verification.tier3.adminNote)}
                  </p>
                </div>
              )}

              {t3Status !== "verified" && (
                <div className="mt-3 flex justify-end">
                  <Button onClick={submitTier3} loading={saving} disabled={saving || proofUrls.length < 1}>
                    Submit for Review
                  </Button>
                </div>
              )}

              {t3Status === "verified" && (
                <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs text-emerald-700 font-medium">
                    ✓ Trusted Vendor status achieved. You receive priority exposure and a trust badge.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* Why Verify CTA */}
            {tier < 2 && (
              <Card className="p-5 bg-gradient-to-br from-blue-50 to-orange-50 border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Why verify?</p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      Verified vendors receive more customer engagement and visibility.
                      Buyers are more likely to trust and purchase from vendors who
                      have completed verification.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}