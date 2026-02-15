// FILE: src/components/AchievementProvider.tsx
"use client";

import { useAchievements } from "@/hooks/useAchievements";
import { AchievementModal } from "@/components/AchievementModal";

interface AchievementProviderProps {
  role?: "vendor" | "customer";
  children: React.ReactNode;
}

/**
 * Wrap this around a layout to enable achievement popups.
 * It polls for unseen achievements on mount and shows them one by one.
 */
export function AchievementProvider({ role = "vendor", children }: AchievementProviderProps) {
  const { current, dismiss, isMuted, setMuted } = useAchievements(role);

  return (
    <>
      {children}
      <AchievementModal
        achievement={current}
        onDismiss={dismiss}
        isMuted={isMuted}
        onToggleMute={setMuted}
      />
    </>
  );
}
