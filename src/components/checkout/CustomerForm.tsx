// FILE: src/components/checkout/CustomerForm.tsx
"use client";

import { memo } from "react";
import { User, Mail, Phone, MapPin, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

interface CustomerFormProps {
  email: string;
  fullName: string;
  phone: string;
  address: string;
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  emailVerified: boolean;
  isPickup: boolean;
}

export const CustomerForm = memo(function CustomerForm({
  email,
  fullName,
  phone,
  address,
  onEmailChange,
  onFullNameChange,
  onPhoneChange,
  onAddressChange,
  emailVerified,
  isPickup,
}: CustomerFormProps) {
  return (
    <div className="space-y-4">
      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Email address
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Mail className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>
        {!emailVerified && (
          <div className="flex items-center gap-1.5 mt-1.5 text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <p className="text-xs">Please verify your email to continue</p>
          </div>
        )}
      </div>

      {/* Full Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Full name
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <User className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="John Doe"
            autoComplete="name"
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Phone number
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Phone className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="08012345678"
            autoComplete="tel"
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>
      </div>

      {/* Address (only for delivery) */}
      {!isPickup && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Delivery address
          </label>
          <div className="relative">
            <div className="absolute left-4 top-4">
              <MapPin className="w-4 h-4 text-gray-400" />
            </div>
            <textarea
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Enter your full delivery address"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition resize-none"
            />
          </div>
        </div>
      )}

      {isPickup && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Pickup selected</p>
            <p className="text-xs text-blue-700 mt-0.5">
              You'll pick up your order at the vendor's location. No delivery address needed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});