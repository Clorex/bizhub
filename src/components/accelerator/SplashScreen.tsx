// FILE: src/components/accelerator/SplashScreen.tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/Card";
import { Rocket, Store, ArrowRight } from "lucide-react";

interface Props {
  onHaveBusiness: () => void;
  onStartAccelerator: () => void;
}

export function SplashScreen({ onHaveBusiness, onStartAccelerator }: Props) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-6 shadow-lg">
        <Rocket className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-2xl font-black text-gray-900 text-center">
        Welcome to myBizHub {"\uD83D\uDE80"}
      </h1>
      <h2 className="text-2xl font-black text-gray-900 text-center">
        Let&apos;s build your business.
      </h2>

      <p className="text-sm text-gray-500 text-center mt-3 max-w-sm">
        In less than 5 minutes, we&apos;ll help you launch something profitable.
      </p>

      <div className="w-full max-w-sm mt-8 space-y-3">
        <Card className="p-0 overflow-hidden">
          <button
            onClick={onHaveBusiness}
            className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">I already have a business</p>
              <p className="text-xs text-gray-500 mt-0.5">Set up your store on myBizHub</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300" />
          </button>
        </Card>

        <Card className="p-0 overflow-hidden border-orange-200 bg-orange-50/50">
          <button
            onClick={onStartAccelerator}
            className="w-full flex items-center gap-4 p-5 hover:bg-orange-50 transition text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shrink-0">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Start a new business</p>
              <p className="text-xs text-gray-500 mt-0.5">Smart Accelerator &mdash; find &amp; launch your idea</p>
            </div>
            <ArrowRight className="w-5 h-5 text-orange-400" />
          </button>
        </Card>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Small steps. Big results.
      </p>
    </div>
  );
}
