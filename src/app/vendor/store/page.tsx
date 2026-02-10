// FILE: src/app/vendor/store/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MenuCard } from "@/components/vendor/MenuCard";
import { DetailSkeleton } from "@/components/vendor/PageSkeleton";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import {
  STORE_THEMES,
  getThemeById,
  getAvailableThemes,
  isThemeAvailable,
  getTierLabel,
  getTierColor,
  type StoreTheme,
  type ThemeTier,
} from "@/lib/themes/storeThemes";

import {
  RefreshCw,
  Save,
  Store,
  Palette,
  MapPin,
  MessageCircle,
  Instagram,
  ChevronRight,
  Lock,
  Sparkles,
  Check,
  Crown,
  Zap,
  ExternalLink,
  X,
  CreditCard,
  Tag,
} from "lucide-react";

export default function VendorStoreSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [business, setBusiness] = useState<any>(null);
  const [planKey, setPlanKey] = useState("FREE");
  const [canCustomize, setCanCustomize] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [themeId, setThemeId] = useState("classic");
  const [continueInChat, setContinueInChat] = useState(false);
  const [searchTags, setSearchTags] = useState("");

  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const availableThemes = useMemo(() => getAvailableThemes(planKey), [planKey]);
  const currentTheme = useMemo(() => getThemeById(themeId) || STORE_THEMES[0], [themeId]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in to view store settings.");

      const accessRes = await fetch("/api/vendor/access", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const accessData = await accessRes.json().catch(() => ({}));
      setPlanKey(String(accessData?.planKey || "FREE").toUpperCase());
      setCanCustomize(!!accessData?.features?.storeCustomize);

      const storeRes = await fetch("/api/vendor/store", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const storeData = await storeRes.json().catch(() => ({}));

      if (!storeRes.ok) {
        throw new Error(storeData?.error || "Could not load store settings.");
      }

      const biz = storeData.business;
      setBusiness(biz);

      setName(biz.name || "");
      setDescription(biz.description || "");
      setState(biz.state || "");
      setCity(biz.city || "");
      setWhatsapp(biz.whatsapp || "");
      setInstagram(biz.instagram || "");
      setLogoUrl(biz.logoUrl || "");
      setBannerUrl(biz.bannerUrl || "");
      setThemeId(biz.themeId || "classic");
      setContinueInChat(biz.continueInChatEnabled || false);
      setSearchTags(biz.searchTagsCsv || "");

      if (isRefresh) {
        toast.success("Settings refreshed!");
      }
    } catch (e: any) {
      setError(e?.message || "Could not load store settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      if (!isThemeAvailable(themeId, planKey)) {
        throw new Error("This theme is not available on your current plan.");
      }

      const res = await fetch("/api/vendor/store", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description,
          state: state.trim(),
          city: city.trim(),
          whatsapp: whatsapp.trim(),
          instagram: instagram.trim(),
          logoUrl,
          bannerUrl,
          themeId,
          continueInChatEnabled: continueInChat,
          searchTagsCsv: searchTags,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Could not save settings.");
      }

      toast.success("Store settings saved!");
    } catch (e: any) {
      toast.error(e?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }, [name, description, state, city, whatsapp, instagram, logoUrl, bannerUrl, themeId, continueInChat, searchTags, planKey]);

  const selectTheme = (theme: StoreTheme) => {
    if (!isThemeAvailable(theme.id, planKey)) {
      toast.info(`${theme.name} requires ${getTierLabel(theme.tier)} plan.`);
      return;
    }
    setThemeId(theme.id);
    setShowThemeSelector(false);
    toast.success(`Theme changed to ${theme.name}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Store Settings" subtitle="Loading..." showBack={true} />
        <DetailSkeleton />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Store Settings" subtitle="Error" showBack={true} />
        <div className="px-4 pt-4">
          <Card className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">Could not load settings</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <Button className="mt-6" onClick={() => load()}>
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <GradientHeader
        title="Store Settings"
        subtitle={business?.slug ? `@${business.slug}` : "Configure your store"}
        showBack={true}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
            {business?.slug && (
              <button
                onClick={() => router.push(`/b/${business.slug}`)}
                className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-orange-50 transition"
              >
                <ExternalLink className="w-5 h-5 text-orange-600" />
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {/* Theme Preview Card */}
        <div
          className="rounded-3xl overflow-hidden shadow-lg relative"
          style={{ background: currentTheme.headerGradient }}
        >
          {currentTheme.headerOverlay && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: currentTheme.headerOverlay }}
            />
          )}
          
          {currentTheme.hasAnimation && currentTheme.animationType === "shimmer" && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          )}

          {currentTheme.hasAnimation && currentTheme.animationType === "gradient" && (
            <div 
              className="absolute inset-0 animate-gradient"
              style={{ 
                background: currentTheme.headerGradient,
                backgroundSize: "200% 200%"
              }}
            />
          )}
          
          <div className="relative z-10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5" style={{ color: currentTheme.headerTextColor }} />
                <span
                  className="text-sm font-bold uppercase tracking-wider opacity-80"
                  style={{ color: currentTheme.headerTextColor }}
                >
                  Store Theme
                </span>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-bold",
                getTierColor(currentTheme.tier).bg,
                getTierColor(currentTheme.tier).text
              )}>
                {getTierLabel(currentTheme.tier)}
              </div>
            </div>

            <p
              className="text-2xl font-black"
              style={{ color: currentTheme.headerTextColor }}
            >
              {currentTheme.name}
            </p>
            <p
              className="text-sm mt-1 opacity-80"
              style={{ color: currentTheme.headerTextColor }}
            >
              {currentTheme.description}
            </p>

            <button
              onClick={() => setShowThemeSelector(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition"
              style={{ color: currentTheme.headerTextColor }}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-bold">Change Theme</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <SectionCard title="Basic Information" subtitle="Your store identity">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Store Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Amazing Store"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell customers what you sell..."
                rows={3}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1">{description.length}/500</p>
            </div>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard title="Location" subtitle="Help customers find you">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">State</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Lagos"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ikeja"
              />
            </div>
          </div>
        </SectionCard>

        {/* Contact */}
        <SectionCard title="Contact" subtitle="How customers reach you">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  WhatsApp Number
                </span>
              </label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="08012345678"
                type="tel"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-pink-600" />
                  Instagram Handle
                </span>
              </label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="mystore"
              />
            </div>
          </div>
        </SectionCard>

        {/* Branding */}
        <SectionCard
          title="Branding"
          subtitle={canCustomize ? "Customize your store look" : "Upgrade to customize"}
        >
          {!canCustomize ? (
            <Card className="p-4 bg-orange-50 border-orange-200">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-800">
                    Custom branding is a premium feature
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Upgrade to upload custom logo and banner.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/vendor/subscription")}
                    leftIcon={<Zap className="w-4 h-4" />}
                  >
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Store Logo
                </label>
                <ImageUploader
                  value={logoUrl ? [logoUrl] : []}
                  onChange={(urls) => setLogoUrl(urls[0] || "")}
                  max={1}
                  multiple={false}
                  folderBase="bizhub/logos"
                  aspectKey="1:1"
                  allowFreeAspect={false}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Store Banner
                </label>
                <ImageUploader
                  value={bannerUrl ? [bannerUrl] : []}
                  onChange={(urls) => setBannerUrl(urls[0] || "")}
                  max={1}
                  multiple={false}
                  folderBase="bizhub/banners"
                  aspectKey="16:9"
                  allowFreeAspect={false}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Search Tags */}
        <SectionCard title="Search Tags" subtitle="Help customers discover you">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Keywords (comma separated)
            </label>
            <Input
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              placeholder="fashion, clothes, shoes, lagos"
            />
            <p className="text-xs text-gray-400 mt-1">
              Add keywords that describe your products
            </p>
          </div>
        </SectionCard>

        {/* More Settings */}
        <SectionCard title="More Settings" subtitle="Additional options">
          <div className="space-y-2">
            <MenuCard
              icon={CreditCard}
              label="Bank Account"
              description="Set up payout details"
              href="/vendor/payouts"
            />
            <MenuCard
              icon={Tag}
              label="Coupons"
              description="Create discount codes"
              href="/vendor/coupons"
            />
            <MenuCard
              icon={Crown}
              label="Subscription"
              description={`Current plan: ${planKey}`}
              href="/vendor/subscription"
            />
          </div>
        </SectionCard>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={save}
            loading={saving}
            disabled={saving || !name.trim()}
            className="w-full"
            leftIcon={<Save className="w-5 h-5" />}
          >
            Save Settings
          </Button>
        </div>
      </div>

      {/* Theme Selector Modal */}
      {showThemeSelector && (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0" onClick={() => setShowThemeSelector(false)} />
          
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-3xl bg-white animate-slideUp">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Choose Theme</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Transform your storefront</p>
                </div>
                <button
                  onClick={() => setShowThemeSelector(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Your plan:</span>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold",
                  planKey === "APEX" ? "bg-purple-100 text-purple-700" :
                  planKey === "MOMENTUM" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                )}>
                  {planKey}
                </span>
              </div>
            </div>

            {/* Theme List */}
            <div className="overflow-y-auto max-h-[70vh] px-4 py-4 pb-safe space-y-6">
              {/* Free Themes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gray-900">Free Themes</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {STORE_THEMES.filter(t => t.tier === "free").map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isActive={theme.id === themeId}
                      isAvailable={isThemeAvailable(theme.id, planKey)}
                      onSelect={() => selectTheme(theme)}
                    />
                  ))}
                </div>
              </div>

              {/* Momentum Themes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gray-900">Momentum Themes</span>
                  {!["MOMENTUM", "APEX"].includes(planKey) && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Momentum+
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {STORE_THEMES.filter(t => t.tier === "momentum").map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isActive={theme.id === themeId}
                      isAvailable={isThemeAvailable(theme.id, planKey)}
                      onSelect={() => selectTheme(theme)}
                      onUpgrade={() => router.push("/vendor/subscription")}
                    />
                  ))}
                </div>
              </div>

              {/* Apex Themes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gray-900">Apex Themes</span>
                  {planKey !== "APEX" && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Apex Only
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {STORE_THEMES.filter(t => t.tier === "apex").map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isActive={theme.id === themeId}
                      isAvailable={isThemeAvailable(theme.id, planKey)}
                      onSelect={() => selectTheme(theme)}
                      onUpgrade={() => router.push("/vendor/subscription")}
                    />
                  ))}
                </div>
              </div>

              {/* Upgrade CTA */}
              {planKey !== "APEX" && (
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">Unlock All Themes</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Upgrade to Apex for animated themes and premium designs.
                      </p>
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setShowThemeSelector(false);
                          router.push("/vendor/subscription");
                        }}
                        rightIcon={<ChevronRight className="w-4 h-4" />}
                      >
                        View Plans
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Theme Card Component */
function ThemeCard({
  theme,
  isActive,
  isAvailable,
  onSelect,
  onUpgrade,
}: {
  theme: StoreTheme;
  isActive: boolean;
  isAvailable: boolean;
  onSelect: () => void;
  onUpgrade?: () => void;
}) {
  return (
    <button
      onClick={() => isAvailable ? onSelect() : onUpgrade?.()}
      className={cn(
        "rounded-2xl overflow-hidden border-2 transition-all text-left",
        isActive
          ? "border-orange-500 ring-2 ring-orange-200"
          : isAvailable
          ? "border-gray-200 hover:border-orange-300"
          : "border-gray-200 opacity-70"
      )}
    >
      {/* Preview */}
      <div
        className="h-20 relative overflow-hidden"
        style={{ background: theme.headerGradient }}
      >
        {theme.hasAnimation && (
          <div className="absolute top-2 right-2">
            <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </span>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
        )}

        {isActive && (
          <div className="absolute top-2 left-2">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 bg-white">
        <p className="text-xs font-bold text-gray-900 truncate">{theme.name}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{theme.description}</p>
      </div>
    </button>
  );
}