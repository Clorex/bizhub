"use client";

import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";

import {
  Store,
  Package,
  ClipboardList,
  BarChart3,
  Wallet,
  Banknote,
  Settings,
  Shield,
  HelpCircle,
  LogOut,
  Crown,
  Megaphone,
  Users,
  MessageCircle,
  BadgeCheck,
  Sparkles,
  Send,
  BadgePercent,
  TicketPercent,
  ShoppingBag,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold text-gray-500">{title.toUpperCase()}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </Card>
  );
}

function Row({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-biz-ink">{title}</p>
          {desc ? <p className="text-xs text-biz-muted mt-1">{desc}</p> : null}
        </div>
        <div className="text-gray-400 font-bold">›</div>
      </div>
    </button>
  );
}

export default function VendorMorePage() {
  const router = useRouter();

  async function logout() {
    await signOut(auth);
    router.push("/market");
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="More" subtitle="Tools, settings, and support" showBack={false} />

      <div className="px-4 pb-6 space-y-3">
        <Group title="Store setup">
          <Row icon={<Store className="h-5 w-5 text-orange-700" />} title="Store settings" desc="Brand, location, WhatsApp & banner" onClick={() => router.push("/vendor/store")} />
          <Row icon={<BadgeCheck className="h-5 w-5 text-orange-700" />} title="Verification" desc="Tier 1 / Tier 2 / Tier 3" onClick={() => router.push("/vendor/verification")} />
          <Row icon={<MessageCircle className="h-5 w-5 text-orange-700" />} title="Checkout & Chat" desc="Continue in Chat (WhatsApp) settings" onClick={() => router.push("/vendor/store")} />
          <Row icon={<Package className="h-5 w-5 text-orange-700" />} title="Products" desc="Create and manage listings" onClick={() => router.push("/vendor/products")} />
        </Group>

        <Group title="Sales & operations">
          <Row icon={<Sparkles className="h-5 w-5 text-orange-700" />} title="Sales assistant" desc="Daily + weekly summary, dispute warnings" onClick={() => router.push("/vendor")} />
          <Row icon={<Send className="h-5 w-5 text-orange-700" />} title="Re‑engagement" desc="Message past buyers and follow up" onClick={() => router.push("/vendor/reengagement")} />
          <Row icon={<ClipboardList className="h-5 w-5 text-orange-700" />} title="Orders" desc="View and manage your orders" onClick={() => router.push("/vendor/orders")} />
          <Row icon={<BarChart3 className="h-5 w-5 text-orange-700" />} title="Business analysis" desc="Sales tips, insights & performance" onClick={() => router.push("/vendor/analytics")} />
          <Row icon={<BarChart3 className="h-5 w-5 text-orange-700" />} title="Best‑selling products" desc="Launch: Top 5 (7 days) • Momentum: Top 20 (30 days) • Apex: Top 50 (90 days)" onClick={() => router.push("/vendor/best-sellers")} />
          <Row icon={<BadgePercent className="h-5 w-5 text-orange-700" />} title="Sales" desc="Run discounts on products (shows on store & marketplace)" onClick={() => router.push("/vendor/discounts")} />
          <Row icon={<TicketPercent className="h-5 w-5 text-orange-700" />} title="Coupon codes" desc="Discount codes used at checkout" onClick={() => router.push("/vendor/coupon")} />
        </Group>

        <Group title="Team">
          <Row icon={<Users className="h-5 w-5 text-orange-700" />} title="Staff accounts" desc="Invite and manage staff access" onClick={() => router.push("/vendor/staff")} />
        </Group>

        <Group title="Growth tools">
          <Row icon={<Megaphone className="h-5 w-5 text-orange-700" />} title="Promotions" desc="Boost products like ads (1–5 products per campaign)" onClick={() => router.push("/vendor/promotions")} />
        </Group>

        <Group title="Payments">
          <Row icon={<Crown className="h-5 w-5 text-orange-700" />} title="Subscription" desc="Upgrade your plan to unlock more features" onClick={() => router.push("/vendor/subscription")} />

          {/* ✅ NEW */}
          <Row icon={<ShoppingBag className="h-5 w-5 text-orange-700" />} title="Plan purchases" desc="Buy add-ons and bundles based on your plan" onClick={() => router.push("/vendor/purchases")} />

          <Row icon={<Wallet className="h-5 w-5 text-orange-700" />} title="BizHub Balance" desc="Pending, available & withdrawals" onClick={() => router.push("/vendor/wallet")} />
          <Row icon={<Banknote className="h-5 w-5 text-orange-700" />} title="Payout details" desc="Bank name, account number, account name" onClick={() => router.push("/vendor/settings/payouts")} />
        </Group>

        <Group title="Account & support">
          <Row icon={<Settings className="h-5 w-5 text-orange-700" />} title="Preferences" desc="More settings coming soon" onClick={() => alert("Next: preferences, notifications, team accounts.")} />
          <Row icon={<Shield className="h-5 w-5 text-orange-700" />} title="Security" desc="Extra verification for withdrawals (coming)" onClick={() => alert("Next: security center & withdrawal verification.")} />
          <Row icon={<HelpCircle className="h-5 w-5 text-orange-700" />} title="Help & support" desc="How to sell more on BizHub" onClick={() => router.push("/vendor/promote/faq")} />
        </Group>

        <Card className="p-4">
          <button className="w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-red-600" onClick={logout}>
            <span className="inline-flex items-center gap-2 justify-center">
              <LogOut className="h-4 w-4" />
              Sign out
            </span>
          </button>
        </Card>
      </div>
    </div>
  );
}