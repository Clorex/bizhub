"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";

type Perms = {
  productsView: boolean;
  productsManage: boolean;
  ordersView: boolean;
  ordersManage: boolean;
  analyticsView: boolean;
  storeManage: boolean;
  walletAccess: boolean;
  payoutAccess: boolean;
};

const DEFAULT_PERMS: Perms = {
  productsView: true,
  productsManage: false,
  ordersView: true,
  ordersManage: false,
  analyticsView: true,
  storeManage: false,
  walletAccess: false,
  payoutAccess: false,
};

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (!disabled ? onChange(!value) : undefined)}
      className={[
        "w-full rounded-2xl border p-3 flex items-center justify-between",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-black/[0.02]",
        "border-biz-line bg-white transition",
      ].join(" ")}
    >
      <span className="text-sm font-bold text-biz-ink">{label}</span>
      <span
        className={
          value
            ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
            : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
        }
      >
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export default function VendorStaffPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<any>(null);

  const [staff, setStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  // invite form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<Perms>(DEFAULT_PERMS);
  const [creating, setCreating] = useState(false);

  const isOwner = useMemo(() => String(me?.role || "") === "owner", [me]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    try {
      // get role
      const token = await auth.currentUser?.getIdToken();
      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
      setMe(meData.me);

      // owner-only endpoint
      const data = await authedFetch("/api/vendor/staff");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load staff");
      setStaff([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite() {
    setCreating(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/vendor/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, permissions: perms }),
      });

      const link = String(data.inviteLink || "");
      if (link) {
        try {
          await navigator.clipboard.writeText(link);
          setMsg("Invite created. Link copied to clipboard.");
        } catch {
          setMsg("Invite created. Copy link manually: " + link);
        }
      } else {
        setMsg("Invite created.");
      }

      setName("");
      setEmail("");
      setPerms(DEFAULT_PERMS);
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!confirm("Revoke this invite?")) return;
    try {
      await authedFetch(`/api/vendor/staff?inviteId=${encodeURIComponent(inviteId)}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  async function removeStaff(staffUid: string) {
    if (!confirm("Remove this staff member?")) return;
    try {
      await authedFetch(`/api/vendor/staff?staffUid=${encodeURIComponent(staffUid)}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Staff"
        subtitle="Invite and manage team access"
        showBack={true}
        right={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {!loading && !isOwner ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Owner only</p>
            <p className="text-xs text-biz-muted mt-1">
              Staff management is available to the business owner only.
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => router.push("/vendor")}>
                Back to dashboard
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && isOwner ? (
          <>
            <SectionCard title="Invite staff" subtitle="Send an invite link to a staff email">
              <div className="space-y-2">
                <Input placeholder="Staff name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Staff email" value={email} onChange={(e) => setEmail(e.target.value)} />

                <div className="rounded-2xl border border-biz-line bg-white p-3">
                  <p className="text-sm font-bold text-biz-ink">Permissions</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Owner-only: store settings, wallet, payouts.
                  </p>

                  <div className="mt-3 space-y-2">
                    <Toggle label="View products" value={perms.productsView} onChange={(v) => setPerms((p) => ({ ...p, productsView: v }))} />
                    <Toggle label="Manage products" value={perms.productsManage} onChange={(v) => setPerms((p) => ({ ...p, productsManage: v }))} />

                    <Toggle label="View orders" value={perms.ordersView} onChange={(v) => setPerms((p) => ({ ...p, ordersView: v }))} />
                    <Toggle label="Manage orders" value={perms.ordersManage} onChange={(v) => setPerms((p) => ({ ...p, ordersManage: v }))} />

                    <Toggle label="View analytics" value={perms.analyticsView} onChange={(v) => setPerms((p) => ({ ...p, analyticsView: v }))} />
                  </div>
                </div>

                <Button onClick={createInvite} loading={creating} disabled={creating || !email.trim()}>
                  Create invite
                </Button>

                <p className="text-[11px] text-biz-muted">
                  Staff must login with the invited email, then open the invite link to join your business.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Pending invites" subtitle="Revoke if needed">
              {invites.length === 0 ? (
                <p className="text-sm text-biz-muted">No invites yet.</p>
              ) : (
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="rounded-2xl border border-biz-line bg-white p-3">
                      <p className="text-sm font-bold text-biz-ink">{inv.email || "—"}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Status: <b className="text-biz-ink">{inv.status || "pending"}</b>
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            const link = `${window.location.origin}/account/invite?code=${encodeURIComponent(inv.id)}`;
                            try {
                              await navigator.clipboard.writeText(link);
                              alert("Invite link copied");
                            } catch {
                              alert("Copy failed. Link: " + link);
                            }
                          }}
                        >
                          Copy link
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => revokeInvite(inv.id)}>
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Staff members" subtitle="Active team access">
              {staff.length === 0 ? (
                <p className="text-sm text-biz-muted">No staff members yet.</p>
              ) : (
                <div className="space-y-2">
                  {staff.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-biz-line bg-white p-3">
                      <p className="text-sm font-bold text-biz-ink">{s.email || s.id}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Status: <b className="text-biz-ink">{s.status || "active"}</b>
                      </p>

                      <div className="mt-2">
                        <Button variant="danger" size="sm" onClick={() => removeStaff(s.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}