// FILE: src/components/SplashIntro.tsx
"use client";

import { useEffect, useRef, useState } from "react";

const SPLASH_SHOWN_KEY = "mybizhub_splash_shown_v1";
const TOTAL_MS = 1000; // show for only 1 second
const FADE_MS = 180;

function hasShown(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(SPLASH_SHOWN_KEY) === "1";
  } catch {
    return true;
  }
}

function markShown() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
  } catch {}
}

export default function SplashIntro() {
  const [open, setOpen] = useState(false);
  const [fade, setFade] = useState(false);
  const t1 = useRef<number | null>(null);
  const t2 = useRef<number | null>(null);

  useEffect(() => {
    // Show only once per tab/session
    if (hasShown()) return;

    markShown();
    setOpen(true);

    t1.current = window.setTimeout(() => setFade(true), Math.max(0, TOTAL_MS - FADE_MS));
    t2.current = window.setTimeout(() => setOpen(false), TOTAL_MS);

    return () => {
      if (t1.current) window.clearTimeout(t1.current);
      if (t2.current) window.clearTimeout(t2.current);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FF2D00] transition-opacity"
      style={{ opacity: fade ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-label="Splash"
      role="presentation"
    >
      <div className="w-[260px] max-w-[70vw]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash/logo.png"
          alt="myBizHub"
          className="w-full h-auto select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}