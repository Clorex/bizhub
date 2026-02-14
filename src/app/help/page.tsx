"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import {
  HelpCircle,
  MessageCircle,
  ShoppingBag,
  Truck,
  CreditCard,
  Shield,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: "How do I place an order?",
    a: "Browse the marketplace, add items to your cart, then proceed to checkout. You can pay via card, bank transfer, or other available methods.",
  },
  {
    q: "How do I track my order?",
    a: "Go to Profile \u2192 View orders. Tap any order to see its current status and delivery updates.",
  },
  {
    q: "Can I cancel an order?",
    a: "You can request a cancellation from the order details page if the vendor hasn't shipped it yet. Once shipped, contact the vendor directly.",
  },
  {
    q: "How do payments work?",
    a: "We use secure payment processing. Your payment goes to escrow and is released to the vendor once you confirm delivery.",
  },
  {
    q: "What if I receive the wrong item?",
    a: "Open a dispute from the order details page. We'll mediate between you and the vendor to resolve the issue.",
  },
  {
    q: "How do I save products for later?",
    a: "Tap the heart icon on any product to add it to your favorites. Access them from Profile \u2192 View favorites.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. We use Firebase Authentication and encrypted connections. We never share your personal data with third parties.",
  },
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900 flex-1">{item.q}</p>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        )}
      </div>
      {open && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.a}</p>}
    </button>
  );
}

export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <GradientHeader title="Help & Support" subtitle="We're here to help" showBack />
      <div className="px-4 pb-28 space-y-4">
        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: ShoppingBag, label: "Orders", desc: "Track purchases", href: "/orders" },
            { icon: Shield, label: "Security", desc: "Account safety", href: "/account/security" },
            { icon: Truck, label: "Shipping", desc: "Delivery info", href: "/orders" },
            { icon: CreditCard, label: "Payments", desc: "Payment help", href: "/orders" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 transition text-left"
            >
              <item.icon className="w-6 h-6 text-orange-500 mb-2" />
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>

        {/* FAQs */}
        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink mb-3">Frequently asked questions</p>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <FaqAccordion key={i} item={faq} />
            ))}
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Still need help?</p>
          <p className="text-xs text-biz-muted mt-1">
            If you can't find your answer above, reach out to us.
          </p>
          <div className="mt-3 space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                window.open("mailto:support@mybizhub.co.za", "_blank");
              }}
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Email support
                <ExternalLink className="w-3 h-3 opacity-50" />
              </span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
