// FILE: src/hooks/useAchievements.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { ACHIEVEMENT_DEFS, type AchievementKey, type AchievementDef } from "@/lib/achievements/keys";

const MUTE_KEY = "bizhub_achievements_muted";
const SESSION_INTERACTED_KEY = "__bizhub_user_interacted";

/**
 * Check if user has interacted with the page in this session.
 * We set this flag on any click/keydown/touch in the session.
 */
function hasUserInteracted(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any)[SESSION_INTERACTED_KEY];
}

function markUserInteracted() {
  if (typeof window === "undefined") return;
  (window as any)[SESSION_INTERACTED_KEY] = true;
}

// Set up global interaction listener once
if (typeof window !== "undefined") {
  const handler = () => { markUserInteracted(); };
  window.addEventListener("click", handler, { once: false, passive: true });
  window.addEventListener("keydown", handler, { once: false, passive: true });
  window.addEventListener("touchstart", handler, { once: false, passive: true });
}

export function useAchievementSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isMuted = useCallback((): boolean => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(MUTE_KEY) === "true";
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
  }, []);

  const play = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isMuted()) return;
    if (!hasUserInteracted()) return; // respect autoplay rules

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/achievement.mp3");
        audioRef.current.volume = 0.6;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — silently ignore
      });
    } catch {
      // ignore
    }
  }, [isMuted]);

  return { play, isMuted, setMuted };
}

export interface PendingAchievement {
  def: AchievementDef;
  key: AchievementKey;
}

export function useAchievements(role: "vendor" | "customer" = "vendor") {
  const [pending, setPending] = useState<PendingAchievement[]>([]);
  const [current, setCurrent] = useState<PendingAchievement | null>(null);
  const { play, isMuted, setMuted } = useAchievementSound();
  const fetchedRef = useRef(false);

  const fetchAchievements = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const r = await fetch(`/api/achievements?role=${role}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (!data?.ok || !Array.isArray(data.achievements) || data.achievements.length === 0) return;

      const items: PendingAchievement[] = [];
      for (const a of data.achievements) {
        const def = ACHIEVEMENT_DEFS[a.key as AchievementKey];
        if (def) {
          items.push({ def, key: a.key });
        }
      }

      if (items.length > 0) {
        setPending(items);
        setCurrent(items[0]);
      }
    } catch {
      // ignore
    }
  }, [role]);

  // Fetch on mount (once)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Small delay to let the page render first
    const t = setTimeout(() => fetchAchievements(), 2000);
    return () => clearTimeout(t);
  }, [fetchAchievements]);

  // Play sound when current achievement appears
  useEffect(() => {
    if (current) {
      // Only play sound if this is an action-triggered achievement
      // For passive ones (like first visit), only play if user has interacted
      play();
    }
  }, [current, play]);

  const dismiss = useCallback(async () => {
    if (!current) return;

    // Mark as seen on server
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        fetch("/api/achievements", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, keys: [current.key] }),
        }).catch(() => {});
      }
    } catch {}

    // Move to next or close
    const remaining = pending.filter((p) => p.key !== current.key);
    setPending(remaining);

    if (remaining.length > 0) {
      setCurrent(remaining[0]);
    } else {
      setCurrent(null);
    }
  }, [current, pending, role]);

  return {
    current,
    pending,
    dismiss,
    isMuted,
    setMuted,
    refetch: fetchAchievements,
  };
}
