// FILE: src/hooks/useAchievements.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { ACHIEVEMENT_DEFS, type AchievementKey, type AchievementDef } from "@/lib/achievements/keys";

const MUTE_KEY = "bizhub_achievements_muted";
const SEEN_KEY = "bizhub_achievements_seen"; // localStorage fallback
const SESSION_INTERACTED_KEY = "__bizhub_user_interacted";

/**
 * Client-side fallback: track which achievements have been dismissed locally.
 * This prevents re-showing if the server POST to mark-as-seen fails.
 */
function getLocalSeenKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addLocalSeenKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    const seen = getLocalSeenKeys();
    seen.add(key);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

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
    if (!hasUserInteracted()) return;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/achievement.mp3");
        audioRef.current.volume = 0.6;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
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
  const dismissingRef = useRef(false);

  const fetchAchievements = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const r = await fetch(`/api/achievements?role=${role}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (!data?.ok || !Array.isArray(data.achievements) || data.achievements.length === 0) return;

      // Filter out achievements already dismissed locally (fallback protection)
      const localSeen = getLocalSeenKeys();

      const items: PendingAchievement[] = [];
      for (const a of data.achievements) {
        // Skip if already dismissed locally
        if (localSeen.has(a.key)) continue;

        const def = ACHIEVEMENT_DEFS[a.key as AchievementKey];
        if (def) {
          items.push({ def, key: a.key });
        }
      }

      if (items.length > 0) {
        setPending(items);
        setCurrent(items[0]);
      }
    } catch {}
  }, [role]);

  // Fetch on mount (once)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const t = setTimeout(() => fetchAchievements(), 2000);
    return () => clearTimeout(t);
  }, [fetchAchievements]);

  // Play sound when current achievement appears
  useEffect(() => {
    if (current) {
      play();
    }
  }, [current, play]);

  const dismiss = useCallback(async () => {
    if (!current || dismissingRef.current) return;
    dismissingRef.current = true;

    const dismissedKey = current.key;

    // 1. Immediately mark as seen in localStorage (fallback — prevents re-show)
    addLocalSeenKey(dismissedKey);

    // 2. Move to next or close (UI updates immediately)
    const remaining = pending.filter((p) => p.key !== dismissedKey);
    setPending(remaining);

    if (remaining.length > 0) {
      setCurrent(remaining[0]);
    } else {
      setCurrent(null);
    }

    // 3. Mark as seen on server (best-effort with retry)
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const res = await fetch("/api/achievements", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, keys: [dismissedKey] }),
        });

        // If first attempt fails, retry once after 2 seconds
        if (!res.ok) {
          setTimeout(async () => {
            try {
              const retryToken = await auth.currentUser?.getIdToken(true);
              if (retryToken) {
                await fetch("/api/achievements", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${retryToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ role, keys: [dismissedKey] }),
                }).catch(() => {});
              }
            } catch {}
          }, 2000);
        }
      }
    } catch {
      // Server mark-as-seen failed, but localStorage fallback ensures no repeat
    }

    dismissingRef.current = false;
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
