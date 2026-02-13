// FILE: src/app/vendor/verification/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { Shield, CheckCircle2, Clock, AlertCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/ui/toast";

type IdType = "nin" | "drivers_licence" | "voters_card" | "passport";

const SELFIE_DRAFT_KEY = "bizhub_vendor_verification_selfies_v1";
const PROOF_DRAFT_KEY = "bizhub_vendor_verification_proof_v1";

function readSessionUrls(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeSessionUrls(key: string, urls: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(urls || []));
  } catch {}
}

function clearSessionUrls(key: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function TierBadge({ tier }: { tier: number }) {
  const t = Number(tier || 0);

  const config =
    ({
      0: { label: "Unverified", cls: "bg-gray-50 text-gray-600 border-gray-200" },
      1: { label: "Basic Verified", cls: "bg-orange-50 text-orange-700 border-orange-200" },
      2: { label: "Verified Information Submitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
      3: { label: "Trusted Vendor", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    } as any)[t] || { label: "Unverified", cls: "bg-gray-50 text-gray-600 border-gray-200" };

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
  return <span className="text-xs font-bold text-gray-500">Not started</span>;
}

export default function VendorVerificationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tier, setTier] = useState<number>(0);
  const [verification, setVerification] = useState<any>(null);
  const [trust, setTrust] = useState<any>(null);

  // Tier 1
  const [selfieUrls, setSelfieUrls] = useState<string[]>(() => readSessionUrls(SELFIE_DRAFT_KEY));

  // Tier 2
  const [idType, setIdType] = useState<IdType>("nin");
  const [idNumber, setIdNumber] = useState<string>("");

  // Tier 3
  const [proofUrls, setProofUrls] = useState<string[]>(() => readSessionUrls(PROOF_DRAFT_KEY));

  useEffect(() => {
    writeSessionUrls(SELFIE_DRAFT_KEY, selfieUrls);
  }, [selfieUrls]);

  useEffect(() => {
    writeSessionUrls(PROOF_DRAFT_KEY, proofUrls);
  }, [proofUrls]);

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

      // Only hydrate from server if no local draft exists (persistence requirement)
      const t1 = data?.verification?.tier1;
      const draftSelfies = readSessionUrls(SELFIE_DRAFT_KEY);
      if (draftSelfies.length) setSelfieUrls(draftSelfies);
      else if (t1?.selfieUrls?.length) setSelfieUrls(t1.selfieUrls);

      const t2 = data?.verification?.tier2;
      if (t2?.idType) setIdType(String(t2.idType) as any);
      if (t2?.idNumber) setIdNumber(String(t2.idNumber));

      const t3 = data?.verification?.tier3;
      const draftProof = readSessionUrls(PROOF_DRAFT_KEY);
      if (draftProof.length) setProofUrls(draftProof);
      else if (t3?.proofUrls?.length) setProofUrls(t3.proofUrls);
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

      clearSessionUrls(SELFIE_DRAFT_KEY);
      toast.success("Submitted!");
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
      toast.success("Submitted!");
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

      clearSessionUrls(PROOF_DRAFT_KEY);
      toast.success("Submitted!");
      setMsg("Address documentation submitted. Our team will review within 8 hours.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  function openAddPicture(opts: { key: string; title: string; subtitle: string; folderBase: string; max: number }) {
    const qs = new URLSearchParams();
    qs.set("k", opts.key);
    qs.set("returnTo", "/vendor/verification");
    qs.set("title", opts.title);
    qs.set("subtitle", opts.subtitle);
    qs.set("folderBase", opts.folderBase);
    qs.set("max", String(opts.max));
    qs.set("multiple", "true");
    router.push(`/vendor/add-picture?${qs.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader title="Verification" subtitle="Build trust with your customers" showBack={true} />

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
                <p className="text-xs font-bold uppercase tracking-widest text-orange-100">Your Trust Level</p>
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

            {/* Tier 1 */}
            <SectionCard title="Basic Verified" subtitle="Confirm your presence with a clear selfie" right={<StatusPill status={t1Status} />}>
              <p className="text-xs text-gray-500 leading-relaxed">
                Take a clear photo of your face in good lighting. This confirms a real person is behind your store and helps prevent fake accounts.
              </p>

              {/* B11-3: Add Picture is a full page */}
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() =>
                    openAddPicture({
                      key: SELFIE_DRAFT_KEY,
                      title: "Add Picture",
                      subtitle: "Upload selfie photo",
                      folderBase: "bizhub/verification/selfie",
                      max: 6,
                    })
                  }
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add picture
                </Button>
              </div>

              {selfieUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {selfieUrls.map((u) => (
                    <div key={u} className="rounded-2xl border border-gray-200 overflow-hidden bg-white relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Selfie" className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSelfieUrls((prev) => prev.filter((x) => x !== u))}
                        className="absolute top-1 right-1 bg-white/95 border border-gray-200 rounded-xl p-1.5"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {t1Status !== "verified" && (
                <div className="mt-3 flex justify-end">
                  <Button onClick={submitTier1} loading={saving} disabled={saving || selfieUrls.length < 1}>
                    Submit
                  </Button>
                </div>
              )}

              {t1Status === "verified" && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-xs text-green-700 font-medium">✓ Basic verification complete. You can now list products.</p>
                </div>
              )}
            </SectionCard>

            {/* Tier 2 */}
            <SectionCard
              title="Verified Information Submitted"
              subtitle="Submit your government-issued ID number"
              right={<StatusPill status={t2Status} />}
            >
              <p className="text-xs text-gray-500 leading-relaxed">
                Providing your ID information raises accountability and unlocks full marketplace visibility. Your information is submitted and reviewed — myBizHub does not claim identity is confirmed.
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
                  <p className="text-xs text-green-700 font-medium">✓ Information submitted and reviewed. You have full marketplace access.</p>
                </div>
              )}
            </SectionCard>

            {/* Tier 3 */}
            <SectionCard
              title="Trusted Vendor"
              subtitle="Provide proof of address for premium trust status"
              right={<StatusPill status={t3Status} />}
            >
              <p className="text-xs text-gray-500 leading-relaxed">
                This is optional but recommended. Upload a utility bill, bank statement, or similar document showing your address. Trusted Vendors receive higher ranking and a trust badge.
              </p>

              {/* B11-3: Add Picture is a full page */}
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() =>
                    openAddPicture({
                      key: PROOF_DRAFT_KEY,
                      title: "Add Picture",
                      subtitle: "Upload proof of address",
                      folderBase: "bizhub/verification/proof",
                      max: 6,
                    })
                  }
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add picture
                </Button>
              </div>

              {proofUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {proofUrls.map((u) => (
                    <div key={u} className="rounded-2xl border border-gray-200 overflow-hidden bg-white relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Proof" className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProofUrls((prev) => prev.filter((x) => x !== u))}
                        className="absolute top-1 right-1 bg-white/95 border border-gray-200 rounded-xl p-1.5"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                      Verified vendors receive more customer engagement and visibility. Buyers are more likely to trust and purchase from vendors who have completed verification.
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