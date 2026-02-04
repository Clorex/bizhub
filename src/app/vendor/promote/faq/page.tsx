"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";

type TopicKey =
  | "getting_started"
  | "products"
  | "orders"
  | "payments"
  | "payouts"
  | "subscription"
  | "promotions"
  | "security";

type Faq = { q: string; a: string };

function TopicCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <div className="rounded-2xl border border-biz-line bg-white p-4 hover:bg-black/[0.02] transition">
        <p className="text-sm font-extrabold text-biz-ink">{title}</p>
        <p className="text-xs text-biz-muted mt-1">{subtitle}</p>
      </div>
    </button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-2xl border border-biz-line bg-white p-4 hover:bg-black/[0.02] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-biz-ink">{q}</p>
          {open ? <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a}</p> : null}
        </div>
        <span className="text-gray-400 font-extrabold">{open ? "–" : "+"}</span>
      </div>
      {!open ? <p className="text-[11px] text-biz-muted mt-2">Tap to view answer</p> : null}
    </button>
  );
}

export default function VendorHelpCenterPage() {
  const router = useRouter();

  const [topic, setTopic] = useState<TopicKey>("getting_started");

  const topics = useMemo(
    () =>
      [
        {
          key: "getting_started",
          title: "Getting started",
          subtitle: "Set up your store and start receiving orders",
        },
        {
          key: "products",
          title: "Products",
          subtitle: "Add, edit, stock, photos, variations",
        },
        {
          key: "orders",
          title: "Orders",
          subtitle: "Order status, delivery, cancellations, disputes",
        },
        {
          key: "payments",
          title: "Payments",
          subtitle: "Checkout issues and payment confirmations",
        },
        {
          key: "payouts",
          title: "Wallet & withdrawals",
          subtitle: "How money moves and how to withdraw",
        },
        {
          key: "subscription",
          title: "Plans & upgrades",
          subtitle: "Limits, upgrades and what changes after you pay",
        },
        {
          key: "promotions",
          title: "Promotions",
          subtitle: "Boosting products and getting more visibility",
        },
        {
          key: "security",
          title: "Account safety",
          subtitle: "Keeping your account safe and avoiding scams",
        },
      ] as const,
    []
  );

  const faqsByTopic: Record<TopicKey, Faq[]> = {
    getting_started: [
      {
        q: "How do I share my store link?",
        a: "Open your store page, then copy your link and share it on WhatsApp, Instagram, or anywhere your customers are.\n\nTip: Share your store link first, then share product links for best results.",
      },
      {
        q: "Why can’t customers see my products?",
        a: "Check these:\n- Your products have photos and a price\n- Your product is not out of stock\n- Your marketplace setting is ON (if you want it on Market)\n\nIf it still doesn’t show, use “Talk to support” and tell us the store name.",
      },
      {
        q: "What should I do first after onboarding?",
        a: "Best order:\n1) Add 5–10 products with clear photos\n2) Set correct price and stock\n3) Set your WhatsApp number\n4) Share your store link to your customers",
      },
    ],

    products: [
      {
        q: "How many photos should I upload?",
        a: "1 photo is enough to start, but 3–5 photos sells better.\nUse clear photos with good light. Make the first photo your best photo (cover).",
      },
      {
        q: "What are variations?",
        a: "Variations help customers choose options like size, color, weight, or model.\nIf your product has different options, add variations so customers don’t get confused.",
      },
      {
        q: "Why is my product showing “out of stock”?",
        a: "That means the stock number is 0.\nUpdate stock in the product editor, then save.",
      },
    ],

    orders: [
      {
        q: "Where do I see new orders?",
        a: "Go to Vendor → Orders.\nYou’ll see newest orders at the top.",
      },
      {
        q: "A customer says they paid but I can’t see it",
        a: "Ask the customer to confirm they completed payment and didn’t cancel.\nIf you have a payment reference, use support chat and share the reference so we can check the status.",
      },
      {
        q: "How do disputes work?",
        a: "If there is an issue, a dispute can be opened so the order can be reviewed fairly.\nAlways keep your proof (chat, receipts, delivery updates).",
      },
    ],

    payments: [
      {
        q: "My customer’s payment failed. What can we do?",
        a: "Tell the customer to try again.\nIf it still fails:\n- Use a different card\n- Check network\n- Try a bank transfer option (if available)\n\nYou can also share the order link again.",
      },
      {
        q: "Do customers abroad need a special card?",
        a: "Most international cards work.\nSometimes a bank blocks online payments. In that case, the customer should enable online/international payments on their banking app.",
      },
      {
        q: "Will customers see extra charges?",
        a: "Some banks add small charges for online/international payments. That depends on the customer’s bank, not your store.",
      },
    ],

    payouts: [
      {
        q: "How do I withdraw my money?",
        a: "Go to your Wallet/Balance page and follow the withdrawal steps.\nMake sure your payout details are correct before withdrawing.",
      },
      {
        q: "Why can’t I withdraw yet?",
        a: "This can happen if:\n- Your payout details are missing\n- There is a pending review\n- Your account needs an extra check\n\nUse support chat and tell us what you see on the screen.",
      },
    ],

    subscription: [
      {
        q: "What changes after I upgrade?",
        a: "Upgrades unlock higher limits and more tools.\nYour plan determines what you see and what you can use.",
      },
      {
        q: "I paid but my plan didn’t change",
        a: "Sometimes it takes a short moment.\nIf it doesn’t update, open support chat and share your payment reference.",
      },
    ],

    promotions: [
      {
        q: "What is Promotion?",
        a: "Promotion helps your product appear more often in promoted slots.\nThe more days you run, the more exposure you can get.",
      },
      {
        q: "How long can I promote?",
        a: "You can run promotions for multiple days.\nLonger promotions give more time for customers to discover your product.",
      },
      {
        q: "Any tips to get better results?",
        a: "Best tips:\n- Promote your best-selling product\n- Use a clear cover photo\n- Use a simple product name customers understand\n- Make sure price and stock are correct",
      },
    ],

    security: [
      {
        q: "How do I keep my account safe?",
        a: "Best practices:\n- Don’t share your login code\n- Don’t share your password\n- Be careful with unknown links\n- Only trust what you see inside your BizHub dashboard",
      },
      {
        q: "Someone is pretending to be BizHub support",
        a: "BizHub support will not ask for your password.\nIf someone asks for your password or OTP, ignore them and report it in support chat.",
      },
    ],
  };

  const faqs = faqsByTopic[topic];

  return (
    <div className="min-h-screen">
      <GradientHeader title="Help & support" subtitle="Quick answers + support chat" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Talk to support</p>
          <p className="text-xs text-biz-muted mt-1">
            If you’re stuck, talk to our support assistant. Explain your issue in simple words.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => router.push("/vendor/promote/faq/chat")}>Talk to support</Button>
            <Button variant="secondary" onClick={() => setTopic("getting_started")}>
              Quick tips
            </Button>
          </div>

          <p className="mt-3 text-[11px] text-biz-muted">
            Tip: Don’t share passwords or OTP codes in chat.
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Topics</p>
          <p className="text-xs text-biz-muted mt-1">Choose what you need help with.</p>

          <div className="mt-3 grid grid-cols-1 gap-2">
            {topics.map((t) => (
              <TopicCard key={t.key} title={t.title} subtitle={t.subtitle} onClick={() => setTopic(t.key)} />
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Answers</p>
          <p className="text-xs text-biz-muted mt-1">
            Topic:{" "}
            <b className="text-biz-ink">
              {topics.find((x) => x.key === topic)?.title || "Help"}
            </b>
          </p>

          <div className="mt-3 space-y-2">
            {faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}