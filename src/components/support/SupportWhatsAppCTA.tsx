"use client";

import { Card } from "@/components/Card";
import { WhatsAppButton, WhatsAppIcon } from "@/components/ui/WhatsAppButton";
import { buildWhatsAppLink } from "@/lib/whatsapp/buildWhatsAppLink";
import { cn } from "@/lib/cn";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";

type Props = {
  title?: string;
  subtitle?: string;
  message?: string;
  buttonLabel?: string;
  className?: string;
};

export default function SupportWhatsAppCTA({
  title = "Talk to customer care",
  subtitle = "We reply fast on WhatsApp",
  message = "Hi myBizHub support, I need help with…",
  buttonLabel = "Chat on WhatsApp",
  className,
}: Props) {
  const href = SUPPORT_WHATSAPP ? buildWhatsAppLink(SUPPORT_WHATSAPP, message) : "";
  if (!href) return null;

  return (
    <Card
      className={cn(
        "p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center shrink-0 shadow-sm">
          <WhatsAppIcon className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>

          <div className="mt-3">
            <WhatsAppButton href={href} label={buttonLabel} variant="button" size="md" />
          </div>
        </div>
      </div>
    </Card>
  );
}
