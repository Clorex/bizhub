// FILE: src/app/vendor/more/page.tsx
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
  BadgeCheck,
  Sparkles,
  Send,
  BadgePercent,
  TicketPercent,
  ShoppingBag,
  Truck,
  ChevronRight,
  // ✅ ADDED
  Eye,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
// ✅ ADDED
import { isSmartMatchEnabled } from "@/lib/smartmatch/featureFlag";

function Group({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</p>
      {subtitle ? <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p> : null}
      <div className="mt-3 space-y-2">{children}</div>
    </Card>
  );
}

function Row({
  icon,
  title,
  desc,
  onClick,
  highlight,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  onClick: () => void;
  highlight?: boolean;
  // ✅ ADDED
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left rounded-2xl border p-3 transition",
        highlight
          ? "border-orange-200 bg-gradient-to-br from-orange-50 to-white hover:from-orange-100"
          : "border-gray-100 bg-white hover:bg-gray-50/50",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
            highlight ? "bg-gradient-to-br from-orange-500 to-orange-600" : "bg-orange-50",
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={highlight ? "text-sm font-bold text-orange-700" : "text-sm font-bold text-gray-900"}>{title}</p>
            {/* ✅ ADDED: optional badge */}
            {badge ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {badge}
              </span>
            ) : null}
          </div>
          {desc ? <p className="text-xs text-gray-500 mt-0.5">{desc}</p> : null}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
      </div>
    </button>
  );
}

export default function VendorMorePage() {
  const router = useRouter();
  // ✅ ADDED
  const smartMatchEnabled = isSmartMatchEnabled();

  async function logout() {
    await signOut(auth);
    router.push("/market");
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader title="More" subtitle="Tools, settings, and support" showBack={false} />

      <div className="px-4 pb-32 space-y-4">
        {/* Subscription at top */}
        <Group title="Your plan" subtitle="Manage subscription and add-ons">
          <Row
            icon={<Crown className="h-5 w-5 text-white" />}
            title="Subscription"
            desc="Manage your plan and billing"
            onClick={() => router.push("/vendor/subscription")}
            highlight
          />
          <Row
            icon={<ShoppingBag className="h-5 w-5 text-orange-600" />}
            title="Plan add-ons"
            desc="Buy extra features for your current plan"
            onClick={() => router.push("/vendor/purchases")}
          />
        </Group>

        <Group title="Your store" subtitle="Storefront and product management">
          <Row
            icon={<Store className="h-5 w-5 text-orange-600" />}
            title="Store settings"
            desc="Brand, location, WhatsApp, banner"
            onClick={() => router.push("/vendor/store")}
          />
          <Row
            icon={<BadgeCheck className="h-5 w-5 text-orange-600" />}
            title="Verification"
            desc="Get verified to build buyer trust"
            onClick={() => router.push("/vendor/verification")}
          />
          <Row
            icon={<Package className="h-5 w-5 text-orange-600" />}
            title="Products"
            desc="Create and manage your listings"
            onClick={() => router.push("/vendor/products")}
          />
          <Row
            icon={<Truck className="h-5 w-5 text-orange-600" />}
            title="Shipping"
            desc="Delivery and pickup options"
            onClick={() => router.push("/vendor/shipping")}
          />
        </Group>

        <Group title="Sales" subtitle="Orders, discounts, and performance">
          <Row
            icon={<ClipboardList className="h-5 w-5 text-orange-600" />}
            title="Orders"
            desc="View and manage your orders"
            onClick={() => router.push("/vendor/orders")}
          />
          <Row
            icon={<BadgePercent className="h-5 w-5 text-orange-600" />}
            title="Discounts"
            desc="Run sales on your products"
            onClick={() => router.push("/vendor/discounts")}
          />
          <Row
            icon={<TicketPercent className="h-5 w-5 text-orange-600" />}
            title="Coupon codes"
            desc="Discount codes for checkout"
            onClick={() => router.push("/vendor/coupon")}
          />
          <Row
            icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
            title="Best sellers"
            desc="See your top-performing products"
            onClick={() => router.push("/vendor/best-sellers")}
          />
        </Group>

        <Group title="Insights" subtitle="Analytics and AI tools">
          {/* ✅ ADDED: SmartMatch insights row */}
          {smartMatchEnabled ? (
            <Row
              icon={<Eye className="h-5 w-5 text-orange-600" />}
              title="Visibility & Match Score"
              desc="See what affects how buyers find you"
              onClick={() => router.push("/vendor/smartmatch")}
              badge="New"
            />
          ) : null}
          <Row
            icon={<Sparkles className="h-5 w-5 text-orange-600" />}
            title="Sales assistant"
            desc="Daily summary and tips"
            onClick={() => router.push("/vendor")}
          />
          <Row
            icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
            title="Business analysis"
            desc="Performance insights and trends"
            onClick={() => router.push("/vendor/analytics")}
          />
          <Row
            icon={<Send className="h-5 w-5 text-orange-600" />}
            title="Re-engagement"
            desc="Follow up with past buyers"
            onClick={() => router.push("/vendor/reengagement")}
          />
        </Group>

        <Group title="Growth">
          <Row
            icon={<Megaphone className="h-5 w-5 text-orange-600" />}
            title="Promotions"
            desc="Boost products in the marketplace"
            onClick={() => router.push("/vendor/promotions")}
          />
        </Group>

        <Group title="Team">
          <Row
            icon={<Users className="h-5 w-5 text-orange-600" />}
            title="Staff"
            desc="Invite and manage team access"
            onClick={() => router.push("/vendor/staff")}
          />
        </Group>

        <Group title="Money" subtitle="Balance and payouts">
          <Row
            icon={<Wallet className="h-5 w-5 text-orange-600" />}
            title="Balance"
            desc="Pending, available, and withdrawals"
            onClick={() => router.push("/vendor/wallet")}
          />
          <Row
            icon={<Banknote className="h-5 w-5 text-orange-600" />}
            title="Payout details"
            desc="Your bank account for withdrawals"
            onClick={() => router.push("/vendor/settings/payouts")}
          />
        </Group>

        <Group title="Account" subtitle="Settings and support">
          <Row
            icon={<Settings className="h-5 w-5 text-orange-600" />}
            title="Preferences"
            desc="Notifications and settings"
            onClick={() => router.push("/vendor/preferences")}
          />
          <Row
            icon={<Shield className="h-5 w-5 text-orange-600" />}
            title="Security"
            desc="Password and account safety"
            onClick={() => router.push("/vendor/security")}
          />
          <Row
            icon={<HelpCircle className="h-5 w-5 text-orange-600" />}
            title="Help"
            desc="Tips and support"
            onClick={() => router.push("/vendor/promote/faq")}
          />
        </Group>

        <Card className="p-4">
          <button
            className="w-full rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition"
            onClick={logout}
          >
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