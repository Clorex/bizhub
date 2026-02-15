// FILE: src/components/AchievementModal.tsx
"use client";

import { useEffect, useState } from "react";
import { X, Trophy, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PendingAchievement } from "@/hooks/useAchievements";

interface AchievementModalProps {
  achievement: PendingAchievement | null;
  onDismiss: () => void;
  isMuted: () => boolean;
  onToggleMute: (muted: boolean) => void;
}

export function AchievementModal({
  achievement,
  onDismiss,
  isMuted,
  onToggleMute,
}: AchievementModalProps) {
  const [visible, setVisible] = useState(false);
  const [muted, setMutedLocal] = useState(false);

  useEffect(() => {
    setMutedLocal(isMuted());
  }, [achievement, isMuted]);

  useEffect(() => {
    if (achievement) {
      // Animate in
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [achievement]);

  if (!achievement) return null;

  const { def } = achievement;

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  function toggleMute() {
    const next = !muted;
    setMutedLocal(next);
    onToggleMute(next);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden transition-all duration-500",
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-8"
        )}
      >
        {/* Confetti header */}
        <div className="bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500 px-6 pt-8 pb-6 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-2 left-4 w-3 h-3 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="absolute top-6 right-8 w-2 h-2 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: "0.3s" }} />
          <div className="absolute bottom-3 left-12 w-2.5 h-2.5 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: "0.6s" }} />
          <div className="absolute top-4 left-1/2 w-2 h-2 rounded-full bg-yellow-300/40 animate-bounce" style={{ animationDelay: "0.15s" }} />
          <div className="absolute bottom-5 right-6 w-3 h-3 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: "0.45s" }} />

          {/* Close + Mute */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
              title={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Trophy + emoji */}
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-4xl">{def.emoji}</span>
            </div>
          </div>

          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Achievement Unlocked</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-black text-gray-900">{def.title}</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{def.message}</p>

          <button
            onClick={handleDismiss}
            className="mt-6 w-full py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
}
