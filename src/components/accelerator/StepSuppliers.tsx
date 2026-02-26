// FILE: src/components/accelerator/StepSuppliers.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { BusinessIdea, SupplierMatch } from "@/lib/accelerator/types";
import {
  Star,
  MapPin,
  ShieldCheck,
  MessageCircle,
  ChevronRight,
  Phone,
  Copy,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/ui/toast";
import { buildWhatsAppLink } from "@/lib/whatsapp/buildWhatsAppLink";

function generateMockSuppliers(idea: BusinessIdea, location: string): SupplierMatch[] {
  const categories: Record<string, string[]> = {
    food: ["Foodstuff Market", "Wholesale Foods", "Farm Fresh Supplies"],
    fashion: ["Textile Warehouse", "Fashion Hub", "Clothing Wholesale"],
    beauty: ["Beauty Supplies Hub", "Hair & Beauty Wholesale", "Cosmetics Direct"],
    tech: ["Tech Gadgets Direct", "Electronics Wholesale", "Phone Parts Hub"],
    digital: ["Digital Tools Store", "Creative Assets Market", "Software Hub"],
    retail: ["General Wholesale", "Mini Mart Supplies", "Bulk Goods Center"],
    services: ["Equipment Supplier", "Tools & Kits Store", "Service Supplies Hub"],
  };

  const names = categories[idea.category] || categories.retail;

  return names.map((name, i) => ({
    id: `supplier_${i}`,
    name: `${name} ${location || "Nigeria"}`,
    category: idea.category,
    rating: 3.5 + Math.random() * 1.5,
    reliabilityScore: 70 + Math.round(Math.random() * 25),
    location: location || "Lagos",
    verified: i < 2,
    whatsappNumber: undefined,
    autoMessage: `Hi, I'm interested in sourcing products for my ${idea.title.toLowerCase()} business. Can you share your catalog and pricing?`,
  }));
}

interface Props {
  idea: BusinessIdea;
  location: string;
  onContinue: () => void;
  onBack: () => void;
}

export function StepSuppliers({ idea, location, onContinue, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierMatch[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuppliers(generateMockSuppliers(idea, location));
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [idea, location]);

  const copyAutoMessage = async (supplier: SupplierMatch) => {
    if (!supplier.autoMessage) return;
    try {
      await navigator.clipboard.writeText(supplier.autoMessage);
      setCopiedId(supplier.id);
      toast.success("Message copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy message");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
        <p className="text-sm text-gray-500">Finding trusted suppliers near you...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">
          Trusted suppliers for you
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect and start sourcing products.
        </p>
      </div>

      {suppliers.map((supplier, idx) => (
        <Card
          key={supplier.id}
          className={cn("p-4", `animate-card-in animate-card-in-delay-${Math.min(idx, 4)}`)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-orange-600">
                {supplier.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 truncate">{supplier.name}</h3>
                {supplier.verified && (
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-gray-600">
                    {supplier.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{supplier.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reliability */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500 uppercase">Reliability</span>
              <span className="text-[10px] font-bold text-gray-900">{supplier.reliabilityScore}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  supplier.reliabilityScore >= 85 ? "bg-green-500" :
                  supplier.reliabilityScore >= 70 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${supplier.reliabilityScore}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              leftIcon={<MessageCircle className="w-3 h-3" />}
              onClick={() => toast.info("Chat coming soon!")}
            >
              Chat
            </Button>
            {supplier.whatsappNumber ? (
              <a
                href={buildWhatsAppLink(supplier.whatsappNumber, supplier.autoMessage || "")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button size="sm" className="w-full" leftIcon={<Phone className="w-3 h-3" />}>
                  WhatsApp
                </Button>
              </a>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                leftIcon={copiedId === supplier.id ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                onClick={() => copyAutoMessage(supplier)}
              >
                {copiedId === supplier.id ? "Copied!" : "Copy message"}
              </Button>
            )}
          </div>
        </Card>
      ))}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={onContinue}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
