"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  MessageCircle,
  Lightbulb,
  ChevronDown,
  HelpCircle,
  Store,
  Package,
  ClipboardList,
  CreditCard,
  Wallet,
  Crown,
  Megaphone,
  TrendingUp,
  Shield,
} from "lucide-react";

type TopicKey =
  | "getting_started"
  | "products"
  | "orders"
  | "payments"
  | "payouts"
  | "subscription"
  | "promotions"
  | "growth"
  | "security";

type Faq = { q: string; a: string };

const TOPIC_ICONS: Record<TopicKey, any> = {
  getting_started: Store,
  products: Package,
  orders: ClipboardList,
  payments: CreditCard,
  payouts: Wallet,
  subscription: Crown,
  promotions: Megaphone,
  growth: TrendingUp,
  security: Shield,
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "w-full text-left rounded-2xl border bg-white p-4 transition",
        open ? "border-orange-200 bg-orange-50/30" : "border-gray-100 hover:bg-gray-50/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-gray-900 flex-1">{q}</p>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </div>
      {open && (
        <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">{a}</p>
      )}
    </button>
  );
}

export default function VendorHelpCenterPage() {
  const router = useRouter();

  const [topic, setTopic] = useState<TopicKey>("getting_started");

  const topics = useMemo(
    () =>
      [
        { key: "getting_started", title: "Getting started", subtitle: "Set up your store" },
        { key: "products", title: "Products", subtitle: "Listings & photos" },
        { key: "orders", title: "Orders", subtitle: "Status & delivery" },
        { key: "payments", title: "Payments", subtitle: "Checkout issues" },
        { key: "payouts", title: "Withdrawals", subtitle: "Wallet & payouts" },
        { key: "subscription", title: "Plans", subtitle: "Upgrades & limits" },
        { key: "promotions", title: "Promotions", subtitle: "Boosting products" },
        { key: "growth", title: "Growth tips", subtitle: "Get more sales" },
        { key: "security", title: "Security", subtitle: "Account safety" },
      ] as const,
    []
  );

  const faqsByTopic: Record<TopicKey, Faq[]> = {
    getting_started: [
      {
        q: "How do I share my store link?",
        a: "Open your vendor dashboard, then copy your store link and share it on WhatsApp, Instagram, Facebook, or anywhere your customers are.\n\nTip: Share your store link first, then share individual product links for best results.",
      },
      {
        q: "Why can't customers see my products?",
        a: "Check these:\n• Your products have photos and a price\n• Your product is not out of stock\n• Your marketplace setting is ON\n\nIf it still doesn't show, contact support.",
      },
      {
        q: "What should I do first after signing up?",
        a: "Best order:\n1. Add 5–10 products with clear photos\n2. Set correct price and stock\n3. Add your WhatsApp number in store settings\n4. Share your store link with your customers",
      },
    ],
    products: [
      {
        q: "How many photos should I upload?",
        a: "1 photo is enough to start, but 3–5 photos sell better.\n\nUse clear photos with good lighting. Make the first photo your best one.",
      },
      {
        q: "What are variations?",
        a: "Variations help customers choose options like size, color, weight, or model.\n\nIf your product has different options, add variations so customers know exactly what they're buying.",
      },
      {
        q: "Why is my product showing 'out of stock'?",
        a: "That means the stock number is 0.\n\nUpdate the stock in the product editor, then save.",
      },
    ],
    orders: [
      {
        q: "Where do I see new orders?",
        a: "Go to Vendor → Orders.\n\nYou'll see the newest orders at the top.",
      },
      {
        q: "A customer says they paid but I can't see it",
        a: "Ask the customer to confirm they completed payment.\n\nIf you have a payment reference, contact support so we can check the status.",
      },
      {
        q: "How do disputes work?",
        a: "If there's an issue, a dispute can be opened so the order can be reviewed fairly.\n\nAlways keep your proof (chat screenshots, receipts). This helps resolve disputes faster.",
      },
    ],
    payments: [
      {
        q: "My customer's payment failed. What can we do?",
        a: "Tell the customer to try again.\n\nIf it still fails:\n• Use a different card\n• Check network connection\n• Try bank transfer option",
      },
      {
        q: "Do customers abroad need a special card?",
        a: "Most international cards work.\n\nSometimes a bank blocks online payments. The customer should enable online/international payments in their banking app.",
      },
    ],
    payouts: [
      {
        q: "How do I withdraw my money?",
        a: "Go to your Wallet/Balance page and follow the withdrawal steps.\n\nMake sure your payout details (bank account) are correct before withdrawing.",
      },
      {
        q: "Why can't I withdraw yet?",
        a: "This can happen if:\n• Your payout details are missing\n• There's a pending review\n• Your account needs verification\n\nContact support for help.",
      },
      {
        q: "How long does withdrawal take?",
        a: "Withdrawals usually arrive within 1–3 business days.\n\nIf it takes longer, contact support with your withdrawal reference.",
      },
    ],
    subscription: [
      {
        q: "What changes after I upgrade?",
        a: "Upgrades unlock higher limits and more tools (more products, more analytics, staff accounts, etc.).\n\nYour plan determines what features you can use.",
      },
      {
        q: "I paid but my plan didn't change",
        a: "Sometimes it takes a moment to sync.\n\nIf it doesn't update within 5 minutes, contact support and share your payment reference.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "You can downgrade at any time. Paid subscriptions don't auto-renew.\n\nIf you don't renew, you'll return to Free access when your plan expires.",
      },
    ],
    promotions: [
      {
        q: "What is a promotion?",
        a: "Promotions help your products appear more often in the Marketplace (like ads).\n\nThe longer you run a promotion, the more exposure you get.",
      },
      {
        q: "How long can I promote?",
        a: "You can run promotions for multiple days (2, 7, 14 days, etc.).\n\nLonger promotions give more time for customers to discover your product.",
      },
      {
        q: "Any tips to get better results?",
        a: "Best tips:\n• Promote your best-selling product\n• Use a clear cover photo\n• Use a simple product name\n• Make sure price and stock are correct",
      },
    ],
    growth: [
      {
        q: "How do I get more customers?",
        a: "Best strategies:\n1. Share your store link everywhere\n2. Post products on social media regularly\n3. Offer discounts to first-time buyers\n4. Ask happy customers to refer friends\n5. Use re-engagement for past buyers",
      },
      {
        q: "What makes customers buy more?",
        a: "Top tips:\n• Clear product photos (3–5 per product)\n• Fair prices\n• Fast WhatsApp responses\n• Good reviews\n• Regular updates and new products",
      },
      {
        q: "Should I run sales or discounts?",
        a: "Yes! Sales work very well.\n\nBest times: end of month (payday), weekends, holidays.\n\nUse coupon codes or product discounts.",
      },
    ],
    security: [
      {
        q: "How do I keep my account safe?",
        a: "Best practices:\n• Don't share your login code (OTP)\n• Don't share your password\n• Be careful with unknown links\n• Only trust your myBizHub dashboard",
      },
      {
        q: "Someone is pretending to be myBizHub support",
        a: "myBizHub support will NEVER ask for your password or OTP.\n\nIf someone asks, ignore them and report it in support chat immediately.",
      },
      {
        q: "What should I do if my account is hacked?",
        a: "Contact support immediately and tell us:\n• What happened\n• When it happened\n• Any suspicious links you clicked\n\nWe'll help you secure your account.",
      },
    ],
  };

  const faqs = faqsByTopic[topic];
  const currentTopic = topics.find((x) => x.key === topic);

  return (
    <div className="min-h-screen pb-28 bg-gray-50/30">
      <GradientHeader title="Help & Support" subtitle="Get help quickly" showBack />

      <div className="px-4 space-y-4 pt-4">
        {/* ──────────── Chat + Quick Tips (side by side) ──────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="p-4 cursor-pointer hover:border-orange-200 transition"
            onClick={() => router.push("/vendor/promote/faq/chat")}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-gray-900">Chat with us</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Talk to support</p>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:border-orange-200 transition"
            onClick={() => setTopic("growth")}
          >
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">Quick tips</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Grow your sales</p>
          </Card>
        </div>

        {/* ──────────── Help Topics ──────────── */}
        <SectionCard title="Help topics" subtitle="Choose what you need help with">
          <div className="grid grid-cols-3 gap-2">
            {topics.map((t) => {
              const Icon = TOPIC_ICONS[t.key];
              const isActive = topic === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTopic(t.key)}
                  className={cn(
                    "p-3 rounded-2xl border text-center transition",
                    isActive
                      ? "border-orange-300 bg-orange-50 ring-1 ring-orange-100"
                      : "border-gray-100 bg-white hover:bg-gray-50/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2",
                      isActive ? "bg-orange-500" : "bg-gray-100"
                    )}
                  >
                    <Icon className={cn("w-4.5 h-4.5", isActive ? "text-white" : "text-gray-500")} />
                  </div>
                  <p className={cn("text-[11px] font-bold truncate", isActive ? "text-orange-700" : "text-gray-700")}>
                    {t.title}
                  </p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ──────────── FAQs for selected topic ──────────── */}
        <SectionCard
          title={currentTopic?.title || "Answers"}
          subtitle={`${faqs.length} question${faqs.length !== 1 ? "s" : ""}`}
        >
          <div className="space-y-2">
            {faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </SectionCard>

        {/* ──────────── Still need help? - CENTERED ──────────── */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
              <HelpCircle className="w-6 h-6 text-orange-600" />
            </div>
            <p className="text-base font-bold text-gray-900">Still need help?</p>
            <p className="text-sm text-gray-500 mt-1">Our support team is here for you</p>
            <Button
              className="mt-4"
              onClick={() => router.push("/vendor/promote/faq/chat")}
              leftIcon={<MessageCircle className="w-4 h-4" />}
            >
              Chat with us
            </Button>
          </div>
        </Card>

        {/* ──────────── Safety reminder (compact) ──────────── */}
        <p className="text-[11px] text-gray-400 text-center px-4">
          Never share your password or OTP code with anyone, including support.
        </p>
      </div>
    </div>
  );
}
