"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Sparkles, MessageCircle, Lightbulb } from "lucide-react";

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
        <span className="text-gray-400 font-extrabold shrink-0">{open ? "–" : "+"}</span>
      </div>
      {!open ? <p className="text-[11px] text-biz-muted mt-2">Tap to expand</p> : null}
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
          key: "growth",
          title: "Growth tips",
          subtitle: "How to get more customers and increase sales",
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
        a: "Open your vendor dashboard, then copy your store link and share it on WhatsApp, Instagram, Facebook, or anywhere your customers are.\n\nTip: Share your store link first, then share individual product links for best results.",
      },
      {
        q: "Why can't customers see my products?",
        a: "Check these:\n- Your products have photos and a price\n- Your product is not out of stock\n- Your marketplace setting is ON (if you want it in the Marketplace)\n\nIf it still doesn't show, contact support and tell us your store name.",
      },
      {
        q: "What should I do first after signing up?",
        a: "Best order:\n1. Add 5–10 products with clear photos\n2. Set correct price and stock\n3. Add your WhatsApp number in store settings\n4. Share your store link with your customers",
      },
    ],

    products: [
      {
        q: "How many photos should I upload?",
        a: "1 photo is enough to start, but 3–5 photos sell better.\n\nUse clear photos with good lighting. Make the first photo your best one (it's your cover photo).",
      },
      {
        q: "What are variations?",
        a: "Variations help customers choose options like size, color, weight, or model.\n\nIf your product has different options, add variations so customers know exactly what they're buying.",
      },
      {
        q: "Why is my product showing 'out of stock'?",
        a: "That means the stock number is 0.\n\nUpdate the stock in the product editor, then save.",
      },
      {
        q: "How do I make my products easier to find?",
        a: "Use clear product names (e.g., \"Men's Black Sneakers Size 42\" instead of \"Item 123\").\n\nAdd categories and colors/sizes if applicable. This helps buyers find you faster.",
      },
    ],

    orders: [
      {
        q: "Where do I see new orders?",
        a: "Go to Vendor → Orders.\n\nYou'll see the newest orders at the top.",
      },
      {
        q: "A customer says they paid but I can't see it",
        a: "Ask the customer to confirm they completed payment and didn't cancel.\n\nIf you have a payment reference, contact support and share the reference so we can check the status.",
      },
      {
        q: "How do disputes work?",
        a: "If there's an issue, a dispute can be opened so the order can be reviewed fairly.\n\nAlways keep your proof (chat screenshots, receipts, delivery updates). This helps resolve disputes faster.",
      },
      {
        q: "What should I do when I get a new order?",
        a: "Best practice:\n1. Confirm the order details (items, price, delivery)\n2. Message the customer on WhatsApp to confirm\n3. Update order status as you progress (contacted → paid → in transit → delivered)\n4. Keep the customer updated",
      },
    ],

    payments: [
      {
        q: "My customer's payment failed. What can we do?",
        a: "Tell the customer to try again.\n\nIf it still fails:\n- Use a different card\n- Check network connection\n- Try a bank transfer option (if available)\n\nYou can also share the order link again.",
      },
      {
        q: "Do customers abroad need a special card?",
        a: "Most international cards work.\n\nSometimes a bank blocks online payments. The customer should enable online/international payments in their banking app.",
      },
      {
        q: "Will customers see extra charges?",
        a: "Some banks add small charges for online/international payments.\n\nThat depends on the customer's bank, not your store.",
      },
    ],

    payouts: [
      {
        q: "How do I withdraw my money?",
        a: "Go to your Wallet/Balance page and follow the withdrawal steps.\n\nMake sure your payout details (bank account) are correct before withdrawing.",
      },
      {
        q: "Why can't I withdraw yet?",
        a: "This can happen if:\n- Your payout details are missing or incorrect\n- There's a pending review on your account\n- Your account needs an extra verification check\n\nContact support and tell us what you see on the screen.",
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
        a: "You can downgrade at any time, but paid subscriptions don't auto-renew (you pay per cycle).\n\nIf you don't renew, you'll drop back to Free access when your current plan expires.",
      },
    ],

    promotions: [
      {
        q: "What is a promotion?",
        a: "Promotions help your products appear more often in the Marketplace (like ads).\n\nThe longer you run a promotion, the more exposure you get.",
      },
      {
        q: "How long can I promote?",
        a: "You can run promotions for multiple days (2 days, 7 days, 14 days, etc.).\n\nLonger promotions give more time for customers to discover your product.",
      },
      {
        q: "Any tips to get better results?",
        a: "Best tips:\n- Promote your best-selling product (the one customers already love)\n- Use a clear cover photo with good lighting\n- Use a simple product name customers understand\n- Make sure price and stock are correct before you promote",
      },
    ],

    growth: [
      {
        q: "How do I get more customers?",
        a: "Best strategies:\n1. Share your store link everywhere (WhatsApp, Instagram, Facebook, TikTok)\n2. Post your products on social media regularly\n3. Offer discounts to first-time buyers (use coupon codes)\n4. Ask happy customers to refer their friends\n5. Use re-engagement to bring back past buyers",
      },
      {
        q: "What makes customers buy more?",
        a: "Top tips:\n- Clear product photos (3–5 photos per product)\n- Fair prices (not too high, not too low)\n- Fast responses on WhatsApp\n- Good reviews from other customers\n- Regular updates (new products, sales, promotions)",
      },
      {
        q: "Should I run sales or discounts?",
        a: "Yes! Sales work very well.\n\nBest times to run sales:\n- End of month (payday)\n- Weekends\n- Holidays (Christmas, New Year, Valentine's, etc.)\n\nUse coupon codes or product discounts to make it easy.",
      },
      {
        q: "How do I keep customers coming back?",
        a: "Best practices:\n- Deliver on time (or update customers if delayed)\n- Message customers after delivery to say thank you\n- Use re-engagement to send follow-up messages\n- Offer loyalty discounts (e.g., \"10% off your next order\")\n- Keep adding new products so they have a reason to return",
      },
    ],

    security: [
      {
        q: "How do I keep my account safe?",
        a: "Best practices:\n- Don't share your login code (OTP)\n- Don't share your password\n- Be careful with unknown links\n- Only trust what you see inside your myBizHub dashboard\n- Enable 2-step verification if available",
      },
      {
        q: "Someone is pretending to be myBizHub support",
        a: "myBizHub support will NEVER ask for your password or OTP.\n\nIf someone asks for your password or login code, ignore them and report it in support chat immediately.",
      },
      {
        q: "What should I do if my account is hacked?",
        a: "Contact support immediately and tell us:\n- What happened\n- When it happened\n- Any suspicious messages or links you clicked\n\nWe'll help you secure your account.",
      },
    ],
  };

  const faqs = faqsByTopic[topic];

  return (
    <div className="min-h-screen">
      <GradientHeader title="Help & Support" subtitle="Quick answers + support chat" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {/* ✅ AI Assistant placeholder (UI only, no backend yet) */}
        <Card className="p-4 border-2 border-dashed border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-biz-accent2 to-biz-accent flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-biz-ink">AI Assistant (coming soon)</p>
              <p className="text-xs text-biz-muted mt-1">
                Get instant answers to your questions. Ask anything about selling on myBizHub.
              </p>

              <div className="mt-3">
                <Button variant="ghost" disabled className="opacity-60">
                  <Sparkles className="h-4 w-4" />
                  Ask AI Assistant
                </Button>
              </div>

              <p className="text-[11px] text-biz-muted mt-2">
                This feature is coming soon. For now, use "Talk to support" below or browse the help topics.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-orange-700" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-biz-ink">Talk to support</p>
              <p className="text-xs text-biz-muted mt-1">
                Stuck? Explain your issue in simple words and our team will help.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => router.push("/vendor/promote/faq/chat")}>
                  <MessageCircle className="h-4 w-4" />
                  Chat with us
                </Button>
                <Button variant="secondary" onClick={() => setTopic("getting_started")} leftIcon={<Lightbulb className="h-4 w-4" />}>
                  Quick tips
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                Never share your password or OTP code in chat.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Help topics</p>
          <p className="text-xs text-biz-muted mt-1">Choose what you need help with</p>

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