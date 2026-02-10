// FILE: src/app/account/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  User,
  Mail,
  ShoppingBag,
  Package,
  Settings,
  LogOut,
  ChevronRight,
  Store,
  BarChart3,
  Plus,
  Shield,
  Bell,
  HelpCircle,
  Heart,
  Loader2,
} from "lucide-react";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";

type AppRole = "customer" | "owner" | "staff" | "admin";

interface MenuItem {
  icon: any;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  destructive?: boolean;
}

function MenuCard({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  const Component = item.href ? Link : "button";
  const props = item.href
    ? { href: item.href }
    : { onClick: item.onClick, type: "button" as const };

  return (
    <Component
      {...(props as any)}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition text-left",
        item.destructive && "hover:border-red-200"
      )}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          item.destructive ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold",
          item.destructive ? "text-red-600" : "text-gray-900"
        )}>
          {item.label}
        </p>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
        )}
      </div>
      {item.badge && (
        <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
          {item.badge}
        </span>
      )}
      <ChevronRight className={cn(
        "w-5 h-5 shrink-0",
        item.destructive ? "text-red-300" : "text-gray-300"
      )} />
    </Component>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: any;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-white/20 hover:bg-white/30 rounded-xl p-3 text-left transition"
    >
      <Icon className="w-5 h-5 text-white/80 mb-2" />
      <p className="text-xs text-white/80">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">{value}</p>
    </button>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      if (!u) {
        setRole("customer");
        setBusinessSlug(null);
        return;
      }

      try {
        const token = await u.getIdToken();
        const r = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));

        setRole((data?.me?.role as AppRole) || "customer");
        setBusinessSlug(data?.me?.businessSlug || null);
      } catch {
        setRole("customer");
        setBusinessSlug(null);
      }
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      router.push("/market");
    } catch (e: any) {
      toast.error("Failed to logout");
    }
  };

  const isVendor = role === "owner" || role === "staff";
  const isAdmin = role === "admin";
  const email = user?.email || "";
  const displayName = user?.displayName || email.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Menu items based on role
  const customerItems: MenuItem[] = [
    {
      icon: Package,
      label: "My Orders",
      description: "Track your purchases",
      href: "/orders",
    },
    {
      icon: ShoppingBag,
      label: "Shopping Cart",
      description: "View items in cart",
      href: "/cart",
    },
    {
      icon: Heart,
      label: "Favorites",
      description: "Saved products",
      href: "/favorites",
    },
  ];

  const vendorItems: MenuItem[] = [
    {
      icon: Store,
      label: "My Store",
      description: "Manage your storefront",
      href: `/b/${businessSlug}`,
    },
    {
      icon: Package,
      label: "Products",
      description: "Manage your listings",
      href: "/vendor/products",
    },
    {
      icon: Plus,
      label: "Add Product",
      description: "Create new listing",
      href: "/vendor/products/new",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      description: "View business insights",
      href: "/vendor/analytics",
    },
    {
      icon: Settings,
      label: "Store Settings",
      description: "Configure your store",
      href: "/vendor/store",
    },
  ];

  const settingsItems: MenuItem[] = [
    {
      icon: Bell,
      label: "Notifications",
      description: "Manage message preferences",
      href: "/account/notifications",
    },
    {
      icon: Shield,
      label: "Security",
      description: "Password & account security",
      href: "/account/security",
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      description: "Get assistance",
      href: "/help",
    },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Profile" subtitle="Loading..." showBack={false} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Profile" subtitle="Your account" showBack={false} />

        <div className="px-4 pt-4 pb-24">
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Welcome to myBizHub</h2>
                <p className="text-sm text-orange-100 mt-1">
                  Login to track orders and access more features
                </p>
              </div>
            </div>
          </div>

          {/* Auth Actions */}
          <Card className="p-4 space-y-3">
            <Button
              className="w-full"
              onClick={() => router.push("/account/login")}
            >
              Login
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/account/register")}
            >
              Create Account
            </Button>
          </Card>

          {/* Quick Links */}
          <div className="mt-4 space-y-2">
            <MenuCard
              item={{
                icon: ShoppingBag,
                label: "Browse Marketplace",
                description: "Discover products and vendors",
                href: "/market",
              }}
            />
            <MenuCard
              item={{
                icon: HelpCircle,
                label: "Help & Support",
                description: "Get assistance",
                href: "/help",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Logged in state
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GradientHeader title="Profile" subtitle="Your account" showBack={false} />

      <div className="px-4 pt-4 space-y-4">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{displayName}</h2>
                <p className="text-sm text-orange-100 truncate">{email}</p>
                {isVendor && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-white/20 text-xs font-medium">
                    <Store className="w-3 h-3" />
                    Vendor Account
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-white/20 text-xs font-medium">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 flex gap-3">
              <QuickStat
                icon={Package}
                label="Orders"
                value="View"
                onClick={() => router.push("/orders")}
              />
              <QuickStat
                icon={ShoppingBag}
                label="Cart"
                value="Open"
                onClick={() => router.push("/cart")}
              />
              <QuickStat
                icon={isVendor ? BarChart3 : Heart}
                label={isVendor ? "Analytics" : "Saved"}
                value="View"
                onClick={() => router.push(isVendor ? "/vendor/analytics" : "/favorites")}
              />
            </div>
          </div>
        </div>

        {/* Vendor Dashboard Link */}
        {isVendor && (
          <Card className="p-4">
            <Button
              className="w-full"
              onClick={() => router.push("/vendor")}
              leftIcon={<BarChart3 className="w-4 h-4" />}
            >
              Go to Vendor Dashboard
            </Button>
          </Card>
        )}

        {/* Admin Dashboard Link */}
        {isAdmin && (
          <Card className="p-4">
            <Button
              className="w-full"
              onClick={() => router.push("/admin")}
              leftIcon={<Shield className="w-4 h-4" />}
            >
              Go to Admin Dashboard
            </Button>
          </Card>
        )}

        {/* Customer Menu */}
        <SectionCard title="Shopping" subtitle="Your activity">
          <div className="space-y-2">
            {customerItems.map((item) => (
              <MenuCard key={item.label} item={item} />
            ))}
          </div>
        </SectionCard>

        {/* Vendor Menu */}
        {isVendor && (
          <SectionCard title="Vendor Tools" subtitle="Manage your business">
            <div className="space-y-2">
              {vendorItems.map((item) => (
                <MenuCard key={item.label} item={item} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Settings */}
        <SectionCard title="Settings" subtitle="Account preferences">
          <div className="space-y-2">
            {settingsItems.map((item) => (
              <MenuCard key={item.label} item={item} />
            ))}
          </div>
        </SectionCard>

        {/* Logout */}
        <div className="pt-2">
          <MenuCard
            item={{
              icon: LogOut,
              label: "Logout",
              description: "Sign out of your account",
              onClick: handleLogout,
              destructive: true,
            }}
          />
        </div>

        {/* App Version */}
        <p className="text-center text-xs text-gray-400 pt-4">
          myBizHub v1.0.0
        </p>
      </div>
    </div>
  );
}